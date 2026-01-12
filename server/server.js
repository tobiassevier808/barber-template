// ============================================
// GJ Fadezz Backend Server
// Connects to Supabase and provides API endpoints
// ============================================

// Load environment variables from .env file
// This keeps your Supabase credentials secure
require('dotenv').config();

// Import required libraries
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { sendAppointmentConfirmation, sendAppointmentStatusUpdate, sendAppointmentReminder, sendAppointmentCancellation } = require('./services/smsService');
const cron = require('node-cron');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE SETUP
// ============================================

// Enable CORS - allows frontend to make requests to this API
app.use(cors());

// Parse JSON request bodies - converts JSON data from frontend into JavaScript objects
app.use(express.json());

// Serve static files from project root (frontend HTML, CSS, JS)
const staticPath = path.join(__dirname, '..');
console.log('📁 Serving static files from:', staticPath);
app.use(express.static(staticPath));

// ============================================
// SUPABASE CONNECTION
// ============================================

// Get Supabase credentials from environment variables
// These should be set in your .env file
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Validate that credentials are provided
if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Missing Supabase credentials!');
    console.error('Please create a .env file with SUPABASE_URL and SUPABASE_ANON_KEY');
    process.exit(1);
}

// Create Supabase client - this is your connection to the database
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// API ENDPOINTS - AVAILABILITY
// ============================================

/**
 * GET /api/availability
 * Returns availability for a date range in frontend-friendly format
 * Query parameters: startDate (optional), endDate (optional)
 * Example: GET /api/availability?startDate=2024-01-15&endDate=2024-01-28
 * Returns: { availability: { "YYYY-MM-DD": { timeSlots: [...], closed: false } } }
 */
