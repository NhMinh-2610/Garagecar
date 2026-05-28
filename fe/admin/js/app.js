// Core Application Logic
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Sidebar Navigation
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('section');
    const pageTitle = document.getElementById('pageTitle');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
             // Save to LocalStorage
             const targetId = item.getAttribute('data-target');
             localStorage.setItem('activeSection', targetId);
             localStorage.setItem('activeTitle', item.innerText.trim());

            // Active class toggle
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Show target section
            sections.forEach(section => {
                section.classList.remove('active-section');
                if(section.id === targetId) {
                    section.classList.add('active-section');
                }
            });

            // Update Title
            pageTitle.innerText = item.innerText.trim();
        });
    });

    // Restore state on load
    const savedSection = localStorage.getItem('activeSection');
    const savedTitle = localStorage.getItem('activeTitle');

    if (savedSection) {
        // Activate saved nav
        navItems.forEach(nav => {
            nav.classList.remove('active');
            if (nav.getAttribute('data-target') === savedSection) {
                nav.classList.add('active');
            }
        });

        // Activate saved section
        sections.forEach(section => {
            section.classList.remove('active-section');
            if (section.id === savedSection) {
                section.classList.add('active-section');
            }
        });

        if (savedTitle) pageTitle.innerText = savedTitle;
    }

    // 2. Sidebar Toggle (Mobile)
    // 2. Sidebar Toggle (Mobile)
    const toggleBtn = document.querySelector('.toggle-sidebar');
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('content');
    
    if(toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            if(content) content.classList.toggle('active');
        });
    }

    // 3. Inner Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
             const tabId = btn.getAttribute('data-tab');
             const targetContent = document.getElementById(tabId);
             if (!targetContent) return;

             const parentSection = btn.closest('section');
             if (parentSection) {
                 const sectionBtns = parentSection.querySelectorAll('.tab-btn');
                 const sectionContents = parentSection.querySelectorAll('.tab-content');
                 
                 sectionBtns.forEach(b => b.classList.remove('active'));
                 sectionContents.forEach(c => c.classList.remove('active'));
             }

             // Add active
             btn.classList.add('active');
             targetContent.classList.add('active');
        });
    });

    // 4. Logout Logic moved to auth.js

});

// Utility: Format Currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Utility: Toast Notification
window.showToast = function(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if(!container) return;

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

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease-out forwards';
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3000);
}
