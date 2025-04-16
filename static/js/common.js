/**
 * Common utility functions for all pages
 */

// Show a notification message
function showNotification(message, type = 'info', duration = 3000) {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.padding = '15px 20px';
        notification.style.borderRadius = '5px';
        notification.style.color = 'white';
        notification.style.fontWeight = '500';
        notification.style.zIndex = '10000';
        notification.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.2)';
        notification.style.transform = 'translateX(200%)';
        notification.style.transition = 'transform 0.3s ease-out';
        document.body.appendChild(notification);
    }
    
    // Set notification type (color)
    let bgColor;
    switch (type) {
        case 'success':
            bgColor = '#28a745';
            break;
        case 'error':
            bgColor = '#dc3545';
            break;
        case 'warning':
            bgColor = '#ffc107';
            break;
        default:
            bgColor = '#007bff'; // info
    }
    notification.style.backgroundColor = bgColor;
    
    // Set message
    notification.textContent = message;
    
    // Show notification
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Auto-hide after duration
    setTimeout(() => {
        notification.style.transform = 'translateX(200%)';
    }, duration);
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    
    return date.toLocaleString();
}

// Toggle password visibility
function setupPasswordToggles() {
    const passwordToggles = document.querySelectorAll('.password-toggle');
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const passwordInput = this.parentElement.querySelector('input');
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                this.querySelector('img').style.opacity = '1';
            } else {
                passwordInput.type = 'password';
                this.querySelector('img').style.opacity = '0.5';
            }
        });
    });
}

// Handle form animations
function setupFormAnimations() {
    const formInputs = document.querySelectorAll('.form-group input');
    formInputs.forEach(input => {
        // Add focus animation
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
            this.style.transform = 'translateY(-3px)';
            setTimeout(() => {
                this.style.transform = 'translateY(0)';
            }, 200);
        });

        // Remove focus animation
        input.addEventListener('blur', function() {
            if (!this.value) {
                this.parentElement.classList.remove('focused');
            }
        });

        // Check if input has value on load
        if (input.value) {
            input.parentElement.classList.add('focused');
        }
    });
}

// Generic function to filter tables
function filterTable(tableId, searchText) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    const rows = table.querySelectorAll('tbody tr');
    const searchLower = searchText.toLowerCase();
    
    rows.forEach(row => {
        const shouldShow = searchLower === '' || 
            row.textContent.toLowerCase().includes(searchLower);
        
        row.style.display = shouldShow ? '' : 'none';
    });
}

// Initialize all common functionality
document.addEventListener('DOMContentLoaded', function() {
    setupPasswordToggles();
    setupFormAnimations();
    
    // Initialize search inputs
    document.querySelectorAll('.search-input').forEach(input => {
        input.addEventListener('input', function() {
            const tableId = this.id.replace('-search', '-table');
            filterTable(tableId, this.value);
        });
    });
});