app.get('/api/availability', async (req, res) => {
    try {
        // Get date range from query parameters (optional)
        const { startDate, endDate } = req.query;

        // Build query to get availability from database
        let query = supabase
            .from('availability')
            .select('*')
            .order('date', { ascending: true });

        // If date range provided, filter by dates
        if (startDate) {
            query = query.gte('date', startDate); // gte = greater than or equal
        }
        if (endDate) {
            query = query.lte('date', endDate); // lte = less than or equal
        }

        // Execute query and get data
        const { data, error } = await query;

        // If error occurred, send error response
        if (error) {
            console.error('Error fetching availability:', error);
            return res.status(500).json({ error: 'Failed to fetch availability', details: error.message });
        }

        // Convert database array format to frontend object format
        // Database: [{ date: "2024-01-15", time_ranges: [...], is_closed: false }]
        // Frontend: { availability: { "2024-01-15": { timeSlots: [...], closed: false } } }
        const availabilityResponse = {};
        
        if (data && Array.isArray(data)) {
            data.forEach(item => {
                // Format date to YYYY-MM-DD string (in case it comes as Date object)
                // Parse in local time to avoid timezone issues
                let dateStr;
                if (typeof item.date === 'string') {
                    dateStr = item.date;
                } else {
                    // If it's a Date object, extract local date components
                    const year = item.date.getFullYear();
                    const month = String(item.date.getMonth() + 1).padStart(2, '0');
                    const day = String(item.date.getDate()).padStart(2, '0');
                    dateStr = `${year}-${month}-${day}`;
                }
                
                availabilityResponse[dateStr] = {
                    timeSlots: item.time_ranges || [],
                    closed: item.is_closed || false,
                    available: !item.is_closed
                };
            });
            
            console.log(`[GET /api/availability] Converted ${data.length} date(s) to frontend format`);
        } else {
            console.log(`[GET /api/availability] No availability data found`);
        }

        // Success - send availability data in frontend format
        res.json({ availability: availabilityResponse });
    } catch (error) {
        // Catch any unexpected errors
        console.error('Unexpected error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

/**
 * POST /api/availability
 * Creates or updates availability for multiple dates
 * Request body: { availability: { "YYYY-MM-DD": { timeSlots: [...], closed: false } } }
 * Accepts frontend format and converts to database format
 */
app.post('/api/availability', async (req, res) => {
    try {
        // Frontend sends: { availability: { "2024-01-15": { timeSlots: [...], closed: false } } }
        const { availability } = req.body;

        // Validate that availability data is provided
        if (!availability || typeof availability !== 'object') {
            return res.status(400).json({ error: 'Availability data is required. Expected format: { availability: { "YYYY-MM-DD": { timeSlots: [...], closed: false } } }' });
        }

        const results = [];
        const errors = [];
        const dateCount = Object.keys(availability).length;

        console.log(`[POST /api/availability] Processing ${dateCount} date(s)`);

        // Process each date in the availability object
        for (const [dateStr, dayInfo] of Object.entries(availability)) {
            try {
                // Validate date format
                if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    errors.push({ date: dateStr, error: 'Invalid date format. Expected YYYY-MM-DD' });
                    continue;
                }

                // Convert frontend format to database format
                // Frontend: { timeSlots: [...], closed: false }
                // Database: { time_ranges: [...], is_closed: false }
                const availabilityData = {
                    date: dateStr,
                    time_ranges: dayInfo.timeSlots || [],
                    is_closed: dayInfo.closed === true,
                    updated_at: new Date().toISOString()
                };

                console.log(`[POST /api/availability] Saving date ${dateStr}: ${availabilityData.time_ranges.length} time slots, closed: ${availabilityData.is_closed}`);

                // Use Supabase upsert (insert or update if exists)
                // This will create new record or update existing one based on date
                const { data, error } = await supabase
                    .from('availability')
                    .upsert(availabilityData, {
                        onConflict: 'date' // If date already exists, update it instead of creating duplicate
                    })
                    .select()
                    .single(); // Return the single record that was created/updated

                if (error) {
                    console.error(`[POST /api/availability] Error saving date ${dateStr}:`, error);
                    errors.push({ date: dateStr, error: error.message });
                } else {
                    results.push(data);
                }
            } catch (err) {
                console.error(`[POST /api/availability] Unexpected error for date ${dateStr}:`, err);
                errors.push({ date: dateStr, error: err.message });
            }
        }

        // If all operations failed, return error
        if (errors.length > 0 && results.length === 0) {
            return res.status(500).json({ 
                error: 'Failed to save availability', 
                details: errors 
            });
        }

        // Convert saved results back to frontend format for response
        const availabilityResponse = {};
        results.forEach(item => {
            // Format date to YYYY-MM-DD string (in case it comes as Date object)
            // Parse in local time to avoid timezone issues
            let dateStr;
            if (typeof item.date === 'string') {
                dateStr = item.date;
            } else {
                // If it's a Date object, extract local date components
                const year = item.date.getFullYear();
                const month = String(item.date.getMonth() + 1).padStart(2, '0');
                const day = String(item.date.getDate()).padStart(2, '0');
                dateStr = `${year}-${month}-${day}`;
            }
            availabilityResponse[dateStr] = {
                timeSlots: item.time_ranges || [],
                closed: item.is_closed || false,
                available: !item.is_closed
            };
        });

        console.log(`[POST /api/availability] Successfully saved ${results.length} date(s), ${errors.length} error(s)`);

        // Return success response in frontend format
        // Include errors in response if some dates failed (partial success)
        if (errors.length > 0) {
            res.status(207).json({ 
                availability: availabilityResponse,
                errors: errors,
                message: `Saved ${results.length} date(s) successfully, ${errors.length} date(s) failed`
            });
        } else {
            res.json({ availability: availabilityResponse });
        }
    } catch (error) {
        // Catch any unexpected errors
        console.error('[POST /api/availability] Unexpected error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// ============================================
// API ENDPOINTS - APPOINTMENTS
// ============================================

/**
 * GET /api/appointments
 * Returns all appointments (for admin panel) in frontend-friendly format
 * Query parameters: status (optional), startDate (optional), endDate (optional)
 * Example: GET /api/appointments?status=pending&startDate=2024-01-15
 * Returns: Array of appointments with customer object format
 */
app.get('/api/appointments', async (req, res) => {
    try {
        // Get filter parameters from query string
        const { status, startDate, endDate } = req.query;

        // Build query to get appointments from database
        let query = supabase
            .from('appointments')
            .select('*')
            .order('date', { ascending: true })
            .order('time', { ascending: true });

        // Apply filters if provided
        if (status) {
            query = query.eq('status', status); // eq = equals
        }
        if (startDate) {
            query = query.gte('date', startDate);
        }
        if (endDate) {
            query = query.lte('date', endDate);
        }

        // Execute query and get data
        const { data, error } = await query;

        // If error occurred, send error response
        if (error) {
            console.error('Error fetching appointments:', error);
            return res.status(500).json({ error: 'Failed to fetch appointments', details: error.message });
        }

        // Convert database format to frontend format
        // Database: { customer_name, customer_email, customer_phone, ... }
        // Frontend: { customer: { name, email, phone }, ... }
        const appointments = (data || []).map(item => ({
            id: item.id,
            customer: {
                name: item.customer_name,
                email: item.customer_email,
                phone: item.customer_phone
            },
            service: item.service,
            price: item.price,
            duration: item.duration,
            date: item.date,
            time: item.time,
            status: item.status,
            includeInAnalytics: item.include_in_analytics !== false, // Default to true
            created_at: item.created_at,
            updated_at: item.updated_at
        }));

        console.log(`[GET /api/appointments] Returning ${appointments.length} appointment(s) in frontend format`);

        // Success - send appointments data back to frontend
        res.json(appointments);
    } catch (error) {
        // Catch any unexpected errors
        console.error('Unexpected error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

/**
 * POST /api/appointments
 * Creates a new appointment booking
 * Request body: { customer: {...}, service: "...", date: "2024-01-15", time: "14:15", ... }
 */
app.post('/api/appointments', async (req, res) => {
    try {
        // Get booking data from request body
        const {
            customer,
            service,
            price,
            duration,
            date,
            time,
            includeInAnalytics = true
        } = req.body;

        // Log incoming request for debugging
        console.log('[POST /api/appointments] Received booking request:', {
            customer: customer ? { name: customer.name, email: customer.email, phone: customer.phone ? '***' : 'missing' } : 'missing',
            service,
            date,
            time,
            price,
            duration
        });

        // Validate required fields
        if (!customer || !customer.name || !customer.email || !customer.phone) {
            console.log('[POST /api/appointments] Validation failed: Missing customer information');
            return res.status(400).json({ error: 'Customer information is required' });
        }
        if (!service || !date || !time) {
            console.log('[POST /api/appointments] Validation failed: Missing service, date, or time', { service, date, time });
            return res.status(400).json({ error: 'Service, date, and time are required' });
        }

        // Check if the time slot is still available
        // First, get availability for this date
        const { data: availabilityData, error: availError } = await supabase
            .from('availability')
            .select('*')
            .eq('date', date)
            .single();

        // If date is closed or not found, reject booking
        if (availError) {
            console.log('[POST /api/appointments] Availability check error:', availError.message);
            return res.status(400).json({ error: `This date is not available for booking: ${availError.message}` });
        }
        if (!availabilityData) {
            console.log('[POST /api/appointments] No availability data found for date:', date);
            return res.status(400).json({ error: 'This date is not available for booking. Please select a date with available time slots.' });
        }
        if (availabilityData.is_closed) {
            console.log('[POST /api/appointments] Date is marked as closed:', date);
            return res.status(400).json({ error: 'This date is closed and not available for booking' });
        }

        // Check if this time slot is already booked
        const { data: existingBookings, error: bookingCheckError } = await supabase
            .from('appointments')
            .select('id')
            .eq('date', date)
            .eq('time', time)
            .in('status', ['pending', 'accepted']); // Only check pending/accepted (not declined)

        if (bookingCheckError) {
            console.error('Error checking existing bookings:', bookingCheckError);
            return res.status(500).json({ error: 'Failed to verify availability', details: bookingCheckError.message });
        }

        // If time slot is already taken, reject booking
        if (existingBookings && existingBookings.length > 0) {
            return res.status(400).json({ error: 'This time slot is already booked' });
        }

        // Prepare appointment data to save
        const appointmentData = {
            customer_name: customer.name,
            customer_email: customer.email,
            customer_phone: customer.phone,
            service: service,
            price: price || '0.00',
            duration: duration || 45,
            date: date,
            time: time,
            status: 'pending', // New bookings start as pending
            include_in_analytics: includeInAnalytics
        };

        // Insert new appointment into database
        const { data, error } = await supabase
            .from('appointments')
            .insert(appointmentData)
            .select()
            .single(); // Return the single record that was created

        // If error occurred, send error response
        if (error) {
            console.error('Error creating appointment:', error);
            return res.status(500).json({ error: 'Failed to create appointment', details: error.message });
        }

        // Convert database format to frontend format
        const appointment = {
            id: data.id,
            customer: {
                name: data.customer_name,
                email: data.customer_email,
                phone: data.customer_phone
            },
            service: data.service,
            price: data.price,
            duration: data.duration,
            date: data.date,
            time: data.time,
            status: data.status,
            includeInAnalytics: data.include_in_analytics !== false,
            created_at: data.created_at,
            updated_at: data.updated_at
        };

        console.log(`[POST /api/appointments] Created appointment for ${appointment.customer.name} on ${appointment.date} at ${appointment.time}`);

        // Send SMS confirmation
        sendAppointmentConfirmation(appointment).catch(err => {
            console.error('[SMS] Failed to send confirmation:', err);
            // Don't fail the request if SMS fails
        });

        // Success - send created appointment back to frontend
        res.status(201).json(appointment);
    } catch (error) {
        // Catch any unexpected errors
        console.error('Unexpected error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

/**
 * PATCH /api/appointments/:id
 * Updates an appointment (typically to change status: pending -> accepted/declined)
 * URL parameter: id (appointment ID)
 * Request body: { status: "accepted" } or { status: "declined" }
 */
app.patch('/api/appointments/:id', async (req, res) => {
    try {
        // Get appointment ID from URL parameter
        const appointmentId = req.params.id;

        // Get update data from request body
        const updateData = req.body;

        // Validate that ID is provided
        if (!appointmentId) {
            return res.status(400).json({ error: 'Appointment ID is required' });
        }

        // Add updated timestamp
        updateData.updated_at = new Date().toISOString();

        // Update appointment in database
        const { data, error } = await supabase
            .from('appointments')
            .update(updateData)
            .eq('id', appointmentId) // Find appointment with this ID
            .select()
            .single(); // Return the single record that was updated

        // If error occurred, send error response
        if (error) {
            console.error('Error updating appointment:', error);
            return res.status(500).json({ error: 'Failed to update appointment', details: error.message });
        }

        // If no data returned, appointment doesn't exist
        if (!data) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        // Convert database format to frontend format
        const appointment = {
            id: data.id,
            customer: {
                name: data.customer_name,
                email: data.customer_email,
                phone: data.customer_phone
            },
            service: data.service,
            price: data.price,
            duration: data.duration,
            date: data.date,
            time: data.time,
            status: data.status,
            includeInAnalytics: data.include_in_analytics !== false,
            created_at: data.created_at,
            updated_at: data.updated_at
        };

        // If status changed to accepted or declined, send SMS
        if (updateData.status && (updateData.status === 'accepted' || updateData.status === 'declined')) {
            sendAppointmentStatusUpdate(appointment).catch(err => {
                console.error('[SMS] Failed to send status update:', err);
                // Don't fail the request if SMS fails
            });
        }

        // If status changed to cancelled, send cancellation SMS
        if (updateData.status && updateData.status === 'cancelled') {
            sendAppointmentCancellation(appointment).catch(err => {
                console.error('[SMS] Failed to send cancellation notification:', err);
                // Don't fail the request if SMS fails
            });
        }

        console.log(`[PATCH /api/appointments/${appointmentId}] Updated appointment status to: ${data.status}`);

        // Success - send updated appointment back to frontend
        res.json(appointment);
    } catch (error) {
        // Catch any unexpected errors
        console.error('Unexpected error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// ============================================
// CATCH-ALL ROUTE FOR FRONTEND
// ============================================

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ============================================
// SCHEDULED JOBS - APPOINTMENT REMINDERS
// ============================================

// Schedule job to check for appointments needing reminders (runs every 5 minutes)
cron.schedule('*/5 * * * *', async () => {
    try {
        const now = new Date();
        const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
        
        // Get all accepted appointments happening in ~2 hours
        // Use local date strings instead of UTC to avoid timezone issues
        const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayStr = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, '0')}-${String(todayLocal.getDate()).padStart(2, '0')}`;
        const twoHoursFromNowLocal = new Date(twoHoursFromNow.getFullYear(), twoHoursFromNow.getMonth(), twoHoursFromNow.getDate());
        const twoHoursFromNowStr = `${twoHoursFromNowLocal.getFullYear()}-${String(twoHoursFromNowLocal.getMonth() + 1).padStart(2, '0')}-${String(twoHoursFromNowLocal.getDate()).padStart(2, '0')}`;
        
        const { data: upcomingAppointments, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('status', 'accepted')
            .gte('date', todayStr)
            .lte('date', twoHoursFromNowStr);

        if (error) {
            console.error('[Cron] Error fetching appointments:', error);
            return;
        }

        if (!upcomingAppointments || upcomingAppointments.length === 0) {
            return; // No appointments to remind
        }

        // Check each appointment
        for (const apt of upcomingAppointments) {
            // Parse date and time to avoid timezone issues
            const [year, month, day] = apt.date.split('-').map(Number);
            const [hours, minutes] = apt.time.split(':').map(Number);
            const appointmentDateTime = new Date(year, month - 1, day, hours, minutes); // month is 0-indexed
            const timeDiff = appointmentDateTime.getTime() - now.getTime();
            const hoursUntil = timeDiff / (1000 * 60 * 60);

            // If appointment is between 1.5 and 2.5 hours away, send reminder
            // (This accounts for the 5-minute check interval)
            if (hoursUntil >= 1.5 && hoursUntil <= 2.5) {
                const appointment = {
                    id: apt.id,
                    customer: {
                        name: apt.customer_name,
                        email: apt.customer_email,
                        phone: apt.customer_phone
                    },
                    service: apt.service,
                    date: apt.date,
                    time: apt.time,
                    status: apt.status
                };

                console.log(`[Cron] Sending reminder for appointment ${apt.id}`);
                await sendAppointmentReminder(appointment);
            }
        }
    } catch (error) {
        console.error('[Cron] Error in reminder job:', error);
    }
});

console.log('✅ Reminder job scheduled (checks every 5 minutes)');

// ============================================
// START SERVER
// ============================================

// Start the server and listen on the specified port
app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
    console.log(`📁 Serving static files from: ${path.join(__dirname, '..')}`);
    console.log(`📡 API endpoints available:`);
    console.log(`   GET    /api/availability`);
    console.log(`   POST   /api/availability`);
    console.log(`   GET    /api/appointments`);
    console.log(`   POST   /api/appointments`);
    console.log(`   PATCH  /api/appointments/:id`);
});

