// Admin Panel Functionality with API integration
// localStorage code kept as backup
class AdminPanel {
    constructor() {
        this.appointments = [];
        this.availability = {};
        this.currentFilter = 'all';
        this.currentTab = 'appointments';
        this.useAPI = true; // Set to false to use localStorage backup
        this.currentMonth = new Date(); // Track current month for availability calendar
        this.expandedDate = null; // Track which day is currently expanded
        this.pendingTimeSlotDate = null; // Track which day we're adding a time slot to
        this.isLoadingAvailability = false; // Track loading state for availability operations
        this.isSavingAvailability = false; // Track saving state
        this.isLoadingAppointments = false; // Track loading state for appointments
        this.updatingAppointmentIds = new Set(); // Track which appointments are being updated
        this.visibleDays = []; // Track visible calendar days for copy feature
        this.currentWeekStart = null; // Track current week start date for weekly schedule
        this.currentScheduleView = 'weekOverview'; // Track current schedule view: 'weekOverview' or 'dayDetail'
        this.selectedDayDate = null; // Track selected day date when in detail view
        
        this.init();
    }

    // Load appointments from API or localStorage backup
    async loadAppointments() {
        if (this.isLoadingAppointments) {
            return this.appointments; // Return current appointments
        }

        if (!this.useAPI) {
            // Backup: Load from localStorage
        const stored = localStorage.getItem('bookedAppointments');
        return stored ? JSON.parse(stored) : [];
    }

        this.isLoadingAppointments = true;
        this.showAppointmentsLoadingState();

        try {
            const response = await fetch('/api/appointments');
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server returned ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Validate response format
            if (!data || !Array.isArray(data)) {
                throw new Error('Invalid response format from server');
            }
            
            // Ensure all appointments have customer object in frontend format
            const formattedAppointments = data.map(apt => {
                // Handle both frontend format (customer object) and backend format (flat fields)
                if (apt.customer && typeof apt.customer === 'object') {
                    return apt; // Already in frontend format
                } else {
                    // Convert from backend format to frontend format
                    return {
                        ...apt,
                        customer: {
                            name: apt.customer_name || apt.customer?.name || 'Unknown',
                            email: apt.customer_email || apt.customer?.email || '',
                            phone: apt.customer_phone || apt.customer?.phone || ''
                        },
                        includeInAnalytics: apt.include_in_analytics !== false
                    };
                }
            });
            
            return formattedAppointments;
        } catch (error) {
            // Only show error if it's a real connection issue, not just empty data
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                // Fallback to localStorage
                const stored = localStorage.getItem('bookedAppointments');
                const fallbackData = stored ? JSON.parse(stored) : [];
                this.hideAppointmentsLoadingState();
                if (this.currentTab === 'appointments') {
                    this.showAppointmentsMessage('Cannot connect to server. Using cached appointments. Some data may be outdated.', 'error');
                }
                return fallbackData;
            } else {
                // Server responded but with error
                this.hideAppointmentsLoadingState();
                if (this.currentTab === 'appointments') {
                    this.showAppointmentsMessage(`Error loading appointments: ${error.message}`, 'error');
                }
                // Fallback to localStorage
                const stored = localStorage.getItem('bookedAppointments');
                return stored ? JSON.parse(stored) : [];
            }
        } finally {
            this.isLoadingAppointments = false;
            this.hideAppointmentsLoadingState();
        }
    }

    // Save appointments to localStorage (backup only)
    saveAppointments() {
        localStorage.setItem('bookedAppointments', JSON.stringify(this.appointments));
    }

    // Fetch availability from API
    async fetchAvailability() {
        if (this.isLoadingAvailability) {
            return; // Prevent multiple simultaneous fetches
        }
        
        if (!this.useAPI) {
            // Backup: Load from localStorage
            const stored = localStorage.getItem('availability');
            this.availability = stored ? JSON.parse(stored) : {};
            return;
        }

        this.isLoadingAvailability = true;
        this.showLoadingState('calendar');

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
            
            // Only show success message if we had data and are on availability tab
            const dateCount = Object.keys(this.availability).length;
            if (this.currentTab === 'availability' && dateCount > 0) {
                // Don't show message for successful fetch - it's expected behavior
                // Only show errors
            }
        } catch (error) {
            // Fallback to localStorage
            const stored = localStorage.getItem('availability');
            this.availability = stored ? JSON.parse(stored) : {};
            
            // Show error message if we're on the availability tab
            if (this.currentTab === 'availability') {
                const errorMsg = error.message.includes('Failed to fetch') || error.message.includes('NetworkError')
                    ? 'Cannot connect to server. Using cached availability. Some data may be outdated.'
                    : `Error loading availability: ${error.message}. Using cached data.`;
                this.showMessage(errorMsg, 'error');
            }
        } finally {
            this.isLoadingAvailability = false;
            this.hideLoadingState('calendar');
        }
    }

    // Show success/error messages (matching booking page style)
    showMessage(message, type = 'success') {
        // Remove existing messages
        const existingMsg = document.querySelector('.admin-message');
        if (existingMsg) {
            existingMsg.remove();
        }

        const messageEl = document.createElement('div');
        messageEl.className = `admin-message ${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
            background: ${type === 'success' ? '#4caf50' : '#f44336'};
            color: white;
            text-align: center;
            font-weight: 500;
            font-family: 'Inter', sans-serif;
        `;

        // Insert at the top of the availability calendar view
        const availabilityView = document.querySelector('.availability-calendar-view');
        if (availabilityView) {
            availabilityView.insertBefore(messageEl, availabilityView.firstChild);
        } else {
            // Fallback: insert at top of admin section
            const adminSection = document.querySelector('.admin-section .container');
            if (adminSection) {
                adminSection.insertBefore(messageEl, adminSection.firstChild);
            }
        }

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 5000);
    }

    // Show success/error messages for appointments tab
    showAppointmentsMessage(message, type = 'success') {
        // Remove existing messages
        const existingMsg = document.querySelector('.appointments-message');
        if (existingMsg) {
            existingMsg.remove();
        }

        const messageEl = document.createElement('div');
        messageEl.className = `appointments-message ${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
            background: ${type === 'success' ? '#4caf50' : '#f44336'};
            color: white;
            text-align: center;
            font-weight: 500;
            font-family: 'Inter', sans-serif;
        `;

        // Insert at the top of the appointments tab
        const appointmentsTab = document.getElementById('appointments-tab');
        if (appointmentsTab) {
            appointmentsTab.insertBefore(messageEl, appointmentsTab.firstChild);
        } else {
            // Fallback: insert at top of admin section
            const adminSection = document.querySelector('.admin-section .container');
            if (adminSection) {
                adminSection.insertBefore(messageEl, adminSection.firstChild);
            }
        }

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 5000);
    }

    // Show loading state for appointments list
    showAppointmentsLoadingState() {
        const appointmentsList = document.getElementById('appointmentsList');
        if (appointmentsList && !appointmentsList.querySelector('.appointments-loading')) {
            const loadingEl = document.createElement('div');
            loadingEl.className = 'appointments-loading';
            loadingEl.innerHTML = '<span class="loading-spinner"></span><span>Loading appointments...</span>';
            appointmentsList.appendChild(loadingEl);
        }
    }

    // Hide loading state for appointments list
    hideAppointmentsLoadingState() {
        const appointmentsList = document.getElementById('appointmentsList');
        if (appointmentsList) {
            const loadingEl = appointmentsList.querySelector('.appointments-loading');
            if (loadingEl) {
                loadingEl.remove();
            }
        }
    }

    // Save/update availability via API
    async saveAvailability(availabilityData) {
        if (this.isSavingAvailability) {
            return { success: false, message: 'Save already in progress. Please wait.' };
        }

        if (!this.useAPI) {
            // Backup: Save to localStorage
            this.availability = availabilityData;
            localStorage.setItem('availability', JSON.stringify(availabilityData));
            return { success: true, message: 'Availability saved locally' };
        }

        this.isSavingAvailability = true;
        this.setSaveButtonsLoading(true);

        try {
            const response = await fetch('/api/availability', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ availability: availabilityData })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.error || errorData.message || `Server returned ${response.status}: ${response.statusText}`;
                throw new Error(errorMessage);
            }

            const result = await response.json();
            
            // Validate response
            if (!result || !result.availability) {
                throw new Error('Invalid response format from server');
            }

            // Update local availability with server response
            this.availability = result.availability;
            const savedCount = Object.keys(result.availability || {}).length;
            
            return { 
                success: true, 
                message: `Availability saved successfully for ${savedCount} date(s)!` 
            };
        } catch (error) {
            // Determine error message based on error type
            let errorMessage = 'Failed to save availability. ';
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMessage += 'Cannot connect to server. ';
            } else {
                errorMessage += error.message + '. ';
            }
            errorMessage += 'Data saved locally as backup.';
            
            // Fallback to localStorage
            this.availability = availabilityData;
            localStorage.setItem('availability', JSON.stringify(availabilityData));
            
            return { 
                success: false, 
                message: errorMessage
            };
        } finally {
            this.isSavingAvailability = false;
            this.setSaveButtonsLoading(false);
        }
    }

    // Update appointment status via API
    async updateAppointmentStatus(id, status) {
        // Prevent duplicate updates
        if (this.updatingAppointmentIds.has(id)) {
            return false;
        }

        const appointment = this.appointments.find(apt => apt.id === id);
        if (!appointment) {
            this.showAppointmentsMessage('Appointment not found.', 'error');
            return false;
        }

        const oldStatus = appointment.status;
        
        // Don't allow updating to the same status
        if (oldStatus === status) {
            return true; // Already in desired state
        }

        // Optimistically update UI immediately
        appointment.status = status;
        this.updateStats();
        this.renderAppointments();
        
        // Mark as updating
        this.updatingAppointmentIds.add(id);

        if (!this.useAPI) {
            // Backup: Save to localStorage
            this.saveAppointments();
            this.updatingAppointmentIds.delete(id);
            this.showAppointmentsMessage(`Appointment ${status} successfully.`, 'success');
            return true;
        }

        try {
            const response = await fetch(`/api/appointments/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.error || errorData.message || `Server returned ${response.status}: ${response.statusText}`;
                throw new Error(errorMessage);
            }

            const result = await response.json();
            
            // Update appointment with server response (in case server modified other fields)
            const updatedAppointment = this.appointments.find(apt => apt.id === id);
            if (updatedAppointment && result) {
                // Ensure customer object is in frontend format
                if (result.customer && typeof result.customer === 'object') {
                    updatedAppointment.customer = result.customer;
                } else {
                    updatedAppointment.customer = {
                        name: result.customer_name || updatedAppointment.customer?.name || 'Unknown',
                        email: result.customer_email || updatedAppointment.customer?.email || '',
                        phone: result.customer_phone || updatedAppointment.customer?.phone || ''
                    };
                }
                updatedAppointment.status = result.status || status;
                updatedAppointment.includeInAnalytics = result.includeInAnalytics !== false;
            }

            this.updateStats();
            this.renderAppointments();
            this.updatingAppointmentIds.delete(id);
            
            this.showAppointmentsMessage(`Appointment ${status} successfully!`, 'success');
            return true;
        } catch (error) {
            // Revert on error
            appointment.status = oldStatus;
            this.updateStats();
            this.renderAppointments();
            this.updatingAppointmentIds.delete(id);
            
            // Determine error message
            let errorMessage = 'Failed to update appointment status. ';
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMessage += 'Cannot connect to server. ';
            } else {
                errorMessage += error.message + '. ';
            }
            errorMessage += 'Status reverted.';
            
            this.showAppointmentsMessage(errorMessage, 'error');
            
            // Fallback to localStorage
            this.saveAppointments();
            return false;
        }
    }


    // Get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
    getOrdinal(n) {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
    }

    // Convert 12-hour format to 24-hour format
    convertTo24Hour(hour, minute, ampm) {
        let h24 = parseInt(hour);
        if (ampm === 'PM' && h24 !== 12) {
            h24 += 12;
        } else if (ampm === 'AM' && h24 === 12) {
            h24 = 0;
        }
        return `${h24.toString().padStart(2, '0')}:${minute}`;
    }

    // Convert 24-hour format to 12-hour format
    convertTo12Hour(time24) {
        const [hours, minutes] = time24.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;
        return {
            hour: hour12.toString(),
            minute: minutes.toString().padStart(2, '0'),
            ampm: ampm
        };
    }

    // Add minutes to a 24-hour format time
    addMinutesToTime(time24, minutes) {
        const [hours, minutesCurrent] = time24.split(':').map(Number);
        const totalMinutes = hours * 60 + minutesCurrent + minutes;
        const newHours = Math.floor(totalMinutes / 60);
        const newMinutes = totalMinutes % 60;
        
        // Cap at 23:59 (don't roll over to next day)
        if (newHours >= 24) {
            return '23:59';
        }
        
        return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    formatDateDisplay(date) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }

    formatTime(time) {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    }

    async init() {
        // Load data from API
        this.appointments = await this.loadAppointments();
        await this.fetchAvailability();
        
        this.setupTabs();
        this.updateStats();
        this.renderAppointments();
        this.setupEventListeners();
        this.setupAutoRefresh();
        this.setupAvailabilityTab();
        this.setupServerReconnectionSync();
    }

    // Sync localStorage with server when connection is restored
    setupServerReconnectionSync() {
        if (!this.useAPI) return;

        // Check if we have pending localStorage data
        const checkAndSync = async () => {
            if (!navigator.onLine) return;

            try {
                // Sync appointments
                const storedAppointments = localStorage.getItem('bookedAppointments');
                if (storedAppointments) {
                    const localAppointments = JSON.parse(storedAppointments);
                    const pendingSync = localAppointments.filter(apt => !apt.synced);

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
                }

                // Sync availability
                const storedAvailability = localStorage.getItem('availability');
                if (storedAvailability) {
                    try {
                        const localAvailability = JSON.parse(storedAvailability);
                        const response = await fetch('/api/availability', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ availability: localAvailability })
                        });

                        if (response.ok) {
                            // Clear localStorage flag if needed
                            const synced = localStorage.getItem('availabilitySynced');
                            if (!synced) {
                                localStorage.setItem('availabilitySynced', 'true');
                            }
                        }
                    } catch (err) {
                        // Silently fail - will retry on next check
                    }
                }
            } catch (err) {
                // Silently fail - will retry on next check
            }
        };

        // Check on online event
        window.addEventListener('online', () => {
            setTimeout(() => {
                checkAndSync();
                // Refresh data after sync
                if (this.currentTab === 'appointments') {
                    this.refreshAppointments();
                } else if (this.currentTab === 'availability') {
                    this.fetchAvailability();
                }
            }, 1000);
        });

        // Periodic check (every 30 seconds)
        setInterval(checkAndSync, 30000);
    }

    // Setup automatic refresh when appointments are added from booking page
    setupAutoRefresh() {
        // Listen for storage changes (when booking page saves new appointment in another tab/window - backup mode)
        window.addEventListener('storage', (e) => {
            if (e.key === 'bookedAppointments' && e.newValue) {
                // Reload appointments from localStorage (backup)
                this.refreshAppointments();
            }
        });

        // Refresh when page becomes visible (user switches back to admin tab)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // Page became visible, check for new appointments
                this.refreshAppointments();
            }
        });

        // Also refresh when window gains focus (user clicks back to the tab)
        window.addEventListener('focus', () => {
            this.refreshAppointments();
        });

        // Periodic check (every 5 seconds) as a fallback
        setInterval(() => {
            this.refreshAppointments();
        }, 5000);
    }

    // Refresh appointments from API/localStorage and update display
    async refreshAppointments() {
        // Don't refresh if we're currently updating an appointment or loading
        if (this.updatingAppointmentIds.size > 0 || this.isLoadingAppointments) {
            return;
        }
        
        const currentAppointments = await this.loadAppointments();
        const currentCount = currentAppointments.length;
        const previousCount = this.appointments.length;
        
        // Check if appointments have changed (deep comparison for status changes)
        const hasChanged = currentCount !== previousCount || 
            currentAppointments.some((apt, idx) => {
                const oldApt = this.appointments[idx];
                return !oldApt || 
                    apt.id !== oldApt.id || 
                    apt.status !== oldApt.status ||
                    JSON.stringify(apt.customer) !== JSON.stringify(oldApt.customer);
            });
        
        if (hasChanged) {
            this.appointments = currentAppointments;
            this.updateStats();
            this.renderAppointments();
        }
    }

    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-tab') === tabName) {
                btn.classList.add('active');
            }
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const activeTab = document.getElementById(`${tabName}-tab`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // Initialize analytics panel if switching to analytics tab
        if (tabName === 'analytics') {
            setTimeout(() => {
                if (!window.analyticsPanel && typeof AnalyticsPanel !== 'undefined') {
                    window.analyticsPanel = new AnalyticsPanel();
                } else if (window.analyticsPanel) {
                    // Refresh with latest data
                    window.analyticsPanel.appointments = this.appointments;
                    window.analyticsPanel.render();
                }
            }, 100);
        }

        // Initialize availability tab
        if (tabName === 'availability') {
            // Fetch latest availability and render calendar
            this.fetchAvailability().then(() => {
                // Always render calendar after fetch completes (even if it failed and used cache)
                this.renderAvailabilityCalendar();
                this.setupAvailabilityNavigation();
            }).catch((error) => {
                // Still render calendar with cached data
                this.renderAvailabilityCalendar();
                this.setupAvailabilityNavigation();
            });
        }

        // Initialize weekly schedule tab
        if (tabName === 'schedule') {
            this.setupWeeklyScheduleTab();
        }
    }

    updateStats() {
        // Only count non-past appointments in statistics
        const activeAppointments = this.appointments.filter(apt => !this.isPastAppointment(apt));
        const pending = activeAppointments.filter(apt => apt.status === 'pending').length;
        const accepted = activeAppointments.filter(apt => apt.status === 'accepted').length;
        const total = activeAppointments.length;

        document.getElementById('pendingCount').textContent = pending;
        document.getElementById('acceptedCount').textContent = accepted;
        document.getElementById('totalCount').textContent = total;
    }

    renderAppointments() {
        const container = document.getElementById('appointmentsList');
        container.innerHTML = '';

        let filteredAppointments = this.appointments;
        
        if (this.currentFilter === 'past') {
            // Show only past appointments
            filteredAppointments = this.appointments.filter(apt => this.isPastAppointment(apt));
        } else if (this.currentFilter !== 'all') {
            // Filter by status, but exclude past appointments from other filters
            filteredAppointments = this.appointments.filter(apt => {
                return apt.status === this.currentFilter && !this.isPastAppointment(apt);
            });
        } else {
            // Show all non-past appointments for 'all' filter
            filteredAppointments = this.appointments.filter(apt => !this.isPastAppointment(apt));
        }

        // Sort by date and time (newest first)
        filteredAppointments.sort((a, b) => {
            // Parse dates and times to avoid timezone issues
            const [yearA, monthA, dayA] = a.date.split('-').map(Number);
            const [hoursA, minutesA] = a.time.split(':').map(Number);
            const dateA = new Date(yearA, monthA - 1, dayA, hoursA, minutesA);
            
            const [yearB, monthB, dayB] = b.date.split('-').map(Number);
            const [hoursB, minutesB] = b.time.split(':').map(Number);
            const dateB = new Date(yearB, monthB - 1, dayB, hoursB, minutesB);
            
            return dateB - dateA;
        });

        if (filteredAppointments.length === 0) {
            container.innerHTML = '<div class="no-appointments">No appointments found.</div>';
            return;
        }

        filteredAppointments.forEach(appointment => {
            const card = this.createAppointmentCard(appointment);
            container.appendChild(card);
        });
    }

    async deleteAppointment(id) {
        if (!confirm('Are you sure you want to delete this appointment? This action cannot be undone.')) {
            return;
        }

        if (!this.useAPI) {
            // Backup: Remove from localStorage
            this.appointments = this.appointments.filter(apt => apt.id !== id);
            this.saveAppointments();
            this.updateStats();
            this.renderAppointments();
            return;
        }

        try {
            const response = await fetch(`/api/appointments/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete appointment');
            }

            // Remove from local array
            this.appointments = this.appointments.filter(apt => apt.id !== id);
            this.updateStats();
            this.renderAppointments();
        } catch (error) {
            // Fallback: Remove from localStorage
            this.appointments = this.appointments.filter(apt => apt.id !== id);
            this.saveAppointments();
            this.updateStats();
            this.renderAppointments();
        }
    }

    toggleAnalytics(id, include) {
        const appointment = this.appointments.find(apt => apt.id === id);
        if (appointment) {
            appointment.includeInAnalytics = include;
            this.saveAppointments();
        // Refresh analytics if on analytics tab
        if (this.currentTab === 'analytics' && window.analyticsPanel) {
            setTimeout(() => window.analyticsPanel.refresh(), 100);
        }
        }
    }

    createAppointmentCard(appointment) {
        const card = document.createElement('div');
        card.className = `appointment-card ${appointment.status}`;
        
        // Parse date string to avoid timezone issues
        // Ensure date is a string in YYYY-MM-DD format
        let dateStr = appointment.date;
        if (dateStr instanceof Date) {
            // If it's already a Date object, convert to string
            dateStr = dateStr.toISOString().split('T')[0];
        } else if (typeof dateStr === 'string' && dateStr.includes('T')) {
            // If it's an ISO string, extract just the date part
            dateStr = dateStr.split('T')[0];
        }
        
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day); // month is 0-indexed, creates date in local time
        const formattedDate = this.formatDateDisplay(date);
        const formattedTime = this.formatTime(appointment.time);
        const isPast = this.isPastAppointment(appointment);
        const isUpdating = this.updatingAppointmentIds.has(appointment.id);

        // Ensure customer object exists and is in correct format
        const customer = appointment.customer || {};
        const customerName = customer.name || appointment.customer_name || 'Unknown';
        const customerEmail = customer.email || appointment.customer_email || '';
        const customerPhone = customer.phone || appointment.customer_phone || '';

        // Ensure includeInAnalytics field exists (default to true for old appointments)
        if (appointment.includeInAnalytics === undefined) {
            appointment.includeInAnalytics = true;
        }

        // Determine if buttons should be disabled
        const buttonsDisabled = isUpdating || isPast;

        card.innerHTML = `
            <div class="appointment-info">
                <div class="appointment-header">
                    <span class="appointment-customer">${customerName}</span>
                    <span class="appointment-status ${appointment.status}">${appointment.status}</span>
                    ${isPast ? '<span class="appointment-status past">Past</span>' : ''}
                    ${isUpdating ? '<span class="appointment-status updating">Updating...</span>' : ''}
                </div>
                <div class="appointment-details">
                    <div class="appointment-detail">
                        <strong>Service:</strong>
                        <span>${appointment.service}</span>
                    </div>
                    <div class="appointment-detail">
                        <strong>Date:</strong>
                        <span>${formattedDate}</span>
                    </div>
                    <div class="appointment-detail">
                        <strong>Time:</strong>
                        <span>${formattedTime}</span>
                    </div>
                    <div class="appointment-detail">
                        <strong>Duration:</strong>
                        <span>${appointment.duration} minutes</span>
                    </div>
                    <div class="appointment-detail">
                        <strong>Price:</strong>
                        <span>$${appointment.price}</span>
                    </div>
                    <div class="appointment-detail">
                        <strong>Email:</strong>
                        <span>${customerEmail}</span>
                    </div>
                    <div class="appointment-detail">
                        <strong>Phone:</strong>
                        <span>${customerPhone}</span>
                    </div>
                    <div class="appointment-detail analytics-toggle-row">
                        <strong>Include in Analytics:</strong>
                        <label class="toggle-switch">
                            <input type="checkbox" ${appointment.includeInAnalytics ? 'checked' : ''} 
                                   onchange="adminPanel.toggleAnalytics('${appointment.id}', this.checked)"
                                   ${buttonsDisabled ? 'disabled' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
            <div class="appointment-actions">
                <button class="btn-delete" onclick="adminPanel.deleteAppointment('${appointment.id}')" 
                        title="Delete appointment" ${buttonsDisabled ? 'disabled' : ''}>×</button>
                ${!isPast ? (appointment.status === 'pending' ? `
                    <button class="btn-accept ${isUpdating ? 'btn-loading' : ''}" 
                            onclick="adminPanel.acceptAppointment('${appointment.id}')"
                            ${isUpdating ? 'disabled' : ''}
                            ${isUpdating ? 'aria-busy="true"' : ''}>
                        ${isUpdating ? 'Updating...' : 'Accept'}
                    </button>
                    <button class="btn-decline ${isUpdating ? 'btn-loading' : ''}" 
                            onclick="adminPanel.declineAppointment('${appointment.id}')"
                            ${isUpdating ? 'disabled' : ''}
                            ${isUpdating ? 'aria-busy="true"' : ''}>
                        ${isUpdating ? 'Updating...' : 'Decline'}
                    </button>
                ` : appointment.status === 'accepted' ? `
                    <button class="btn-decline ${isUpdating ? 'btn-loading' : ''}" 
                            onclick="adminPanel.declineAppointment('${appointment.id}')"
                            ${isUpdating ? 'disabled' : ''}
                            ${isUpdating ? 'aria-busy="true"' : ''}>
                        ${isUpdating ? 'Updating...' : 'Decline'}
                    </button>
                ` : '') : ''}
            </div>
        `;

        return card;
    }

    isPastAppointment(appointment) {
        // Parse date and time to avoid timezone issues
        const [year, month, day] = appointment.date.split('-').map(Number);
        const [hours, minutes] = appointment.time.split(':').map(Number);
        const appointmentDate = new Date(year, month - 1, day, hours, minutes); // month is 0-indexed
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return appointmentDate < tomorrow;
    }

    async acceptAppointment(id) {
        // Prevent double-clicks
        if (this.updatingAppointmentIds.has(id)) {
            return;
        }
        await this.updateAppointmentStatus(id, 'accepted');
    }

    async declineAppointment(id) {
        // Prevent double-clicks
        if (this.updatingAppointmentIds.has(id)) {
            return;
        }
        await this.updateAppointmentStatus(id, 'declined');
    }

    // Setup availability tab functionality
    setupAvailabilityTab() {
        // This will be called when switching to availability tab
        // Render availability calendar
        this.renderAvailabilityCalendar();
        this.setupAvailabilityNavigation();
    }

    // Setup month navigation for availability calendar
    // Navigation buttons are hidden since we always show today + 30 days
    setupAvailabilityNavigation() {
        // Navigation buttons are hidden - no event listeners needed
        // Calendar always shows today + 30 days forward
    }

    // Render availability calendar for admin - Today + 30 Days View
    renderAvailabilityCalendar() {
        const calendarPreview = document.getElementById('calendarPreview');
        const monthYearEl = document.getElementById('currentMonthYearAvailability');
        
        if (!calendarPreview) return;

        // Remove any existing loading indicator
        this.hideLoadingState('calendar');

        // Calculate start date (today) and end date (30 days from today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 29); // 30 days total (today + 29 more)

        // Update header to show date range
        if (monthYearEl) {
            const startMonth = today.toLocaleDateString('en-US', { month: 'short' });
            const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
            const startDay = today.getDate();
            const endDay = endDate.getDate();
            const startYear = today.getFullYear();
            const endYear = endDate.getFullYear();

            let dateRangeText;
            if (startMonth === endMonth && startYear === endYear) {
                // Same month and year
                dateRangeText = `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
            } else if (startYear === endYear) {
                // Same year, different months
                dateRangeText = `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
            } else {
                // Different years
                dateRangeText = `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`;
            }
            monthYearEl.textContent = dateRangeText;
        }

        // Clear previous calendar
        calendarPreview.innerHTML = '';

        // Add day headers (Sun, Mon, Tue, etc.)
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayHeaders.forEach(day => {
            const headerEl = document.createElement('div');
            headerEl.className = 'calendar-day-header';
            headerEl.textContent = day;
            calendarPreview.appendChild(headerEl);
        });

        // Get the day of the week for today (0 = Sunday, 1 = Monday, etc.)
        const todayDayOfWeek = today.getDay();
        
        // Add empty placeholder cells to align today with the correct day header
        for (let i = 0; i < todayDayOfWeek; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day empty';
            calendarPreview.appendChild(emptyCell);
        }

        // Track visible days for copy feature
        this.visibleDays = [];
        
        // Add days starting from today (30 days total)
        for (let i = 0; i < 30; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            const dateStr = this.formatDate(date);
            
            // Store visible day info for copy feature
            this.visibleDays.push({
                dateStr: dateStr,
                date: new Date(date),
                isPast: i === 0 ? false : date < today // Today is not past
            });
            const dayInfo = this.availability[dateStr] || { available: true, timeSlots: [] };
            const timeSlots = dayInfo.timeSlots || [];
            const slotCount = timeSlots.length;
            const isClosed = dayInfo.closed === true;
            const isAvailable = !isClosed && dayInfo.available !== false && slotCount > 0;
            const isToday = i === 0; // First day in the loop is always today

            const dayEl = document.createElement('div');
            dayEl.className = `calendar-day ${isClosed ? 'closed' : (isAvailable ? 'available' : 'unavailable')} ${isToday ? 'today' : ''}`;
            dayEl.setAttribute('data-date', dateStr);
            
            // Always show the simple day view initially (for all days)
            const originalContentWrapper = document.createElement('div');
            originalContentWrapper.className = 'calendar-day-original-content';
            
            // Day number
            const dayNumberEl = document.createElement('div');
            dayNumberEl.className = 'calendar-day-number';
            dayNumberEl.textContent = date.getDate();
            originalContentWrapper.appendChild(dayNumberEl);

            // Slot count badge (only show if not closed)
            if (!isClosed) {
                const badgeEl = document.createElement('div');
                badgeEl.className = `calendar-day-badge ${slotCount > 0 ? 'has-slots' : 'no-slots'}`;
                badgeEl.textContent = slotCount > 0 ? `${slotCount}` : '0';
                badgeEl.title = slotCount > 0 ? `${slotCount} time slot${slotCount !== 1 ? 's' : ''}` : 'No time slots';
                originalContentWrapper.appendChild(badgeEl);
            } else {
                // Show "Closed" indicator for closed days
                const closedBadgeEl = document.createElement('div');
                closedBadgeEl.className = 'calendar-day-badge closed-badge';
                closedBadgeEl.textContent = 'CLOSED';
                closedBadgeEl.title = 'Day is closed';
                originalContentWrapper.appendChild(closedBadgeEl);
            }

            // Month indicator (only show on first day of each month)
            const isFirstDayOfMonth = date.getDate() === 1 || i === 0;
            if (isFirstDayOfMonth) {
                const monthEl = document.createElement('div');
                monthEl.className = 'calendar-day-month';
                monthEl.textContent = date.toLocaleDateString('en-US', { month: 'short' });
                originalContentWrapper.appendChild(monthEl);
            }

            // Add original content wrapper to day element
            dayEl.appendChild(originalContentWrapper);
            
            // Make ALL days clickable to show editor (not just add time slot)
            dayEl.style.cursor = 'pointer';
            dayEl.addEventListener('click', (e) => {
                // Don't toggle if click is inside the expanded editor content
                const editorContent = dayEl.querySelector('.day-editor-expanded-content');
                if (editorContent && editorContent.contains(e.target)) {
                    return; // Ignore clicks inside the editor
                }
                
                // Find the day cell and show editor
                const dayCell = Array.from(document.querySelectorAll('.calendar-day')).find(cell => {
                    const cellDateStr = cell.getAttribute('data-date');
                    return cellDateStr === dateStr;
                });
                if (dayCell) {
                    // If already expanded, collapse it
                    if (dayCell.classList.contains('expanded')) {
                        const editorContent = dayCell.querySelector('.day-editor-expanded-content');
                        const originalContent = dayCell.querySelector('.calendar-day-original-content');
                        if (editorContent) editorContent.remove();
                        if (originalContent) originalContent.style.display = '';
                        dayCell.classList.remove('expanded');
                        this.expandedDate = null;
                    } else {
                        // Collapse any previously expanded day
                        document.querySelectorAll('.calendar-day').forEach(cell => {
                            if (cell.classList.contains('expanded') && cell !== dayCell) {
                                const editorContent = cell.querySelector('.day-editor-expanded-content');
                                const originalContent = cell.querySelector('.calendar-day-original-content');
                                if (editorContent) editorContent.remove();
                                if (originalContent) originalContent.style.display = '';
                                cell.classList.remove('expanded');
                            }
                        });
                        // Clear expandedDate when collapsing previous day (will be set below if expanding)
                        if (this.expandedDate && this.expandedDate !== dateStr) {
                            this.expandedDate = null;
                        }
                        // Expand clicked day
                        dayCell.classList.add('expanded');
                        this.expandedDate = dateStr;
                        this.showDayEditor(dateStr, dayCell);
                    }
                }
            });

            calendarPreview.appendChild(dayEl);
        }
        
        // Restore expanded state if there was an expanded day before re-rendering
        if (this.expandedDate) {
            const dayCell = Array.from(document.querySelectorAll('.calendar-day')).find(cell => {
                const cellDateStr = cell.getAttribute('data-date');
                return cellDateStr === this.expandedDate;
            });
            if (dayCell) {
                // Hide original content
                const originalContent = dayCell.querySelector('.calendar-day-original-content');
                if (originalContent) {
                    originalContent.style.display = 'none';
                }
                // Expand the day and show editor
                dayCell.classList.add('expanded');
                this.showDayEditor(this.expandedDate, dayCell);
            }
        }
    }


    // Show day editor - now injects content directly into day cell
    showDayEditor(dateStr, dayCell) {
        if (!dayCell) {
            // Fallback: try to find the cell
            dayCell = Array.from(document.querySelectorAll('.calendar-day')).find(cell => {
                const cellDateStr = cell.getAttribute('data-date');
                return cellDateStr === dateStr;
            });
        }
        if (!dayCell) return;

        // Parse date string to avoid timezone issues
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day); // month is 0-indexed
        const formattedDate = this.formatDateDisplay(date);
        const dayInfo = this.availability[dateStr] || { available: true, timeSlots: [], closed: false };
        const timeSlots = dayInfo.timeSlots || [];

        // Remove any existing editor content first (in case we're refreshing)
        const existingEditor = dayCell.querySelector('.day-editor-expanded-content');
        if (existingEditor) {
            existingEditor.remove();
        }

        // Store original content wrapper
        const originalContent = dayCell.querySelector('.calendar-day-original-content');
        
        // Create editor content container
        const editorContainer = document.createElement('div');
        editorContainer.className = 'day-editor-expanded-content';
        editorContainer.setAttribute('data-date', dateStr);
        editorContainer.innerHTML = `
            <div class="expanded-editor-content">
                <div class="expanded-editor-header">
                    <h4>Edit Availability: ${formattedDate}</h4>
                </div>
                <div class="expanded-editor-body">
                    <div id="timeSlotsSection">
                        <h5>Time Slots</h5>
                        <div id="timeSlotsList">
                            ${timeSlots.length === 0 ? '<p class="no-slots">No time slots. Click "Add Time Slot" to add one.</p>' : ''}
                            ${timeSlots.map(slot => `
                                <div class="time-slot-item">
                                    <span class="time">${this.formatTime(slot)}</span>
                                    <button class="btn-remove-time" onclick="adminPanel.removeTimeSlot('${dateStr}', '${slot}')">×</button>
                                </div>
                            `).join('')}
                        </div>
                        <button class="btn-add-time-slot" onclick="adminPanel.addTimeSlot('${dateStr}')">+ Add Time Slot</button>
                    </div>
                    ${timeSlots.length > 0 ? `
                    <div class="copy-times-section">
                        <h5>Copy to Other Days</h5>
                        <p class="copy-times-hint">Select days to copy these time slots to:</p>
                        <div class="copy-days-checkboxes" id="copyDaysCheckboxes-${dateStr}">
                            <!-- Checkboxes will be rendered by renderCopyDaysCheckboxes -->
                        </div>
                        <div class="copy-actions">
                            <button class="btn-copy-times" id="btnCopyTimes-${dateStr}" onclick="adminPanel.copyTimeSlots('${dateStr}')" disabled>
                                Copy to Selected Days (<span class="selected-days-count">0</span>)
                            </button>
                        </div>
                    </div>
                    ` : ''}
                    <div class="editor-actions">
                        <button class="btn-save-day" onclick="adminPanel.saveDayAvailability('${dateStr}')">Save Changes</button>
                        <button class="btn-reset-day" onclick="adminPanel.cancelDayEditor()">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        // Hide original content and add expanded class
        if (originalContent) {
            originalContent.style.display = 'none';
        }
        dayCell.classList.add('expanded');
        dayCell.appendChild(editorContainer);
        
        // Prevent clicks inside editor from bubbling to day cell
        editorContainer.addEventListener('click', (e) => {
            e.stopPropagation(); // Stop event from reaching day cell click handler
        });
        
        // Trigger animation by forcing reflow
        editorContainer.offsetHeight;
        editorContainer.classList.add('animating');
        
        // Render copy days checkboxes if time slots exist
        if (timeSlots.length > 0) {
            this.renderCopyDaysCheckboxes(dateStr);
        }
    }

    // Hide day editor - removes content from expanded day cell
    hideDayEditor() {
        // Find any expanded day cell
        const expandedCell = document.querySelector('.calendar-day.expanded');
        if (expandedCell) {
            const editorContent = expandedCell.querySelector('.day-editor-expanded-content');
            const originalContent = expandedCell.querySelector('.calendar-day-original-content');
            
            if (editorContent) {
                // Remove editor content
                editorContent.remove();
            }
            
            // Restore original content visibility
            if (originalContent) {
                originalContent.style.display = '';
            }
            
            // Remove expanded class (CSS will handle collapse animation)
            expandedCell.classList.remove('expanded');
        }
        
        // Also hide the old separate editor container if it exists (fallback)
        const editorEl = document.getElementById('expandedDayEditor');
        if (editorEl) {
            editorEl.style.display = 'none';
            editorEl.innerHTML = '';
        }
    }

    // Cancel day editor
    cancelDayEditor() {
        this.renderAvailabilityCalendar();
    }

    // Render checkboxes for copying time slots to other days
    renderCopyDaysCheckboxes(sourceDateStr) {
        const checkboxesContainer = document.getElementById(`copyDaysCheckboxes-${sourceDateStr}`);
        if (!checkboxesContainer) return;

        // Clear existing checkboxes
        checkboxesContainer.innerHTML = '';

        // Get today's date for comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Filter visible days: exclude past dates and the source day
        const availableDays = this.visibleDays.filter(day => {
            if (day.dateStr === sourceDateStr) return false; // Exclude source day
            // Use the stored date object to avoid timezone issues
            const dayDate = new Date(day.date);
            dayDate.setHours(0, 0, 0, 0);
            return dayDate >= today; // Only future dates (including today)
        });

        if (availableDays.length === 0) {
            checkboxesContainer.innerHTML = '<p class="no-days-to-copy">No other days available to copy to.</p>';
            return;
        }

        // Create checkboxes for each available day
        availableDays.forEach(day => {
            const [year, month, dayNum] = day.dateStr.split('-').map(Number);
            const date = new Date(year, month - 1, dayNum);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            const checkboxItem = document.createElement('div');
            checkboxItem.className = 'copy-day-checkbox-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `copyDay-${day.dateStr}`;
            checkbox.value = day.dateStr;
            checkbox.className = 'copy-day-checkbox';
            checkbox.addEventListener('change', () => this.updateSelectedDaysCount(sourceDateStr));
            checkbox.addEventListener('click', (e) => e.stopPropagation()); // Prevent event bubbling

            const label = document.createElement('label');
            label.htmlFor = `copyDay-${day.dateStr}`;
            label.textContent = `${dayName}, ${formattedDate}`;
            label.addEventListener('click', (e) => e.stopPropagation()); // Prevent event bubbling

            checkboxItem.appendChild(checkbox);
            checkboxItem.appendChild(label);
            checkboxesContainer.appendChild(checkboxItem);
        });

        // Update count initially
        this.updateSelectedDaysCount(sourceDateStr);
    }

    // Update the count of selected days
    updateSelectedDaysCount(sourceDateStr) {
        const checkboxesContainer = document.getElementById(`copyDaysCheckboxes-${sourceDateStr}`);
        if (!checkboxesContainer) return;

        const checkboxes = checkboxesContainer.querySelectorAll('.copy-day-checkbox:checked');
        const count = checkboxes.length;
        
        const countSpan = checkboxesContainer.closest('.copy-times-section')?.querySelector('.selected-days-count');
        if (countSpan) {
            countSpan.textContent = count;
        }

        // Enable/disable copy button
        const copyBtn = document.getElementById(`btnCopyTimes-${sourceDateStr}`);
        if (copyBtn) {
            copyBtn.disabled = count === 0;
        }
    }

    // Copy time slots to selected days
    async copyTimeSlots(sourceDateStr) {
        const checkboxesContainer = document.getElementById(`copyDaysCheckboxes-${sourceDateStr}`);
        if (!checkboxesContainer) return;

        // Get selected days
        const selectedCheckboxes = checkboxesContainer.querySelectorAll('.copy-day-checkbox:checked');
        const selectedDays = Array.from(selectedCheckboxes).map(cb => cb.value);

        // Validation
        if (selectedDays.length === 0) {
            this.showMessage('Please select at least one day to copy to.', 'error');
            return;
        }

        // Get today's date for validation
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Validate no past dates
        const pastDates = selectedDays.filter(dateStr => {
            const [year, month, day] = dateStr.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            date.setHours(0, 0, 0, 0);
            return date < today;
        });

        if (pastDates.length > 0) {
            this.showMessage('Cannot copy to past dates.', 'error');
            return;
        }

        // Validate source day not selected
        if (selectedDays.includes(sourceDateStr)) {
            this.showMessage('Cannot copy to the same day.', 'error');
            return;
        }

        // Get source day time slots
        const sourceDayInfo = this.availability[sourceDateStr];
        if (!sourceDayInfo || !sourceDayInfo.timeSlots || sourceDayInfo.timeSlots.length === 0) {
            this.showMessage('No time slots to copy from this day.', 'error');
            return;
        }

        const timeSlotsToCopy = [...sourceDayInfo.timeSlots]; // Copy array

        // Prevent multiple submissions
        if (this.isSavingAvailability) {
            this.showMessage('Save already in progress. Please wait...', 'error');
            return;
        }

        // Show loading state
        const copyBtn = document.getElementById(`btnCopyTimes-${sourceDateStr}`);
        const originalText = copyBtn ? copyBtn.textContent : 'Copy Time Slots';
        
        if (copyBtn) {
            copyBtn.disabled = true;
            copyBtn.textContent = 'Copying...';
            copyBtn.classList.add('btn-loading');
        }

        // Disable checkboxes during save
        const allCheckboxes = checkboxesContainer.querySelectorAll('.copy-day-checkbox');
        allCheckboxes.forEach(cb => {
            cb.disabled = true;
        });

        try {
            // Update availability for each selected day
            selectedDays.forEach(targetDateStr => {
                this.availability[targetDateStr] = {
                    available: true,
                    timeSlots: [...timeSlotsToCopy], // Copy array to avoid reference issues
                    closed: false
                };
            });

            // Save all changes atomically
            const result = await this.saveAvailability(this.availability);

            if (result.success) {
                const dayCount = selectedDays.length;
                this.showMessage(`Time slots copied successfully to ${dayCount} day${dayCount !== 1 ? 's' : ''}!`, 'success');
                
                // Clear selections
                selectedCheckboxes.forEach(cb => {
                    cb.checked = false;
                });
                this.updateSelectedDaysCount(sourceDateStr);

                // Store expanded date to restore after refresh
                const expandedDate = this.expandedDate;
                
                // Refresh calendar to show updated badges
                this.renderAvailabilityCalendar();
                
                // Restore expanded state if it was the source day
                if (expandedDate === sourceDateStr) {
                    // The renderAvailabilityCalendar will restore it, but we need to re-render checkboxes
                    setTimeout(() => {
                        const dayCell = Array.from(document.querySelectorAll('.calendar-day')).find(cell => {
                            return cell.getAttribute('data-date') === sourceDateStr;
                        });
                        if (dayCell && dayCell.classList.contains('expanded')) {
                            this.renderCopyDaysCheckboxes(sourceDateStr);
                        }
                    }, 100);
                }
            } else {
                this.showMessage(result.message || 'Failed to copy time slots. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error copying time slots:', error);
            this.showMessage('An error occurred while copying time slots. Please try again.', 'error');
        } finally {
            // Restore button state
            if (copyBtn) {
                copyBtn.disabled = false;
                copyBtn.textContent = originalText;
                copyBtn.classList.remove('btn-loading');
            }

            // Re-enable checkboxes
            allCheckboxes.forEach(cb => {
                cb.disabled = false;
            });
        }
    }

    // Show time slot picker modal
    showTimeSlotModal(dateStr) {
        this.pendingTimeSlotDate = dateStr; // Store which day we're adding to
        const modal = document.getElementById('timeSlotModal');
        if (modal) {
            modal.style.display = 'flex';
            
            // Get existing time slots for this date
            const dayInfo = this.availability[dateStr] || { available: true, timeSlots: [] };
            const timeSlots = dayInfo.timeSlots || [];
            
            const hourSelect = document.getElementById('timeHour');
            const minuteSelect = document.getElementById('timeMinute');
            const ampmSelect = document.getElementById('timeAMPM');
            
            // If time slots exist, suggest next time (45 minutes after the last one)
            if (timeSlots.length > 0) {
                // Time slots are already sorted, so get the last (latest) one
                const lastTimeSlot = timeSlots[timeSlots.length - 1];
                // Add 45 minutes to the last time slot
                const nextTime24 = this.addMinutesToTime(lastTimeSlot, 45);
                // Convert to 12-hour format
                const nextTime12 = this.convertTo12Hour(nextTime24);
                
                // Set the modal values to the suggested time
                if (hourSelect) hourSelect.value = nextTime12.hour;
                if (minuteSelect) minuteSelect.value = nextTime12.minute;
                if (ampmSelect) ampmSelect.value = nextTime12.ampm;
            } else {
                // No existing time slots, use default 9:00 AM
                if (hourSelect) hourSelect.value = '9';
                if (minuteSelect) minuteSelect.value = '00';
                if (ampmSelect) ampmSelect.value = 'AM';
            }
        }
    }

    // Close time slot picker modal
    closeTimeSlotModal() {
        const modal = document.getElementById('timeSlotModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.pendingTimeSlotDate = null;
    }

    // Confirm and add the time slot
    confirmAddTimeSlot() {
        if (!this.pendingTimeSlotDate) return;

        const hourSelect = document.getElementById('timeHour');
        const minuteSelect = document.getElementById('timeMinute');
        const ampmSelect = document.getElementById('timeAMPM');

        if (!hourSelect || !minuteSelect || !ampmSelect) return;

        const hour = parseInt(hourSelect.value);
        const minute = minuteSelect.value;
        const ampm = ampmSelect.value;

        // Convert to 24-hour format
        let hour24 = hour;
        if (ampm === 'PM' && hour24 !== 12) {
            hour24 += 12;
        } else if (ampm === 'AM' && hour24 === 12) {
            hour24 = 0;
        }

        const time24 = `${hour24.toString().padStart(2, '0')}:${minute}`;

        // Get current time slots
        const dayInfo = this.availability[this.pendingTimeSlotDate] || { available: true, timeSlots: [] };
        const timeSlots = dayInfo.timeSlots || [];

        // Check if already exists
        if (timeSlots.includes(time24)) {
            alert('This time slot already exists!');
            return;
        }

        // Add to list
        timeSlots.push(time24);
        timeSlots.sort();

        // Update availability
        this.availability[this.pendingTimeSlotDate] = {
            available: true,
            timeSlots: timeSlots
        };

        // Save the date before closing modal (which sets pendingTimeSlotDate to null)
        const dateToExpand = this.pendingTimeSlotDate;
        // Close modal
        this.closeTimeSlotModal();
        // Maintain expanded state - since we're adding to the currently expanded day, keep it expanded
        this.expandedDate = dateToExpand;
        // Refresh calendar to update badge and restore expanded state
        this.renderAvailabilityCalendar();
    }

    // Add a time slot to a day (shows modal)
    addTimeSlot(dateStr) {
        this.showTimeSlotModal(dateStr);
    }

        // Remove a time slot from a day
    removeTimeSlot(dateStr, timeSlot) {
        const dayInfo = this.availability[dateStr] || { available: true, timeSlots: [] };
        let timeSlots = dayInfo.timeSlots || [];

        // Remove the time slot
        timeSlots = timeSlots.filter(slot => slot !== timeSlot);

        // Update availability
        if (timeSlots.length === 0) {
            delete this.availability[dateStr];
            // If we removed the last time slot and this was the expanded day, collapse it
            if (this.expandedDate === dateStr) {
                this.expandedDate = null;
            }
        } else {
            this.availability[dateStr] = {
                available: true,
                timeSlots: timeSlots
            };
            // Maintain expanded state if this was the expanded day
            if (this.expandedDate === dateStr) {
                // Keep it expanded - will be restored by renderAvailabilityCalendar()
            }
        }
        // Refresh calendar to update badge and restore expanded state
        this.renderAvailabilityCalendar();
    }

    // Save day availability changes
    async saveDayAvailability(dateStr) {
        // Prevent multiple submissions - show message if already saving
        if (this.isSavingAvailability) {
            this.showMessage('Save already in progress. Please wait...', 'error');
            return;
        }

        const dayInfo = this.availability[dateStr];
        
        // If day is closed, keep the closed flag but don't require time slots
        if (dayInfo && dayInfo.closed === true) {
            // Day is closed - keep it in availability with closed flag
            // Time slots can exist but won't be used
        } else if (!dayInfo || !dayInfo.timeSlots || dayInfo.timeSlots.length === 0) {
            // Remove availability if no time slots and not closed
            delete this.availability[dateStr];
        }

        // Show saving state immediately
        const saveBtn = document.querySelector('.btn-save-day');
        const originalSaveText = saveBtn ? saveBtn.textContent : 'Save Changes';
        
        if (saveBtn) {
            saveBtn.textContent = 'Saving...';
        }

        // Save to API (this will handle loading state)
        const result = await this.saveAvailability(this.availability);
        
        // Restore button text
        if (saveBtn) {
            saveBtn.textContent = originalSaveText;
        }
        
        // Show success or error message
        if (result.success) {
            this.showMessage(result.message || 'Availability saved successfully!', 'success');
            
            // Brief visual confirmation - show "Saved!" state
            if (saveBtn) {
                const savedText = saveBtn.textContent;
                saveBtn.textContent = '✓ Saved!';
                saveBtn.style.color = '#4caf50';
                saveBtn.style.borderColor = '#4caf50';
                
                // Reset after 2 seconds
                setTimeout(() => {
                    if (saveBtn) {
                        saveBtn.textContent = savedText;
                        saveBtn.style.color = '';
                        saveBtn.style.borderColor = '';
                    }
                }, 2000);
            }
        } else {
            this.showMessage(result.message || 'Failed to save availability. Please try again.', 'error');
        }
        
        // Collapse editor and refresh calendar (badges will update)
        this.cancelDayEditor();
    }

    // Show loading state for calendar
    showLoadingState(type) {
        if (type === 'calendar') {
            const calendarPreview = document.getElementById('calendarPreview');
            if (calendarPreview) {
                // Clear any existing content first
                const existingLoading = calendarPreview.querySelector('.calendar-loading');
                if (existingLoading) {
                    existingLoading.remove();
                }
                
                const loadingEl = document.createElement('div');
                loadingEl.className = 'calendar-loading';
                loadingEl.innerHTML = '<span class="loading-spinner"></span><span>Loading availability...</span>';
                calendarPreview.appendChild(loadingEl);
            }
        }
    }

    // Hide loading state for calendar
    hideLoadingState(type) {
        if (type === 'calendar') {
            const calendarPreview = document.getElementById('calendarPreview');
            if (calendarPreview) {
                const loadingEl = calendarPreview.querySelector('.calendar-loading');
                if (loadingEl) {
                    loadingEl.remove();
                }
            }
        }
    }

    // Set save buttons to loading state
    setSaveButtonsLoading(isLoading) {
        const saveBtn = document.querySelector('.btn-save-day');
        const cancelBtn = document.querySelector('.btn-reset-day');
        const addTimeBtn = document.querySelector('.btn-add-time-slot');
        const removeTimeBtns = document.querySelectorAll('.btn-remove-time');
        const closedToggle = document.getElementById('dayClosedToggle');

        if (saveBtn) {
            if (isLoading) {
                saveBtn.classList.add('btn-loading');
                saveBtn.disabled = true;
                saveBtn.setAttribute('aria-busy', 'true');
            } else {
                saveBtn.classList.remove('btn-loading');
                saveBtn.disabled = false;
                saveBtn.removeAttribute('aria-busy');
            }
        }

        if (cancelBtn) {
            cancelBtn.disabled = isLoading;
            if (isLoading) {
                cancelBtn.style.opacity = '0.5';
                cancelBtn.style.cursor = 'not-allowed';
            } else {
                cancelBtn.style.opacity = '';
                cancelBtn.style.cursor = '';
            }
        }

        if (addTimeBtn) {
            addTimeBtn.disabled = isLoading;
            if (isLoading) {
                addTimeBtn.style.opacity = '0.5';
                addTimeBtn.style.cursor = 'not-allowed';
            } else {
                addTimeBtn.style.opacity = '';
                addTimeBtn.style.cursor = '';
            }
        }

        removeTimeBtns.forEach(btn => {
            btn.disabled = isLoading;
            if (isLoading) {
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.style.opacity = '';
                btn.style.cursor = '';
            }
        });

        // Disable toggle when saving
        if (closedToggle) {
            closedToggle.disabled = isLoading;
        }
    }

    setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.getAttribute('data-filter');
                this.renderAppointments();
            });
        });
    }

    // ============================================
    // WEEKLY SCHEDULE METHODS
    // ============================================

    // Get Sunday of the week for a given date (week starts on Sunday)
    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const diff = d.getDate() - day; // Days to subtract to get to Sunday
        return new Date(d.setDate(diff));
    }

    // Get Saturday of the week (week ends on Saturday)
    getWeekEnd(date) {
        const start = this.getWeekStart(date);
        const end = new Date(start);
        end.setDate(start.getDate() + 6); // Add 6 days to get Saturday
        return end;
    }

    // Format time range (e.g., "9:00 - 9:45")
    formatTimeRange(startTime, duration) {
        const [startHours, startMinutes] = startTime.split(':').map(Number);
        const startTotalMinutes = startHours * 60 + startMinutes;
        const endTotalMinutes = startTotalMinutes + duration;
        const endHours = Math.floor(endTotalMinutes / 60);
        const endMinutes = endTotalMinutes % 60;
        
        const startHour12 = startHours % 12 || 12;
        const startAMPM = startHours >= 12 ? 'PM' : 'AM';
        const endHour12 = endHours % 12 || 12;
        const endAMPM = endHours >= 12 ? 'PM' : 'AM';
        
        return `${startHour12}:${String(startMinutes).padStart(2, '0')} ${startAMPM} - ${endHour12}:${String(endMinutes).padStart(2, '0')} ${endAMPM}`;
    }

    // Get min and max times for appointments on a given day
    getAppointmentTimeBounds(appointments) {
        if (!appointments || appointments.length === 0) {
            return { minHour: 9, minMinute: 0, maxHour: 23, maxMinute: 0 };
        }

        let minHour = 9;
        let minMinute = 0;
        let maxHour = 23;
        let maxMinute = 0;

        appointments.forEach(apt => {
            const [hours, minutes] = apt.time.split(':').map(Number);
            const duration = apt.duration || 45;
            const endHours = hours;
            const endMinutes = minutes + duration;
            const endTotalMinutes = endHours * 60 + endMinutes;
            const finalEndHours = Math.floor(endTotalMinutes / 60);
            const finalEndMinutes = endTotalMinutes % 60;

            if (hours < minHour || (hours === minHour && minutes < minMinute)) {
                minHour = hours;
                minMinute = minutes;
            }

            if (finalEndHours > maxHour || (finalEndHours === maxHour && finalEndMinutes > maxMinute)) {
                maxHour = finalEndHours;
                maxMinute = finalEndMinutes;
            }
        });

        // Default to 9 AM - 11 PM if no appointments
        if (appointments.length === 0) {
            minHour = 9;
            minMinute = 0;
            maxHour = 23;
            maxMinute = 0;
        }

        // Ensure minimum is at least 9 AM
        if (minHour < 9 || (minHour === 9 && minMinute === 0)) {
            minHour = 9;
            minMinute = 0;
        }

        // Ensure maximum is at most 11 PM
        if (maxHour > 23 || (maxHour === 23 && maxMinute > 0)) {
            maxHour = 23;
            maxMinute = 0;
        }

        return { minHour, minMinute, maxHour, maxMinute };
    }

    // Calculate vertical position and height for appointment block
    calculateAppointmentPosition(appointment, startHour, startMinute, endHour, endMinute) {
        const [aptHours, aptMinutes] = appointment.time.split(':').map(Number);
        const duration = appointment.duration || 45;
        
        // Calculate start position (minutes from timeline start)
        const timelineStartMinutes = startHour * 60 + startMinute;
        const aptStartMinutes = aptHours * 60 + aptMinutes;
        const aptEndMinutes = aptStartMinutes + duration;
        
        // Calculate timeline duration in minutes
        const timelineEndMinutes = endHour * 60 + endMinute;
        const timelineDurationMinutes = timelineEndMinutes - timelineStartMinutes;
        
        // Calculate percentages
        const topPercent = ((aptStartMinutes - timelineStartMinutes) / timelineDurationMinutes) * 100;
        const heightPercent = (duration / timelineDurationMinutes) * 100;
        
        return {
            top: Math.max(0, topPercent),
            height: Math.min(heightPercent, 100 - topPercent)
        };
    }

    // Create appointment block DOM element
    createAppointmentBlock(appointment) {
        const block = document.createElement('div');
        block.className = `appointment-block ${appointment.status}`;
        
        const timeRange = this.formatTimeRange(appointment.time, appointment.duration);
        const customerName = appointment.customer?.name || appointment.customer_name || 'Unknown';
        const service = appointment.service || 'Service';
        
        block.innerHTML = `
            <div class="appointment-block-time">${timeRange}</div>
            <div class="appointment-block-name">${customerName}</div>
            <div class="appointment-block-service">${service}</div>
            <button class="appointment-block-cancel" onclick="adminPanel.cancelAppointment('${appointment.id}')" title="Cancel appointment">×</button>
        `;
        
        return block;
    }

    // Setup weekly schedule tab
    async setupWeeklyScheduleTab() {
        // Initialize current week start if not set
        if (!this.currentWeekStart) {
            this.currentWeekStart = this.getWeekStart(new Date());
        }
        
        // Set up week navigation
        const prevBtn = document.getElementById('prevWeek');
        const nextBtn = document.getElementById('nextWeek');
        
        if (prevBtn) {
            prevBtn.onclick = () => {
                const newWeekStart = new Date(this.currentWeekStart);
                newWeekStart.setDate(newWeekStart.getDate() - 7);
                this.currentWeekStart = newWeekStart;
                if (this.currentScheduleView === 'weekOverview') {
                    this.renderWeekOverview();
                } else {
                    // If in detail view, go back to overview
                    this.showWeekOverview();
                }
            };
        }
        
        if (nextBtn) {
            nextBtn.onclick = () => {
                const newWeekStart = new Date(this.currentWeekStart);
                newWeekStart.setDate(newWeekStart.getDate() + 7);
                this.currentWeekStart = newWeekStart;
                if (this.currentScheduleView === 'weekOverview') {
                    this.renderWeekOverview();
                } else {
                    // If in detail view, go back to overview
                    this.showWeekOverview();
                }
            };
        }
        
        // Set up back button
        const backBtn = document.getElementById('backToWeekBtn');
        if (backBtn) {
            backBtn.onclick = () => {
                this.showWeekOverview();
            };
        }
        
        // Render the week overview
        await this.renderWeekOverview();
    }

    // Render week overview (day cards)
    async renderWeekOverview() {
        const dayCardsGrid = document.getElementById('dayCardsGrid');
        const currentWeekDisplay = document.getElementById('currentWeekDisplay');
        
        if (!dayCardsGrid) return;
        
        // Update week display
        if (currentWeekDisplay) {
            const weekEnd = this.getWeekEnd(this.currentWeekStart);
            const startStr = this.currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            currentWeekDisplay.textContent = `${startStr} - ${endStr}`;
        }
        
        // Load appointments for the week
        await this.loadAppointments();
        
        // Filter appointments to current week and exclude cancelled
        const weekEnd = this.getWeekEnd(this.currentWeekStart);
        const startDateStr = this.formatDate(this.currentWeekStart);
        const endDateStr = this.formatDate(weekEnd);
        
        const weekAppointments = this.appointments.filter(apt => {
            return apt.date >= startDateStr && apt.date <= endDateStr && apt.status !== 'cancelled';
        });
        
        // Clear grid
        dayCardsGrid.innerHTML = '';
        
        // Create day cards for each day of the week (Sunday to Saturday)
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(this.currentWeekStart);
            dayDate.setDate(this.currentWeekStart.getDate() + i);
            const dateStr = this.formatDate(dayDate);
            
            // Get appointments for this day
            const dayAppointments = weekAppointments.filter(apt => apt.date === dateStr);
            
            // Create day card
            const dayCard = this.createDayCard(dayDate, dateStr, dayAppointments);
            dayCardsGrid.appendChild(dayCard);
        }
        
        // Update view state
        this.currentScheduleView = 'weekOverview';
    }

    // Create day card element
    createDayCard(dayDate, dateStr, appointments) {
        const card = document.createElement('div');
        card.className = 'day-card';
        
        const appointmentCount = appointments.length;
        const hasAppointments = appointmentCount > 0;
        
        if (hasAppointments) {
            card.classList.add('day-card-has-appointments');
        } else {
            card.classList.add('day-card-empty');
        }
        
        const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'long' });
        const dayNumber = dayDate.getDate();
        const monthName = dayDate.toLocaleDateString('en-US', { month: 'short' });
        
        card.innerHTML = `
            <div class="day-card-header">
                <div class="day-card-name">${dayName}</div>
                <div class="day-card-date">
                    <span class="day-card-month">${monthName}</span>
                    <span class="day-card-number">${dayNumber}</span>
                </div>
            </div>
            <div class="day-card-appointments">
                ${appointmentCount > 0 ? `${appointmentCount} appointment${appointmentCount !== 1 ? 's' : ''}` : 'No appointments'}
            </div>
        `;
        
        // Add click handler
        card.addEventListener('click', () => {
            this.renderDayDetail(dateStr);
        });
        
        return card;
    }

    // Render day detail view (single day timeline)
    async renderDayDetail(dateStr) {
        const weekOverviewView = document.getElementById('weekOverviewView');
        const dayDetailView = document.getElementById('dayDetailView');
        const dayDetailHeader = document.getElementById('dayDetailHeader');
        const dayDetailTimeline = document.getElementById('dayDetailTimeline');
        
        if (!weekOverviewView || !dayDetailView || !dayDetailTimeline) return;
        
        // Parse date string
        const [year, month, day] = dateStr.split('-').map(Number);
        const dayDate = new Date(year, month - 1, day);
        
        // Update day header
        if (dayDetailHeader) {
            const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'long' });
            const formattedDate = dayDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            dayDetailHeader.textContent = `${dayName}, ${formattedDate}`;
        }
        
        // Load appointments
        await this.loadAppointments();
        
        // Get appointments for this day (exclude cancelled)
        const dayAppointments = this.appointments.filter(apt => {
            return apt.date === dateStr && apt.status !== 'cancelled';
        });
        
        // Calculate time bounds for this day
        const timeBounds = this.getAppointmentTimeBounds(dayAppointments);
        
        // Clear timeline
        dayDetailTimeline.innerHTML = '';
        
        // Create timeline container
        const timelineContainer = document.createElement('div');
        timelineContainer.className = 'day-timeline';
        
        // Hour markers
        const hourMarkers = document.createElement('div');
        hourMarkers.className = 'timeline-hours';
        
        const startHour = timeBounds.minHour;
        const endHour = timeBounds.maxHour;
        
        // Generate hour markers
        for (let hour = startHour; hour <= endHour; hour++) {
            const marker = document.createElement('div');
            marker.className = 'hour-marker';
            const hour12 = hour % 12 || 12;
            const ampm = hour >= 12 ? 'PM' : 'AM';
            marker.textContent = `${hour12}:00 ${ampm}`;
            hourMarkers.appendChild(marker);
        }
        
        timelineContainer.appendChild(hourMarkers);
        
        // Appointments timeline
        const appointmentsTimeline = document.createElement('div');
        appointmentsTimeline.className = 'appointments-timeline';
        
        // Position appointment blocks
        dayAppointments.forEach(apt => {
            const position = this.calculateAppointmentPosition(
                apt,
                timeBounds.minHour,
                timeBounds.minMinute,
                timeBounds.maxHour,
                timeBounds.maxMinute
            );
            
            const block = this.createAppointmentBlock(apt);
            block.style.top = `${position.top}%`;
            block.style.height = `${position.height}%`;
            
            appointmentsTimeline.appendChild(block);
        });
        
        timelineContainer.appendChild(appointmentsTimeline);
        dayDetailTimeline.appendChild(timelineContainer);
        
        // Hide week overview, show day detail
        weekOverviewView.style.display = 'none';
        dayDetailView.style.display = 'block';
        
        // Update view state
        this.currentScheduleView = 'dayDetail';
        this.selectedDayDate = dateStr;
    }

    // Show week overview (return from day detail)
    async showWeekOverview() {
        const weekOverviewView = document.getElementById('weekOverviewView');
        const dayDetailView = document.getElementById('dayDetailView');
        
        if (!weekOverviewView || !dayDetailView) return;
        
        // Hide day detail, show week overview
        dayDetailView.style.display = 'none';
        weekOverviewView.style.display = 'block';
        
        // Update view state
        this.currentScheduleView = 'weekOverview';
        this.selectedDayDate = null;
        
        // Re-render week overview
        await this.renderWeekOverview();
    }

    // Cancel appointment
    async cancelAppointment(id) {
        if (!confirm('Are you sure you want to cancel this appointment? The customer will be notified via SMS.')) {
            return;
        }

        const appointment = this.appointments.find(apt => apt.id === id);
        if (!appointment) {
            this.showAppointmentsMessage('Appointment not found.', 'error');
            return;
        }

        if (!this.useAPI) {
            // Backup: Update in localStorage
            appointment.status = 'cancelled';
            this.saveAppointments();
            if (this.currentTab === 'schedule') {
                await this.renderWeeklySchedule();
            } else {
                this.updateStats();
                this.renderAppointments();
            }
            this.showAppointmentsMessage('Appointment cancelled successfully.', 'success');
            return;
        }

        try {
            const response = await fetch(`/api/appointments/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'cancelled' })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server returned ${response.status}: ${response.statusText}`);
            }

            // Update local appointment
            appointment.status = 'cancelled';
            
            // Refresh view
            if (this.currentTab === 'schedule') {
                if (this.currentScheduleView === 'dayDetail' && this.selectedDayDate) {
                    await this.renderDayDetail(this.selectedDayDate);
                } else {
                    await this.renderWeekOverview();
                }
            } else {
                this.updateStats();
                this.renderAppointments();
            }
            
            this.showAppointmentsMessage('Appointment cancelled successfully. Customer has been notified.', 'success');
        } catch (error) {
            console.error('Error cancelling appointment:', error);
            this.showAppointmentsMessage(`Failed to cancel appointment: ${error.message}`, 'error');
        }
    }

}

// Initialize admin panel when page loads
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
});
