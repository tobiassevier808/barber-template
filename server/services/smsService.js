// SMS Notification Service using Twilio
const twilio = require('twilio');

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER; // Your Twilio phone number

let twilioClient = null;

if (accountSid && authToken) {
    twilioClient = twilio(accountSid, authToken);
} else {
    console.warn('⚠️  Twilio credentials not found. SMS notifications will be disabled.');
}

/**
 * Format phone number for Twilio (E.164 format)
 * @param {string} phone - Phone number in any format
 * @returns {string} - Formatted phone number
 */
function formatPhoneNumber(phone) {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If it starts with 1 and has 11 digits, it's already US format
    if (cleaned.length === 11 && cleaned[0] === '1') {
        return `+${cleaned}`;
    }
    
    // If it has 10 digits, assume US number and add +1
    if (cleaned.length === 10) {
        return `+1${cleaned}`;
    }
    
    // Otherwise, try to add + if missing
    if (!cleaned.startsWith('+')) {
        return `+${cleaned}`;
    }
    
    return cleaned;
}

/**
 * Send SMS notification
 * @param {string} to - Recipient phone number
 * @param {string} message - Message to send
 * @returns {Promise<Object>} - Twilio message result
 */
async function sendSMS(to, message) {
    if (!twilioClient) {
        console.log('[SMS] Twilio not configured. Would send:', { to, message });
        return { success: false, error: 'SMS service not configured' };
    }

    try {
        const formattedNumber = formatPhoneNumber(to);
        
        const result = await twilioClient.messages.create({
            body: message,
            from: fromNumber,
            to: formattedNumber
        });

        console.log(`[SMS] Message sent successfully to ${formattedNumber}. SID: ${result.sid}`);
        return { success: true, sid: result.sid };
    } catch (error) {
        console.error('[SMS] Error sending message:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Send appointment confirmation (when appointment is created)
 */
async function sendAppointmentConfirmation(appointment) {
    const { customer, service, date, time } = appointment;
    
    // Format date and time for display
    // Parse date string to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day); // month is 0-indexed
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    const formattedTime = `${displayHour}:${minutes} ${ampm}`;
    
    const message = `Hi ${customer.name}! Your appointment for ${service} on ${formattedDate} at ${formattedTime} has been received and is pending confirmation. We'll notify you once it's been reviewed. - GJ Fadezz`;
    
    return await sendSMS(customer.phone, message);
}

/**
 * Send appointment status update (accepted or declined)
 */
async function sendAppointmentStatusUpdate(appointment) {
    const { customer, service, date, time, status } = appointment;
    
    // Format date and time for display
    // Parse date string to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day); // month is 0-indexed
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    const formattedTime = `${displayHour}:${minutes} ${ampm}`;
    
    let message;
    if (status === 'accepted') {
        message = `Great news ${customer.name}! Your appointment for ${service} on ${formattedDate} at ${formattedTime} has been confirmed. See you then! - GJ Fadezz`;
    } else if (status === 'declined') {
        message = `Hi ${customer.name}, unfortunately we're unable to accommodate your appointment for ${service} on ${formattedDate} at ${formattedTime}. Please book a different time. - GJ Fadezz`;
    } else {
        return { success: false, error: 'Unknown status' };
    }
    
    return await sendSMS(customer.phone, message);
}

/**
 * Send appointment reminder (2 hours before)
 */
async function sendAppointmentReminder(appointment) {
    const { customer, service, date, time } = appointment;
    
    // Format date and time for display
    // Parse date string to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day); // month is 0-indexed
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    const formattedTime = `${displayHour}:${minutes} ${ampm}`;
    
    const message = `Reminder: You have an appointment for ${service} with GJ Fadezz today (${formattedDate}) at ${formattedTime}. See you in 2 hours!`;
    
    return await sendSMS(customer.phone, message);
}

/**
 * Send appointment cancellation notification
 * TODO: Replace 'YOUR_WEBSITE_URL.com' with actual domain when available
 */
async function sendAppointmentCancellation(appointment) {
    const { customer, service, date, time } = appointment;
    
    // Format date and time for display
    // Parse date string to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day); // month is 0-indexed
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    const formattedTime = `${displayHour}:${minutes} ${ampm}`;
    
    // TODO: Replace 'YOUR_WEBSITE_URL.com' with actual domain when available
    const bookingUrl = 'https://YOUR_WEBSITE_URL.com/booking.html';
    
    const message = `Hi ${customer.name}, we're sorry to inform you that your appointment for ${service} on ${formattedDate} at ${formattedTime} has been cancelled. Please reschedule at your earliest convenience: ${bookingUrl} - GJ Fadezz`;
    
    return await sendSMS(customer.phone, message);
}

module.exports = {
    sendSMS,
    sendAppointmentConfirmation,
    sendAppointmentStatusUpdate,
    sendAppointmentReminder,
    sendAppointmentCancellation
};

