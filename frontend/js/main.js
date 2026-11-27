/* ============================================
   Streamline Tech – Main JavaScript
   Navigation, mobile menu, scroll effects,
   contact form, and shared utilities
   ============================================ */

// ---- API Configuration ----
const API_ORIGIN = (window.APP_CONFIG && typeof window.APP_CONFIG.getBackendOrigin === 'function')
    ? window.APP_CONFIG.getBackendOrigin()
    : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
        ? (window.location.port === '3000' ? window.location.origin : 'http://localhost:3000')
        : 'https://internship-project-backend-black.vercel.app');
const API_BASE = API_ORIGIN + '/api';

// ---- Mobile Menu Toggle ----
document.addEventListener('DOMContentLoaded', function () {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileNav = document.getElementById('mobileNav');

    if (mobileMenuBtn && mobileNav) {
        mobileMenuBtn.addEventListener('click', function () {
            const isOpen = mobileNav.classList.toggle('active');
            mobileMenuBtn.innerHTML = isOpen
                ? '<i class="fa-solid fa-xmark"></i>'
                : '<i class="fa-solid fa-bars"></i>';
        });

        // Close on link click
        mobileNav.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () {
                mobileNav.classList.remove('active');
                mobileMenuBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
            });
        });
    }

    // ---- Header scroll effect ----
    const header = document.getElementById('siteHeader');
    if (header) {
        window.addEventListener('scroll', function () {
            if (window.scrollY > 10) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // ---- Contact Form ----
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const name = contactForm.querySelector('[name="name"]');
            const email = contactForm.querySelector('[name="email"]');
            const message = contactForm.querySelector('[name="message"]');

            let valid = true;

            if (!name.value.trim()) {
                showFieldError(name, 'Name is required');
                valid = false;
            } else {
                clearFieldError(name);
            }

            if (!email.value.trim() || !isValidEmail(email.value)) {
                showFieldError(email, 'Valid email is required');
                valid = false;
            } else {
                clearFieldError(email);
            }

            if (!message.value.trim()) {
                showFieldError(message, 'Message is required');
                valid = false;
            } else {
                clearFieldError(message);
            }

            if (valid) {
                showToast('Message sent successfully! We will get back to you soon.', 'success');
                contactForm.reset();
            }
        });
    }
});

// ---- Toast Notifications ----
function showToast(message, type) {
    type = type || 'info';
    var container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    var icons = {
        success: 'fa-circle-check',
        error: 'fa-circle-xmark',
        warning: 'fa-triangle-exclamation',
        info: 'fa-circle-info'
    };

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML =
        '<i class="fa-solid ' + (icons[type] || icons.info) + '"></i>' +
        '<span>' + message + '</span>' +
        '<button class="toast-close" onclick="this.parentElement.remove()">' +
        '<i class="fa-solid fa-xmark"></i></button>';

    container.appendChild(toast);

    setTimeout(function () {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(function () { toast.remove(); }, 300);
    }, 4000);
}

// ---- Form Validation Helpers ----
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFieldError(field, message) {
    clearFieldError(field);
    field.style.borderColor = 'var(--color-danger)';
    var errorEl = document.createElement('div');
    errorEl.className = 'form-error';
    errorEl.textContent = message;
    field.parentElement.appendChild(errorEl);
}

function clearFieldError(field) {
    field.style.borderColor = '';
    var existing = field.parentElement.querySelector('.form-error');
    if (existing) existing.remove();
}

// ---- API Helper ----
async function apiRequest(endpoint, options) {
    options = options || {};
    var token = localStorage.getItem('st_token') || sessionStorage.getItem('st_token');
    var headers = {
        'Content-Type': 'application/json'
    };

    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }

    var config = {
        method: options.method || 'GET',
        headers: headers
    };

    if (options.body) {
        config.body = JSON.stringify(options.body);
    }

    var response = await fetch(API_BASE + endpoint, config);
    var data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data;
}

// ---- Format Date ----
function formatDate(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

// ---- Get Initials ----
function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
}

// ---- Smooth Scroll ----
document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
        var target = document.querySelector(this.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});
