// Customer Portal - Core Application Logic
const API_URL = 'http://localhost:3000/api';

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

document.addEventListener('DOMContentLoaded', () => {
    
    // Sidebar Navigation
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('section');
    const pageTitle = document.getElementById('pageTitle');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');
            localStorage.setItem('customerActiveSection', targetId);
            localStorage.setItem('customerActiveTitle', item.innerText.trim());

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(section => {
                section.classList.remove('active-section');
                if (section.id === targetId) {
                    section.classList.add('active-section');
                }
            });

            pageTitle.innerText = item.innerText.trim();
        });
    });

    // Restore state on load
    const savedSection = localStorage.getItem('customerActiveSection');
    const savedTitle = localStorage.getItem('customerActiveTitle');

    if (savedSection) {
        navItems.forEach(nav => {
            nav.classList.remove('active');
            if (nav.getAttribute('data-target') === savedSection) {
                nav.classList.add('active');
            }
        });
        sections.forEach(section => {
            section.classList.remove('active-section');
            if (section.id === savedSection) {
                section.classList.add('active-section');
            }
        });
        if (savedTitle) pageTitle.innerText = savedTitle;
    }

    // Sidebar Toggle (Mobile)
    const toggleBtn = document.querySelector('.toggle-sidebar');
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('content');
    
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            if (content) content.classList.toggle('active');
        });
    }
});

// Utility: Format Currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Utility: Format Date
function formatDate(dateStr) {
    if (!dateStr) return '---';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Utility: Toast Notification
window.showToast = function(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-circle-xmark';
    if (type === 'warning') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease-out forwards';
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
};
