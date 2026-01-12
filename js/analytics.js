// Analytics Panel Functionality
class AnalyticsPanel {
    constructor() {
        this.appointments = [];
        this.currentView = 'time-slots';
        this.charts = {};
        this.expenses = parseFloat(localStorage.getItem('analyticsExpenses') || '0');
        this.fakeDataMode = false;
        this.fakeAppointments = [];
        this.selectedClient = '';
        this.clientSearchQuery = '';
        this.dateRange = 'last-30'; // Default to last 30 days
        this.customStartDate = null;
        this.customEndDate = null;
        
        this.init();
    }

    loadAppointments() {
        const stored = localStorage.getItem('bookedAppointments');
        return stored ? JSON.parse(stored) : [];
    }

    saveExpenses() {
        localStorage.setItem('analyticsExpenses', this.expenses.toString());
    }

    getAnalyticsAppointments() {
        // Use fake data if mode is enabled, otherwise use real data
        let sourceData = this.fakeDataMode ? this.fakeAppointments : this.appointments;
        
        // Filter by includeInAnalytics
        sourceData = sourceData.filter(apt => apt.includeInAnalytics !== false);
        
        // Filter by client if selected
        if (this.selectedClient) {
            sourceData = sourceData.filter(apt => 
                apt.customer.email.toLowerCase() === this.selectedClient.toLowerCase()
            );
        }
        
        // Filter by client search query
        if (this.clientSearchQuery) {
            const query = this.clientSearchQuery.toLowerCase();
            sourceData = sourceData.filter(apt => 
                apt.customer.name.toLowerCase().includes(query) ||
                apt.customer.email.toLowerCase().includes(query)
            );
        }
        
        // Filter by date range
        sourceData = this.filterByDateRange(sourceData);
        
        return sourceData;
    }

    filterByDateRange(appointments) {
        if (!this.dateRange) {
            return appointments; // No filter
        }

        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        let startDate, endDate;
        
        switch(this.dateRange) {
            case 'this-week':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + 6);
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'this-month':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'last-30':
                startDate = new Date(today);
                startDate.setDate(startDate.getDate() - 30);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(today);
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'custom':
                if (this.customStartDate && this.customEndDate) {
                    // Parse date strings to avoid timezone issues
                    const [startYear, startMonth, startDay] = this.customStartDate.split('-').map(Number);
                    startDate = new Date(startYear, startMonth - 1, startDay); // month is 0-indexed
                    startDate.setHours(0, 0, 0, 0);
                    const [endYear, endMonth, endDay] = this.customEndDate.split('-').map(Number);
                    endDate = new Date(endYear, endMonth - 1, endDay); // month is 0-indexed
                    endDate.setHours(23, 59, 59, 999);
                } else {
                    return appointments; // No custom range set, return all
                }
                break;
            default:
                return appointments; // No filter
        }
        
        return appointments.filter(apt => {
            // Parse date string to avoid timezone issues
            const [year, month, day] = apt.date.split('-').map(Number);
            const aptDate = new Date(year, month - 1, day); // month is 0-indexed
            aptDate.setHours(0, 0, 0, 0);
            return aptDate >= startDate && aptDate <= endDate;
        });
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

    init() {
        this.appointments = this.loadAppointments();
        this.generateFakeData();
        this.setupEventListeners();
        this.updateFakeDataUI();
        this.updateClientDropdown();
        this.render();
        
        // Make available globally for admin panel to refresh
        window.analyticsPanel = this;
    }

