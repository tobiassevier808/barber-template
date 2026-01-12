// Confirmation Page Functionality
document.addEventListener('DOMContentLoaded', () => {
    // Get appointment data from URL parameters
    const params = new URLSearchParams(window.location.search);
    
    const service = params.get('service') || 'Haircut';
    const date = params.get('date') || '';
    const time = params.get('time') || '';
    const duration = params.get('duration') || '45';
    const price = params.get('price') || '$30.00';
    
    // Format date for display
    let formattedDate = date;
    if (date) {
        try {
            // Parse date string to avoid timezone issues
            const [year, month, day] = date.split('-').map(Number);
            const dateObj = new Date(year, month - 1, day); // month is 0-indexed
            formattedDate = dateObj.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        } catch (e) {
            formattedDate = date;
        }
    }
    
    // Format time for display
    let formattedTime = time;
    if (time) {
        try {
            const [hours, minutes] = time.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 || 12;
            formattedTime = `${displayHour}:${minutes} ${ampm}`;
        } catch (e) {
            formattedTime = time;
        }
    }
    
    // Update confirmation page with appointment details
    document.getElementById('confirmationService').textContent = service;
    document.getElementById('confirmationDate').textContent = formattedDate || '-';
    document.getElementById('confirmationTime').textContent = formattedTime || '-';
    document.getElementById('confirmationDuration').textContent = `${duration} minutes`;
    document.getElementById('confirmationPrice').textContent = price;
});

