// Booking functionality with API integration
// localStorage code kept as backup
class BookingSystem {
    constructor() {
        this.currentDate = new Date();
        this.serviceData = this.getServiceFromURL();
        this.availability = {};
        this.existingAppointments = []; // Track booked appointments
        this.selectedDate = null;
        this.selectedTime = null;
        this.useAPI = true; // Set to false to use localStorage backup
        this.isSubmitting = false; // Prevent duplicate submissions
        this.isLoadingAvailability = false; // Track loading state
        
        this.init();
    }

    getServiceFromURL() {
        const params = new URLSearchParams(window.location.search);
        return {
            name: params.get('service') || 'Haircut',
            price: params.get('price') || '30.00',
            duration: parseInt(params.get('duration') || '45')
        };
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    formatDateDisplay(date) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }

    // Show success/error messages
    showMessage(message, type = 'success') {
        // Remove existing messages
        const existingMsg = document.querySelector('.booking-message');
        if (existingMsg) {
            existingMsg.remove();
        }

        const messageEl = document.createElement('div');
        messageEl.className = `booking-message ${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
            background: ${type === 'success' ? '#4caf50' : '#f44336'};
            color: white;
            text-align: center;
            font-weight: 500;
            animation: slideDown 0.3s ease-out;
        `;

        const bookingSection = document.querySelector('.booking-section .container');
        if (bookingSection) {
            bookingSection.insertBefore(messageEl, bookingSection.firstChild);
        }

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 5000);
    }

    // Fetch availability from API
    async fetchAvailability() {
        if (this.isLoadingAvailability) {
            return; // Prevent duplicate fetches
        }

        if (!this.useAPI) {
            // Backup: Load from localStorage
            const stored = localStorage.getItem('availability');
            this.availability = stored ? JSON.parse(stored) : {};
            this.renderCalendar();
            return;
        }

        this.isLoadingAvailability = true;
        this.showLoadingState();

        try {
            const response = await fetch('/api/availability');
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server returned ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Validate response format
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid response format from server');
            }
            
            // Extract availability object (handle both formats for backward compatibility)
            this.availability = data.availability || data || {};
            
            // Also fetch existing appointments to check for booked slots
            await this.fetchExistingAppointments();
            
            this.renderCalendar();
            this.hideLoadingState();
        } catch (error) {
            // Only show error if it's a real connection issue, not just empty data
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                // Fallback to localStorage
                const stored = localStorage.getItem('availability');
                this.availability = stored ? JSON.parse(stored) : {};
                this.renderCalendar();
                this.hideLoadingState();
                this.showMessage('Cannot connect to server. Using cached availability. Some times may be unavailable.', 'error');
            } else {
                // Server responded but with error - still try to render
                this.availability = {};
                this.renderCalendar();
                this.hideLoadingState();
                this.showMessage('Error loading availability. Please refresh the page.', 'error');
            }
        } finally {
            this.isLoadingAvailability = false;
        }
    }

    // Fetch existing appointments to check for booked slots
    async fetchExistingAppointments() {
        if (!this.useAPI) {
            // Backup: Load from localStorage
            const stored = localStorage.getItem('bookedAppointments');
            this.existingAppointments = stored ? JSON.parse(stored) : [];
            return;
        }

        try {
            // Fetch all appointments and filter client-side (backend doesn't support multiple status filter)
            const response = await fetch('/api/appointments');
            
            if (response.ok) {
                const data = await response.json();
                // Filter to only pending and accepted appointments (exclude declined)
                this.existingAppointments = Array.isArray(data) 
                    ? data.filter(apt => apt.status === 'pending' || apt.status === 'accepted')
                    : [];
            }
        } catch (error) {
            // Fallback to localStorage
            const stored = localStorage.getItem('bookedAppointments');
            this.existingAppointments = stored ? JSON.parse(stored) : [];
        }
    }

    // Check if a time slot is already booked
    isTimeSlotBooked(dateStr, timeStr) {
        return this.existingAppointments.some(apt => 
            apt.date === dateStr && 
            apt.time === timeStr && 
            (apt.status === 'pending' || apt.status === 'accepted')
        );
    }

    // Show loading state
    showLoadingState() {
        const calendarGrid = document.getElementById('calendarGrid');
        if (calendarGrid && !calendarGrid.querySelector('.booking-loading')) {
            const loadingEl = document.createElement('div');
            loadingEl.className = 'booking-loading';
            loadingEl.style.cssText = `
                grid-column: 1 / -1;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 2rem;
                color: var(--text-muted);
                font-size: 0.9rem;
            `;
            loadingEl.innerHTML = '<span class="loading-spinner"></span><span>Loading availability...</span>';
            calendarGrid.appendChild(loadingEl);
        }
    }

    // Hide loading state
    hideLoadingState() {
        const calendarGrid = document.getElementById('calendarGrid');
        if (calendarGrid) {
            const loadingEl = calendarGrid.querySelector('.booking-loading');
            if (loadingEl) {
                loadingEl.remove();
            }
        }
    }

    // Get available time slots for a date (excluding booked slots)
    getAvailableTimeSlots(dateStr) {
        if (!this.availability[dateStr]) {
            return [];
        }
        const dayInfo = this.availability[dateStr];
        
        // If day is closed, return no time slots
        if (dayInfo.closed === true) {
            return [];
        }
        
        const allSlots = dayInfo.timeSlots || [];
        
        // Filter out already booked time slots
        const availableSlots = allSlots.filter(slot => !this.isTimeSlotBooked(dateStr, slot));
        
        return availableSlots;
    }

    init() {
        this.displayServiceInfo();
        this.fetchAvailability();
        this.setupEventListeners();
        this.setupServerReconnectionSync();
    }

    // Sync localStorage with server when connection is restored
    setupServerReconnectionSync() {
        if (!this.useAPI) return;

        // Check if we have pending localStorage bookings
        const checkAndSync = async () => {
            if (!navigator.onLine) return;

            try {
                const stored = localStorage.getItem('bookedAppointments');
                if (!stored) return;

                const localAppointments = JSON.parse(stored);
                const pendingSync = localAppointments.filter(apt => !apt.synced);

                if (pendingSync.length === 0) return;

                // Try to sync each pending appointment
                for (const appointment of pendingSync) {
                    try {
                        const response = await fetch('/api/appointments', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                service: appointment.service,
                                price: appointment.price,
                                duration: appointment.duration,
                                date: appointment.date,
                                time: appointment.time,
                                customer: appointment.customer,
                                status: appointment.status
                            })
                        });

                        if (response.ok) {
                            // Mark as synced
                            appointment.synced = true;
                            const updated = JSON.parse(localStorage.getItem('bookedAppointments') || '[]');
                            const index = updated.findIndex(a => a.id === appointment.id);
                            if (index !== -1) {
                                updated[index].synced = true;
                                localStorage.setItem('bookedAppointments', JSON.stringify(updated));
                            }
                        }
                    } catch (err) {
                        // Continue with next appointment
                    }
                }
            } catch (err) {
                // Silently fail - will retry on next check
            }
        };

        // Check on online event
        window.addEventListener('online', () => {
            setTimeout(checkAndSync, 1000);
        });

        // Periodic check (every 30 seconds)
        setInterval(checkAndSync, 30000);
    }

    displayServiceInfo() {
        const serviceInfoEl = document.getElementById('selectedService');
        if (serviceInfoEl) {
            serviceInfoEl.innerHTML = `
                <div class="service-badge">
                    <span class="service-name">${this.serviceData.name}</span>
                    <span class="service-price">$${this.serviceData.price}</span>
                    <span class="service-duration">${this.serviceData.duration} mins</span>
                </div>
            `;
        }
    }

    renderCalendar() {
        const monthYearEl = document.getElementById('currentMonthYear');
        const calendarGridEl = document.getElementById('calendarGrid');
        
        if (!monthYearEl || !calendarGridEl) return;

        // Get the start of the week (Sunday)
        const weekStart = new Date(this.currentDate);
        const day = weekStart.getDay();
        weekStart.setDate(weekStart.getDate() - day);
        weekStart.setHours(0, 0, 0, 0);

        // Get the end of the week (Saturday)
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        // Update header with week range
        const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
        const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
        const startDay = weekStart.getDate();
        const endDay = weekEnd.getDate();
        const year = weekStart.getFullYear();

        if (startMonth === endMonth) {
            monthYearEl.textContent = `${startMonth} ${startDay} - ${endDay}, ${year}`;
        } else {
            monthYearEl.textContent = `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
        }

        // Clear previous calendar
        calendarGridEl.innerHTML = '';

        // Add day headers
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayHeaders.forEach(day => {
            const headerEl = document.createElement('div');
            headerEl.className = 'calendar-day-header';
            headerEl.textContent = day;
            calendarGridEl.appendChild(headerEl);
        });

        // Add days of the week
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            const dateStr = this.formatDate(date);

            const dayEl = document.createElement('div');
            const dayInfo = this.availability[dateStr];
            const isClosed = dayInfo && dayInfo.closed === true;
            const timeSlots = this.getAvailableTimeSlots(dateStr);
            const isAvailable = timeSlots.length > 0 && !isClosed;
            
            dayEl.className = `calendar-day ${isAvailable ? 'available' : 'unavailable'}`;
            if (isClosed) {
                dayEl.classList.add('closed');
            }
            if (date < today) {
                dayEl.classList.add('past');
            }

            // Create day number element
            const dayNumberEl = document.createElement('div');
            dayNumberEl.className = 'calendar-day-number';
            dayNumberEl.textContent = date.getDate();

            // Create month indicator for days from different months
            const monthEl = document.createElement('div');
            monthEl.className = 'calendar-day-month';
            if (i === 0 || date.getDate() === 1) {
                monthEl.textContent = date.toLocaleDateString('en-US', { month: 'short' });
            }

            dayEl.appendChild(dayNumberEl);
            dayEl.appendChild(monthEl);

            // Highlight today
            if (dateStr === this.formatDate(today)) {
                dayEl.classList.add('today');
            }

            // Make clickable if available and not in past
            if (isAvailable && date >= today) {
                dayEl.style.cursor = 'pointer';
                dayEl.addEventListener('click', () => this.selectDate(dateStr, date));
            }

            calendarGridEl.appendChild(dayEl);
        }
    }

    // Select a date and show time slots
    selectDate(dateStr, date) {
        this.selectedDate = dateStr;
        const timeSlots = this.getAvailableTimeSlots(dateStr);
        
        if (timeSlots.length === 0) {
            this.showMessage('No available time slots for this date.', 'error');
            return;
        }

        // Show time slots container
        const timeSlotsContainer = document.getElementById('timeSlotsContainer');
        const timeSlotsGrid = document.getElementById('timeSlotsGrid');
        const selectedDateTitle = document.getElementById('selectedDateTitle');
        
        if (timeSlotsContainer && timeSlotsGrid && selectedDateTitle) {
            selectedDateTitle.textContent = `Select a time for ${this.formatDateDisplay(date)}`;
            timeSlotsContainer.classList.add('show');
            timeSlotsGrid.innerHTML = '';
            
            // Reset selected time when changing dates
            this.selectedTime = null;

            timeSlots.forEach(slot => {
                const isBooked = this.isTimeSlotBooked(dateStr, slot);
                const isSelected = this.selectedTime === slot;
                const slotEl = document.createElement('button');
                slotEl.className = `time-slot-btn ${isBooked ? 'unavailable' : ''} ${isSelected ? 'selected' : ''}`;
                slotEl.textContent = this.formatTime(slot);
                slotEl.disabled = isBooked;
                slotEl.style.opacity = '';
                
                if (isBooked) {
                    slotEl.title = 'This time slot is already booked';
                } else {
                    slotEl.addEventListener('click', () => this.selectTime(slot));
                }
                
                timeSlotsGrid.appendChild(slotEl);
            });
        }
    }

    formatTime(time) {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    }

    // Select a time slot
    selectTime(time) {
        this.selectedTime = time;
        
        // Update time slot button states
        const timeSlotsGrid = document.getElementById('timeSlotsGrid');
        if (timeSlotsGrid) {
            const slotButtons = timeSlotsGrid.querySelectorAll('.time-slot-btn');
            slotButtons.forEach(btn => {
                btn.classList.remove('selected');
                if (btn.textContent.trim() === this.formatTime(time)) {
                    btn.classList.add('selected');
                } else if (!btn.disabled) {
                    btn.style.opacity = '0.7';
                }
            });
        }
        
        // Update summary
        const summaryService = document.getElementById('summaryService');
        const summaryDate = document.getElementById('summaryDate');
        const summaryTime = document.getElementById('summaryTime');
        const summaryDuration = document.getElementById('summaryDuration');
        const summaryPrice = document.getElementById('summaryPrice');
        const bookingSummary = document.getElementById('bookingSummary');

        if (summaryService) summaryService.textContent = this.serviceData.name;
        if (summaryDate) {
            // Parse date string to avoid timezone issues
            const [year, month, day] = this.selectedDate.split('-').map(Number);
            const date = new Date(year, month - 1, day); // month is 0-indexed
            summaryDate.textContent = this.formatDateDisplay(date);
        }
        if (summaryTime) summaryTime.textContent = this.formatTime(time);
        if (summaryDuration) summaryDuration.textContent = this.serviceData.duration;
        if (summaryPrice) summaryPrice.textContent = `$${this.serviceData.price}`;
        if (bookingSummary) bookingSummary.style.display = 'block';

        // Scroll to summary
        bookingSummary?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Submit booking to API
    async submitBooking(customerData) {
        // Prevent duplicate submissions
        if (this.isSubmitting) {
            this.showMessage('Booking submission in progress. Please wait...', 'error');
            return false;
        }

        if (!this.selectedDate || !this.selectedTime) {
            this.showMessage('Please select a date and time.', 'error');
            return false;
        }

        // Double-check that time slot is still available
        if (this.isTimeSlotBooked(this.selectedDate, this.selectedTime)) {
            this.showMessage('This time slot has been booked by someone else. Please select another time.', 'error');
            // Refresh availability to update UI
            await this.fetchExistingAppointments();
            this.renderCalendar();
            if (this.selectedDate) {
                // Parse date string to avoid timezone issues
                const [year, month, day] = this.selectedDate.split('-').map(Number);
                const date = new Date(year, month - 1, day); // month is 0-indexed
                this.selectDate(this.selectedDate, date);
            }
            return false;
        }

        const bookingData = {
            service: this.serviceData.name,
            price: this.serviceData.price,
            duration: this.serviceData.duration,
            date: this.selectedDate,
            time: this.selectedTime,
            customer: {
                name: customerData.name,
                email: customerData.email,
                phone: customerData.phone
            },
            status: 'pending'
        };

        if (!this.useAPI) {
            // Backup: Save to localStorage
            const appointments = JSON.parse(localStorage.getItem('bookedAppointments') || '[]');
            bookingData.id = Date.now().toString();
            appointments.push(bookingData);
            localStorage.setItem('bookedAppointments', JSON.stringify(appointments));
            // Add to local tracking
            this.existingAppointments.push(bookingData);
            return true;
        }

        this.isSubmitting = true;

        try {
            const response = await fetch('/api/appointments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bookingData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.error || errorData.message || errorData.details || `Server returned ${response.status}: ${response.statusText}`;
                console.error('[submitBooking] Server error:', response.status, errorMessage, errorData);
                throw new Error(errorMessage);
            }

            const result = await response.json();
            
            // Add to local tracking to prevent immediate re-booking
            this.existingAppointments.push({
                date: this.selectedDate,
                time: this.selectedTime,
                status: 'pending'
            });
            
            // Remove the booked slot from UI immediately
            this.removeBookedSlotFromUI();
            
            // Refresh availability to ensure consistency
            await this.fetchAvailability();
            
            return true;
        } catch (error) {
            
            // Determine specific error message
            let errorMessage = 'Failed to submit booking. ';
            if (error.message.includes('already booked') || error.message.includes('time slot')) {
                errorMessage = error.message;
                // Refresh availability and appointments
                await this.fetchExistingAppointments();
                await this.fetchAvailability();
                this.renderCalendar();
                if (this.selectedDate) {
                    // Parse date string to avoid timezone issues
                    const [year, month, day] = this.selectedDate.split('-').map(Number);
                    const date = new Date(year, month - 1, day); // month is 0-indexed
                    this.selectDate(this.selectedDate, date);
                }
            } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMessage = 'Cannot connect to server. Booking saved locally and will sync when connection is restored.';
                // Save to localStorage as backup (will sync when server is back)
                const appointments = JSON.parse(localStorage.getItem('bookedAppointments') || '[]');
                bookingData.id = Date.now().toString();
                bookingData.synced = false; // Mark for sync when server is back
                appointments.push(bookingData);
                localStorage.setItem('bookedAppointments', JSON.stringify(appointments));
                this.existingAppointments.push(bookingData);
            } else {
                errorMessage += error.message;
            }
            
            this.showMessage(errorMessage, 'error');
            return false;
        } finally {
            this.isSubmitting = false;
        }
    }

    // Remove booked slot from UI immediately after booking
    removeBookedSlotFromUI() {
        if (!this.selectedDate || !this.selectedTime) return;
        
        const timeSlotsGrid = document.getElementById('timeSlotsGrid');
        if (!timeSlotsGrid) return;
        
        const slotButtons = timeSlotsGrid.querySelectorAll('.time-slot-btn');
        slotButtons.forEach(btn => {
            const btnTime = this.parseTimeFromDisplay(btn.textContent.trim().replace(' (Booked)', ''));
            if (btnTime === this.selectedTime) {
                btn.disabled = true;
                btn.classList.remove('selected');
                btn.classList.add('unavailable');
                btn.title = 'This time slot is already booked';
                const originalText = btn.textContent.trim().replace(' (Booked)', '');
                btn.textContent = originalText;
            }
        });
    }

    // Parse time from display format back to 24-hour format
    parseTimeFromDisplay(displayTime) {
        // Display format: "9:00 AM" or "2:30 PM"
        const match = displayTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!match) return null;
        
        let hour = parseInt(match[1]);
        const minute = match[2];
        const ampm = match[3].toUpperCase();
        
        if (ampm === 'PM' && hour !== 12) {
            hour += 12;
        } else if (ampm === 'AM' && hour === 12) {
            hour = 0;
        }
        
        return `${hour.toString().padStart(2, '0')}:${minute}`;
    }

    setupEventListeners() {
        // Week navigation
        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.currentDate.setDate(this.currentDate.getDate() - 7);
                this.renderCalendar();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.currentDate.setDate(this.currentDate.getDate() + 7);
                this.renderCalendar();
            });
        }

        // Booking form submission
        const bookingForm = document.getElementById('bookingForm');
        if (bookingForm) {
            bookingForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                // Prevent duplicate submissions
                if (this.isSubmitting) {
                    return;
                }
                
                const customerName = document.getElementById('customerName').value.trim();
                const customerEmail = document.getElementById('customerEmail').value.trim();
                const customerPhone = document.getElementById('customerPhone').value.trim();

                if (!customerName || !customerEmail || !customerPhone) {
                    this.showMessage('Please fill in all fields.', 'error');
                    return;
                }

                // Disable submit button and form inputs
                const submitBtn = bookingForm.querySelector('button[type="submit"]');
                const formInputs = bookingForm.querySelectorAll('input');
                const originalText = submitBtn.textContent;
                
                submitBtn.disabled = true;
                submitBtn.classList.add('btn-loading');
                submitBtn.textContent = 'Submitting...';
                submitBtn.setAttribute('aria-busy', 'true');
                
                // Disable form inputs
                formInputs.forEach(input => {
                    input.disabled = true;
                    input.style.opacity = '0.6';
                });

                const success = await this.submitBooking({
                    name: customerName,
                    email: customerEmail,
                    phone: customerPhone
                });

                if (success) {
                    // Show success confirmation
                    submitBtn.textContent = '✓ Booking Confirmed!';
                    submitBtn.style.background = '#4caf50';
                    submitBtn.style.borderColor = '#4caf50';
                    submitBtn.style.color = 'white';
                    
                    this.showMessage('Booking submitted successfully! Redirecting to confirmation page...', 'success');
                    
                    // Redirect to confirmation page after 2 seconds
                    setTimeout(() => {
                        window.location.href = `confirmation.html?date=${this.selectedDate}&time=${this.selectedTime}`;
                    }, 2000);
                } else {
                    // Re-enable form on error
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('btn-loading');
                    submitBtn.textContent = originalText;
                    submitBtn.removeAttribute('aria-busy');
                    submitBtn.style.background = '';
                    submitBtn.style.borderColor = '';
                    submitBtn.style.color = '';
                    
                    formInputs.forEach(input => {
                        input.disabled = false;
                        input.style.opacity = '';
                    });
                }
            });
        }
    }
}

// Initialize booking system when page loads
document.addEventListener('DOMContentLoaded', () => {
    new BookingSystem();
});
