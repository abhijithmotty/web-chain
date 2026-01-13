// Common utilities and functions

// Get cookie value
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Set cookie
function setCookie(name, value, days = 7) {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

// Delete cookie
function deleteCookie(name) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
}

// Show alert message
function showAlert(message, type = 'success') {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} fade-in`;
    alert.textContent = message;
    alert.style.position = 'fixed';
    alert.style.top = '20px';
    alert.style.right = '20px';
    alert.style.zIndex = '3000';
    alert.style.maxWidth = '400px';

    document.body.appendChild(alert);

    setTimeout(() => {
        alert.style.opacity = '0';
        alert.style.transition = 'opacity 0.3s ease';
        setTimeout(() => alert.remove(), 300);
    }, 3000);
}

// Check login status and update navigation
async function checkLoginStatus() {
    const session = getCookie('session');

    if (!session) {
        document.getElementById('loginLink').style.display = 'block';
        document.getElementById('logoutLink').style.display = 'none';
        document.getElementById('userGreeting').style.display = 'none';
        document.getElementById('dashboardLink').style.display = 'none';
        document.getElementById('adminLink').style.display = 'none';
        document.getElementById('myOrdersLink').style.display = 'none';
        return;
    }

    try {
        const response = await fetch('/api/user');

        if (response.ok) {
            const user = await response.json();

            document.getElementById('loginLink').style.display = 'none';
            document.getElementById('logoutLink').style.display = 'block';
            document.getElementById('userGreeting').style.display = 'block';
            document.getElementById('userGreeting').textContent = `Welcome, ${user.username}`;

            if (user.role === 'admin') {
                document.getElementById('adminLink').style.display = 'block';
            } else {
                document.getElementById('dashboardLink').style.display = 'block';
                document.getElementById('myOrdersLink').style.display = 'block';
            }
        } else {
            // Invalid session
            deleteCookie('session');
            checkLoginStatus();
        }
    } catch (error) {
        console.error('Error checking login status:', error);
    }
}

// Logout function
document.addEventListener('DOMContentLoaded', () => {
    const logoutLink = document.getElementById('logoutLink');
    const myOrdersLink = document.getElementById('myOrdersLink');

    if (logoutLink) {
        logoutLink.addEventListener('click', async (e) => {
            e.preventDefault();

            try {
                await fetch('/api/logout', { method: 'POST' });
                deleteCookie('session');
                showAlert('Logged out successfully', 'success');
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }

    if (myOrdersLink) {
        myOrdersLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/dashboard.html';
        });
    }
});

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Validate email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Check authentication for protected pages
async function requireAuth() {
    const session = getCookie('session');

    if (!session) {
        showAlert('Please login to access this page', 'warning');
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 1500);
        return false;
    }

    try {
        const response = await fetch('/api/user');

        if (!response.ok) {
            showAlert('Session expired, please login again', 'warning');
            deleteCookie('session');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 1500);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Auth check error:', error);
        return false;
    }
}

// Check admin access
async function requireAdmin() {
    const session = getCookie('session');

    if (!session) {
        showAlert('Admin access required', 'error');
        setTimeout(() => {
            window.location.href = '/admin-login.html';
        }, 1500);
        return false;
    }

    try {
        const response = await fetch('/api/user');

        if (!response.ok) {
            showAlert('Session expired', 'warning');
            deleteCookie('session');
            setTimeout(() => {
                window.location.href = '/admin-login.html';
            }, 1500);
            return false;
        }

        const user = await response.json();

        if (user.role !== 'admin') {
            showAlert('Admin access required', 'error');
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Admin check error:', error);
        return false;
    }
}