    generateFakeData() {
        // Generate fake appointments for testing
        const fakeNames = [
            'John Smith', 'Michael Johnson', 'David Williams', 'James Brown', 'Robert Jones',
            'William Garcia', 'Richard Miller', 'Joseph Davis', 'Thomas Rodriguez', 'Christopher Martinez',
            'Charles Anderson', 'Daniel Taylor', 'Matthew Thomas', 'Anthony Hernandez', 'Mark Moore',
            'Donald Martin', 'Steven Jackson', 'Paul Thompson', 'Andrew White', 'Joshua Harris',
            'Kenneth Sanchez', 'Kevin Clark', 'Brian Ramirez', 'George Lewis', 'Edward Walker',
            'Ronald Young', 'Timothy Allen', 'Jason King', 'Jeffrey Wright', 'Ryan Lopez'
        ];
        
        const fakeEmails = fakeNames.map(name => 
            name.toLowerCase().replace(' ', '.') + '@example.com'
        );
        
        const fakePhones = Array.from({ length: 30 }, (_, i) => 
            `(555) ${String(Math.floor(100 + Math.random() * 900))}-${String(Math.floor(1000 + Math.random() * 9000))}`
        );
        
        const services = ['Haircut', 'Haircut & Design', 'Haircut & Beard'];
        const prices = { 'Haircut': 30, 'Haircut & Design': 35, 'Haircut & Beard': 40 };
        
        // Generate appointments for the last 90 days (up to 5000 for testing)
        const today = new Date();
        this.fakeAppointments = [];
        const targetCount = 5000; // Generate up to 5000 fake appointments for testing
        
        // Generate many appointments to reach target count
        let generatedCount = 0;
        const clientPool = [...fakeEmails];
        
        // Expand client pool by duplicating and modifying emails
        for (let i = 0; i < 200; i++) {
            const baseEmail = fakeEmails[i % fakeEmails.length];
            const parts = baseEmail.split('@');
            const newEmail = `${parts[0]}${i}@example.com`;
            clientPool.push(newEmail);
        }
        
        while (generatedCount < targetCount) {
            const emailIndex = Math.floor(Math.random() * clientPool.length);
            const email = clientPool[emailIndex];
            const nameIndex = emailIndex % fakeNames.length;
            
            const appointmentDate = new Date(today);
            const daysAgo = Math.floor(Math.random() * 90);
            appointmentDate.setDate(appointmentDate.getDate() - daysAgo);
            
            const service = services[Math.floor(Math.random() * services.length)];
            const hour = Math.floor(Math.random() * 8) + 13;
            const minute = Math.random() > 0.5 ? 0 : 30;
            const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            
            let status = 'accepted';
            if (Math.random() < 0.08) status = 'declined'; // 8% declined
            if (Math.random() < 0.05 && appointmentDate > today) status = 'pending'; // 5% pending
            
            // Randomly exclude some from analytics (10%)
            const includeInAnalytics = Math.random() > 0.1;
            
            this.fakeAppointments.push({
                id: `fake_${generatedCount}_${Date.now()}_${Math.random()}`,
                service: service,
                price: prices[service].toString(),
                duration: 45,
                date: this.formatDate(appointmentDate),
                time: time,
                status: status,
                includeInAnalytics: includeInAnalytics,
                customer: {
                    name: fakeNames[nameIndex] + (emailIndex > fakeNames.length ? ` ${Math.floor(emailIndex / fakeNames.length)}` : ''),
                    email: email,
                    phone: fakePhones[nameIndex % fakePhones.length]
                },
                createdAt: appointmentDate.toISOString()
            });
            
            generatedCount++;
        }
        
        // Shuffle appointments
        this.fakeAppointments.sort(() => Math.random() - 0.5);
    }

    setupEventListeners() {
        // Fake data mode toggle
        const fakeDataToggle = document.getElementById('fakeDataToggle');
        if (fakeDataToggle) {
            fakeDataToggle.addEventListener('change', (e) => {
                this.fakeDataMode = e.target.checked;
                this.updateFakeDataUI();
                this.render();
            });
        }

        // Regenerate fake data button
        const regenerateBtn = document.getElementById('regenerateFakeDataBtn');
        if (regenerateBtn) {
            regenerateBtn.addEventListener('click', () => {
                this.generateFakeData();
                this.render();
            });
        }

        // Client search
        const clientSearchInput = document.getElementById('clientSearchInput');
        if (clientSearchInput) {
            clientSearchInput.addEventListener('input', (e) => {
                this.clientSearchQuery = e.target.value.toLowerCase();
                const clearBtn = document.getElementById('clearClientFilter');
                if (this.clientSearchQuery || this.selectedClient) {
                    if (clearBtn) clearBtn.style.display = 'block';
                } else {
                    if (clearBtn) clearBtn.style.display = 'none';
                }
                this.updateClientDropdown();
                this.render();
            });
        }

        // Client filter dropdown
        const clientFilterSelect = document.getElementById('clientFilterSelect');
        if (clientFilterSelect) {
            clientFilterSelect.addEventListener('change', (e) => {
                this.selectedClient = e.target.value;
                if (this.selectedClient) {
                    document.getElementById('clearClientFilter').style.display = 'block';
                } else {
                    document.getElementById('clearClientFilter').style.display = 'none';
                }
                this.render();
            });
        }

        // Clear client filter button
        const clearClientFilter = document.getElementById('clearClientFilter');
        if (clearClientFilter) {
            clearClientFilter.addEventListener('click', () => {
                this.clearClientFilter();
                if (clearClientFilter) clearClientFilter.style.display = 'none';
            });
        }

        // Date range buttons
        document.querySelectorAll('.date-range-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.date-range-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.dateRange = e.target.getAttribute('data-range');
                
                // Show/hide custom date range inputs
                const customRange = document.getElementById('customDateRange');
                if (this.dateRange === 'custom') {
                    customRange.style.display = 'flex';
                } else {
                    customRange.style.display = 'none';
                }
                
                this.render();
            });
        });
        
        // Set default active date range button
        const defaultRangeBtn = document.querySelector(`.date-range-btn[data-range="${this.dateRange}"]`);
        if (defaultRangeBtn) {
            defaultRangeBtn.classList.add('active');
        }

        // Custom date range
        const applyCustomRange = document.getElementById('applyCustomRange');
        if (applyCustomRange) {
            applyCustomRange.addEventListener('click', () => {
                this.customStartDate = document.getElementById('customStartDate').value;
                this.customEndDate = document.getElementById('customEndDate').value;
                this.render();
            });
        }

        // Navigation buttons
        document.querySelectorAll('.analytics-nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.getAttribute('data-view');
                this.switchView(view);
            });
        });

        // Revenue tracker
        document.getElementById('expensesInput').addEventListener('input', (e) => {
            this.expenses = parseFloat(e.target.value) || 0;
            this.saveExpenses();
            this.renderRevenue();
        });

        // Initialize UI
        this.updateFakeDataUI();
        this.updateClientDropdown();
    }

    updateFakeDataUI() {
        const banner = document.getElementById('fakeDataBanner');
        const regenerateBtn = document.getElementById('regenerateFakeDataBtn');
        
        if (this.fakeDataMode) {
            if (banner) banner.style.display = 'flex';
            if (regenerateBtn) regenerateBtn.style.display = 'block';
        } else {
            if (banner) banner.style.display = 'none';
            if (regenerateBtn) regenerateBtn.style.display = 'none';
        }
    }
    
    // Clear client filter
    clearClientFilter() {
        this.selectedClient = '';
        this.clientSearchQuery = '';
        const searchInput = document.getElementById('clientSearchInput');
        const filterSelect = document.getElementById('clientFilterSelect');
        if (searchInput) searchInput.value = '';
        if (filterSelect) filterSelect.value = '';
        this.render();
    }

    updateClientDropdown() {
        const analyticsAppts = this.getAnalyticsAppointments();
        const clientFilterSelect = document.getElementById('clientFilterSelect');
        
        if (!clientFilterSelect) return;
        
        // Get unique clients from all appointments (not filtered)
        const allAppts = this.fakeDataMode ? this.fakeAppointments : this.appointments;
        const clients = {};
        allAppts.forEach(apt => {
            if (apt.includeInAnalytics !== false) {
                const email = apt.customer.email.toLowerCase();
                if (!clients[email]) {
                    clients[email] = apt.customer.name;
                }
            }
        });
        
        // Update dropdown
        clientFilterSelect.innerHTML = '<option value="">All Clients</option>';
        Object.entries(clients).sort((a, b) => a[1].localeCompare(b[1])).forEach(([email, name]) => {
            const option = document.createElement('option');
            option.value = email;
            option.textContent = `${name} (${email})`;
            if (this.selectedClient === email) {
                option.selected = true;
            }
            clientFilterSelect.appendChild(option);
        });
    }

    switchView(viewName) {
        this.currentView = viewName;
        
        // Update navigation
        document.querySelectorAll('.analytics-nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-view') === viewName) {
                btn.classList.add('active');
            }
        });

        // Update content
        document.querySelectorAll('.analytics-view').forEach(view => {
            view.classList.remove('active');
        });
        
        const activeView = document.getElementById(`${viewName}-view`);
        if (activeView) {
            activeView.classList.add('active');
        }

        // Render the view
        this.render();
    }

    render() {
        // Reload appointments to get latest data
        if (!this.fakeDataMode) {
            this.appointments = this.loadAppointments();
        }
        
        // Update client dropdown (needs to happen before filtering)
        this.updateClientDropdown();
        
        switch(this.currentView) {
            case 'time-slots':
                this.renderTimeSlots();
                break;
            case 'revenue':
                this.renderRevenue();
                break;
            case 'retention':
                this.renderRetention();
                break;
            case 'no-shows':
                this.renderNoShows();
                break;
        }
    }

    refresh() {
        this.render();
    }

    // Popular/Least Popular Time Slots
    renderTimeSlots() {
        const analyticsAppts = this.getAnalyticsAppointments();
        
        // Count by hour
        const hourCounts = {};
        const dayCounts = {
            'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0,
            'Thursday': 0, 'Friday': 0, 'Saturday': 0
        };

        analyticsAppts.forEach(apt => {
            if (apt.status === 'accepted') {
                const [hours] = apt.time.split(':');
                const hour = parseInt(hours);
                const hour12 = hour % 12 || 12;
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const hourLabel = `${hour12}:00 ${ampm}`;
                hourCounts[hourLabel] = (hourCounts[hourLabel] || 0) + 1;

                // Parse date string to avoid timezone issues
                const [year, month, day] = apt.date.split('-').map(Number);
                const date = new Date(year, month - 1, day); // month is 0-indexed
                const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
                dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
            }
        });

        // Sort by count
        const sortedHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]);
        const sortedDays = Object.entries(dayCounts).sort((a, b) => b[1] - a[1]);

        // Render time slots chart
        const timeSlotsCtx = document.getElementById('timeSlotsChart').getContext('2d');
        if (this.charts.timeSlots) {
            this.charts.timeSlots.destroy();
        }

        this.charts.timeSlots = new Chart(timeSlotsCtx, {
            type: 'bar',
            data: {
                labels: sortedHours.map(h => h[0]),
                datasets: [{
                    label: 'Bookings',
                    data: sortedHours.map(h => h[1]),
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    borderColor: '#ffffff',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: 'Bookings by Time Slot',
                        color: '#ffffff'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#888' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    x: {
                        ticks: { color: '#888' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    }
                }
            }
        });

        // Render day of week chart
        const dayCtx = document.getElementById('dayOfWeekChart').getContext('2d');
        if (this.charts.dayOfWeek) {
            this.charts.dayOfWeek.destroy();
        }

        this.charts.dayOfWeek = new Chart(dayCtx, {
            type: 'bar',
            data: {
                labels: sortedDays.map(d => d[0]),
                datasets: [{
                    label: 'Bookings',
                    data: sortedDays.map(d => d[1]),
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    borderColor: '#ffffff',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: 'Bookings by Day of Week',
                        color: '#ffffff'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#888' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    x: {
                        ticks: { color: '#888' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    }
                }
            }
        });
    }

    // Revenue Tracker
    renderRevenue() {
        // Get analytics appointments (already filtered by date range, client, and includeInAnalytics)
        const analyticsAppts = this.getAnalyticsAppointments().filter(apt => {
            return apt.status === 'accepted';
        });
        
        // Note: Date range filtering is already applied in getAnalyticsAppointments()
        // If custom dates are set in revenue view, they override global filter temporarily
        const revenueStartDate = document.getElementById('revenueStartDate')?.value;
        const revenueEndDate = document.getElementById('revenueEndDate')?.value;
        
        let filteredAppts = analyticsAppts;
        if (revenueStartDate && revenueEndDate) {
            filteredAppts = analyticsAppts.filter(apt => {
                return apt.date >= revenueStartDate && apt.date <= revenueEndDate;
            });
        }

        const totalRevenue = filteredAppts.reduce((sum, apt) => {
            return sum + parseFloat(apt.price || 0);
        }, 0);

        const grossProfit = totalRevenue - this.expenses;

        document.getElementById('totalRevenue').textContent = `$${totalRevenue.toFixed(2)}`;
        document.getElementById('expensesInput').value = this.expenses || '';
        document.getElementById('grossProfit').textContent = `$${grossProfit.toFixed(2)}`;

        // Revenue chart by date
        const revenueByDate = {};
        filteredAppts.forEach(apt => {
            const date = apt.date;
            revenueByDate[date] = (revenueByDate[date] || 0) + parseFloat(apt.price || 0);
        });

        const sortedDates = Object.keys(revenueByDate).sort();
        const revenueData = sortedDates.map(date => revenueByDate[date]);
        const dateLabels = sortedDates.map(date => {
            // Parse date string to avoid timezone issues
            const [year, month, day] = date.split('-').map(Number);
            const d = new Date(year, month - 1, day); // month is 0-indexed
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });

        const revenueCtx = document.getElementById('revenueChart').getContext('2d');
        if (this.charts.revenue) {
            this.charts.revenue.destroy();
        }

        this.charts.revenue = new Chart(revenueCtx, {
            type: 'line',
            data: {
                labels: dateLabels,
                datasets: [{
                    label: 'Revenue',
                    data: revenueData,
                    borderColor: '#ffffff',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: '#ffffff' } },
                    title: {
                        display: true,
                        text: 'Revenue Over Time',
                        color: '#ffffff'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#888' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    x: {
                        ticks: { color: '#888' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    }
                }
            }
        });
    }

    // Client Retention Rate
    renderRetention() {
        // If a specific client is selected, show their details
        if (this.selectedClient) {
            this.renderClientDetails();
            return;
        }

        const analyticsAppts = this.getAnalyticsAppointments().filter(apt => apt.status === 'accepted');
        
        // Group by customer email
        const clients = {};
        analyticsAppts.forEach(apt => {
            const email = apt.customer.email.toLowerCase();
            if (!clients[email]) {
                clients[email] = {
                    name: apt.customer.name,
                    email: apt.customer.email,
                    phone: apt.customer.phone,
                    appointments: []
                };
            }
            clients[email].appointments.push({
                date: apt.date,
                time: apt.time,
                service: apt.service
            });
        });

        // Calculate retention
        const totalClients = Object.keys(clients).length;
        const returningClients = Object.values(clients).filter(c => c.appointments.length > 1).length;
        const newClients = totalClients - returningClients;
        const retentionRate = totalClients > 0 ? (returningClients / totalClients * 100) : 0;

        document.getElementById('retentionRate').textContent = `${retentionRate.toFixed(1)}%`;
        document.getElementById('totalClients').textContent = totalClients;
        document.getElementById('returningClients').textContent = returningClients;

        // Calculate average time between appointments for returning clients
        const clientsList = Object.values(clients).map(client => {
            const isReturning = client.appointments.length > 1;
            let avgDaysBetween = null;

            if (isReturning) {
                const dates = client.appointments
                    .map(apt => {
                        // Parse date string to avoid timezone issues
                        const [year, month, day] = apt.date.split('-').map(Number);
                        return new Date(year, month - 1, day); // month is 0-indexed
                    })
                    .sort((a, b) => a - b);
                
                const daysBetween = [];
                for (let i = 1; i < dates.length; i++) {
                    const diff = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
                    daysBetween.push(diff);
                }
                avgDaysBetween = daysBetween.reduce((a, b) => a + b, 0) / daysBetween.length;
            }

            return {
                ...client,
                isReturning,
                visitCount: client.appointments.length,
                avgDaysBetween
            };
        });

        // Sort: returning clients first, then by visit count
        clientsList.sort((a, b) => {
            if (a.isReturning !== b.isReturning) {
                return b.isReturning - a.isReturning;
            }
            return b.visitCount - a.visitCount;
        });

        // Render client list
        const container = document.getElementById('clientsList');
        container.innerHTML = '';

        if (clientsList.length === 0) {
            container.innerHTML = '<p class="no-data">No clients found.</p>';
            return;
        }

        clientsList.forEach(client => {
            const card = document.createElement('div');
            card.className = 'client-card';
            
            const returningBadge = client.isReturning 
                ? '<span class="client-badge returning">Returning</span>' 
                : '<span class="client-badge new">New</span>';
            
            const avgDaysText = client.avgDaysBetween 
                ? `<div class="client-detail"><strong>Avg. Days Between:</strong> ${client.avgDaysBetween.toFixed(1)} days</div>`
                : '';

            card.innerHTML = `
                <div class="client-info">
                    <div class="client-header">
                        <span class="client-name">${client.name}</span>
                        ${returningBadge}
                    </div>
                    <div class="client-details">
                        <div class="client-detail"><strong>Email:</strong> ${client.email}</div>
                        <div class="client-detail"><strong>Phone:</strong> ${client.phone}</div>
                        <div class="client-detail"><strong>Total Visits:</strong> ${client.visitCount}</div>
                        ${avgDaysText}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

        // Render retention pie chart
        const retentionCtx = document.getElementById('retentionChart')?.getContext('2d');
        if (retentionCtx) {
            if (this.charts.retention) {
                this.charts.retention.destroy();
            }

            if (totalClients > 0) {
                this.charts.retention = new Chart(retentionCtx, {
                    type: 'pie',
                    data: {
                        labels: ['Returning Clients', 'New Clients'],
                        datasets: [{
                            data: [returningClients, newClients],
                            backgroundColor: [
                                'rgba(0, 255, 0, 0.8)',
                                'rgba(255, 165, 0, 0.8)'
                            ],
                            borderColor: [
                                '#00ff00',
                                '#ffa500'
                            ],
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: { 
                                    color: '#ffffff',
                                    font: { size: 12 },
                                    padding: 15
                                }
                            },
                            title: {
                                display: true,
                                text: 'Client Retention Breakdown',
                                color: '#ffffff',
                                font: { size: 16 }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const label = context.label || '';
                                        const value = context.parsed || 0;
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                        return `${label}: ${value} (${percentage}%)`;
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }
    }

    // Client Details View (when a specific client is selected)
    renderClientDetails() {
        const analyticsAppts = this.getAnalyticsAppointments().filter(apt => apt.status === 'accepted');
        
        if (analyticsAppts.length === 0) {
            document.getElementById('retentionRate').textContent = '0%';
            document.getElementById('totalClients').textContent = '0';
            document.getElementById('returningClients').textContent = '0';
            document.getElementById('clientsList').innerHTML = '<p class="no-data">No appointments found for this client.</p>';
            return;
        }

        const client = analyticsAppts[0].customer;
        const appointments = analyticsAppts.map(apt => ({
            date: apt.date,
            time: apt.time,
            service: apt.service,
            price: apt.price
        })).sort((a, b) => {
            // Parse date strings to avoid timezone issues
            const [yearA, monthA, dayA] = a.date.split('-').map(Number);
            const dateA = new Date(yearA, monthA - 1, dayA);
            const [yearB, monthB, dayB] = b.date.split('-').map(Number);
            const dateB = new Date(yearB, monthB - 1, dayB);
            return dateA - dateB;
        });

        const isReturning = appointments.length > 1;
        const totalSpent = appointments.reduce((sum, apt) => sum + parseFloat(apt.price || 0), 0);

        let avgDaysBetween = null;
        if (isReturning && appointments.length > 1) {
            const dates = appointments.map(apt => {
                // Parse date string to avoid timezone issues
                const [year, month, day] = apt.date.split('-').map(Number);
                return new Date(year, month - 1, day); // month is 0-indexed
            }).sort((a, b) => a - b);
            const daysBetween = [];
            for (let i = 1; i < dates.length; i++) {
                const diff = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
                daysBetween.push(diff);
            }
            avgDaysBetween = daysBetween.reduce((a, b) => a + b, 0) / daysBetween.length;
        }

        document.getElementById('retentionRate').textContent = isReturning ? 'Returning' : 'New';
        document.getElementById('totalClients').textContent = appointments.length;
        document.getElementById('returningClients').textContent = totalSpent.toFixed(2);

        // Render client details
        const container = document.getElementById('clientsList');
        container.innerHTML = `
            <div class="client-card highlight">
                <div class="client-info">
                    <div class="client-header">
                        <span class="client-name">${client.name}</span>
                        <span class="client-badge ${isReturning ? 'returning' : 'new'}">${isReturning ? 'Returning' : 'New'}</span>
                    </div>
                    <div class="client-details">
                        <div class="client-detail"><strong>Email:</strong> ${client.email}</div>
                        <div class="client-detail"><strong>Phone:</strong> ${client.phone}</div>
                        <div class="client-detail"><strong>Total Visits:</strong> ${appointments.length}</div>
                        <div class="client-detail"><strong>Total Spent:</strong> $${totalSpent.toFixed(2)}</div>
                        ${avgDaysBetween ? `<div class="client-detail"><strong>Avg. Days Between:</strong> ${avgDaysBetween.toFixed(1)} days</div>` : ''}
                    </div>
                </div>
                <div class="client-appointments-list">
                    <h4>Appointment History</h4>
                    ${appointments.map(apt => {
                        // Parse date string to avoid timezone issues
                        const [year, month, day] = apt.date.split('-').map(Number);
                        const date = new Date(year, month - 1, day); // month is 0-indexed
                        return `<div class="appointment-item">
                            <span>${this.formatDateDisplay(date)}</span>
                            <span>${this.formatTime(apt.time)}</span>
                            <span>${apt.service}</span>
                            <span>$${apt.price}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;
    }

    // No-Shows & Cancellations
    renderNoShows() {
        // Use global date range filter (already applied in getAnalyticsAppointments)
        const analyticsAppts = this.getAnalyticsAppointments();

        // No-shows: declined appointments that have passed
        const noShows = analyticsAppts.filter(apt => {
            // Parse date and time to avoid timezone issues
            const [year, month, day] = apt.date.split('-').map(Number);
            const [hours, minutes] = apt.time.split(':').map(Number);
            const aptDateTime = new Date(year, month - 1, day, hours, minutes); // month is 0-indexed
            return apt.status === 'declined' && aptDateTime < new Date();
        });
        
        // Cancellations: all declined appointments
        const cancellations = analyticsAppts.filter(apt => apt.status === 'declined');

        document.getElementById('totalNoShows').textContent = noShows.length;
        document.getElementById('totalCancellations').textContent = cancellations.length;

        // Render bar chart - show over time
        const noShowsCtx = document.getElementById('noShowsChart')?.getContext('2d');
        if (noShowsCtx) {
            if (this.charts.noShows) {
                this.charts.noShows.destroy();
            }

            // Group by date
            const noShowsByDate = {};
            const cancellationsByDate = {};
            
            noShows.forEach(apt => {
                const date = apt.date;
                noShowsByDate[date] = (noShowsByDate[date] || 0) + 1;
            });
            
            cancellations.forEach(apt => {
                const date = apt.date;
                cancellationsByDate[date] = (cancellationsByDate[date] || 0) + 1;
            });

            const allDates = [...new Set([...Object.keys(noShowsByDate), ...Object.keys(cancellationsByDate)])].sort();
            
            if (allDates.length === 0) {
                // If no data, show summary chart
                this.charts.noShows = new Chart(noShowsCtx, {
                    type: 'bar',
                    data: {
                        labels: ['No-Shows', 'Cancellations'],
                        datasets: [{
                            label: 'Count',
                            data: [noShows.length, cancellations.length],
                            backgroundColor: ['rgba(255, 68, 68, 0.8)', 'rgba(255, 165, 0, 0.8)'],
                            borderColor: ['#ff4444', '#ffa500'],
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { display: false },
                            title: {
                                display: true,
                                text: 'No-Shows vs Cancellations Summary',
                                color: '#ffffff'
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { color: '#888', stepSize: 1 },
                                grid: { color: 'rgba(255,255,255,0.1)' }
                            },
                            x: {
                                ticks: { color: '#888' },
                                grid: { color: 'rgba(255,255,255,0.1)' }
                            }
                        }
                    }
                });
            } else {
                // Show over time
                const dateLabels = allDates.map(date => {
                    // Parse date string to avoid timezone issues
                    const [year, month, day] = date.split('-').map(Number);
                    const d = new Date(year, month - 1, day); // month is 0-indexed
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                });
                const noShowsData = allDates.map(date => noShowsByDate[date] || 0);
                const cancellationsData = allDates.map(date => cancellationsByDate[date] || 0);

                this.charts.noShows = new Chart(noShowsCtx, {
                    type: 'bar',
                    data: {
                        labels: dateLabels,
                        datasets: [
                            {
                                label: 'No-Shows',
                                data: noShowsData,
                                backgroundColor: 'rgba(255, 68, 68, 0.8)',
                                borderColor: '#ff4444',
                                borderWidth: 1
                            },
                            {
                                label: 'Cancellations',
                                data: cancellationsData,
                                backgroundColor: 'rgba(255, 165, 0, 0.8)',
                                borderColor: '#ffa500',
                                borderWidth: 1
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                labels: { color: '#ffffff' }
                            },
                            title: {
                                display: true,
                                text: 'No-Shows & Cancellations Over Time',
                                color: '#ffffff'
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { color: '#888', stepSize: 1 },
                                grid: { color: 'rgba(255,255,255,0.1)' }
                            },
                            x: {
                                ticks: { color: '#888' },
                                grid: { color: 'rgba(255,255,255,0.1)' }
                            }
                        }
                    }
                });
            }
        }

        // Combine and display
        const allIssues = [...noShows.map(apt => ({ ...apt, type: 'No-Show' })), 
                          ...cancellations.map(apt => ({ ...apt, type: 'Cancellation' }))];

        // Sort by date
        allIssues.sort((a, b) => {
            // Parse dates and times to avoid timezone issues
            const [yearA, monthA, dayA] = a.date.split('-').map(Number);
            const [hoursA, minutesA] = a.time.split(':').map(Number);
            const dateA = new Date(yearA, monthA - 1, dayA, hoursA, minutesA);
            
            const [yearB, monthB, dayB] = b.date.split('-').map(Number);
            const [hoursB, minutesB] = b.time.split(':').map(Number);
            const dateB = new Date(yearB, monthB - 1, dayB, hoursB, minutesB);
            
            return dateB - dateA;
        });

        const container = document.getElementById('noShowsList');
        container.innerHTML = '';

        if (allIssues.length === 0) {
            container.innerHTML = '<p class="no-data">No no-shows or cancellations found.</p>';
            return;
        }

        allIssues.forEach(apt => {
            const card = document.createElement('div');
            card.className = `no-show-card ${apt.type.toLowerCase().replace('-', '')}`;
            
            // Parse date string to avoid timezone issues
            const [year, month, day] = apt.date.split('-').map(Number);
            const date = new Date(year, month - 1, day); // month is 0-indexed
            const formattedDate = this.formatDateDisplay(date);
            const formattedTime = this.formatTime(apt.time);

            card.innerHTML = `
                <div class="no-show-info">
                    <div class="no-show-header">
                        <span class="no-show-customer">${apt.customer.name}</span>
                        <span class="no-show-type ${apt.type.toLowerCase().replace('-', '')}">${apt.type}</span>
                    </div>
                    <div class="no-show-details">
                        <div class="no-show-detail"><strong>Date:</strong> ${formattedDate}</div>
                        <div class="no-show-detail"><strong>Time:</strong> ${formattedTime}</div>
                        <div class="no-show-detail"><strong>Service:</strong> ${apt.service}</div>
                        <div class="no-show-detail"><strong>Email:</strong> ${apt.customer.email}</div>
                        <div class="no-show-detail"><strong>Phone:</strong> ${apt.customer.phone}</div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }
}

// Initialize analytics when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the admin page with analytics tab
    if (document.getElementById('analytics-tab')) {
        // Wait a bit for admin panel to initialize
        setTimeout(() => {
            if (!window.analyticsPanel) {
                window.analyticsPanel = new AnalyticsPanel();
            }
        }, 200);
    }
});

