// API Base URL
const API_URL = 'http://localhost:3000/api';

// DOM Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');
const messageBox = document.getElementById('messageBox');

// Role-based redirect mapping
function getRedirectUrl(role) {
    switch (role) {
        case 'admin':
            return '../admin/';
        case 'mechanic':
            return '../mechanic/';
        case 'customer':
            return '../customer/';
        default:
            return '../login/';
    }
}

// Toggle between Login and Register forms
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.remove('active');
    registerForm.classList.add('active');
    hideMessage();
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.remove('active');
    loginForm.classList.add('active');
    hideMessage();
});

// Show Message
function showMessage(message, type = 'error') {
    messageBox.textContent = message;
    messageBox.className = `message-box show ${type}`;
}

function hideMessage() {
    messageBox.className = 'message-box';
}

// Handle Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showMessage('Vui lòng nhập đầy đủ thông tin', 'error');
        return;
    }

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng nhập...';

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (result.success) {
            // Save token and user info
            localStorage.setItem('token', result.data.token);
            localStorage.setItem('user', JSON.stringify(result.data.user));

            const role = result.data.user.role;
            const roleName = getRoleDisplayName(role);

            showMessage(`Đăng nhập thành công! Chào mừng ${roleName}...`, 'success');
            
            // Redirect based on role
            setTimeout(() => {
                window.location.href = getRedirectUrl(role);
            }, 1000);
        } else {
            showMessage(result.message || 'Đăng nhập thất bại', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Đăng nhập';
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Lỗi kết nối đến server', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Đăng nhập';
    }
});

// Handle Registration (Customer only)
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const fullName = document.getElementById('registerFullName').value.trim();
    const username = document.getElementById('registerUsername').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

    // Validation
    if (!fullName || !username || !email || !password || !passwordConfirm) {
        showMessage('Vui lòng nhập đầy đủ thông tin', 'error');
        return;
    }

    if (password.length < 6) {
        showMessage('Mật khẩu phải có ít nhất 6 ký tự', 'error');
        return;
    }

    if (password !== passwordConfirm) {
        showMessage('Mật khẩu xác nhận không khớp', 'error');
        return;
    }

    const submitBtn = registerForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng ký...';

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fullName,
                username,
                email,
                password
                // No role field - server always assigns 'customer'
            })
        });

        const result = await response.json();

        if (result.success) {
            showMessage('Đăng ký thành công! Vui lòng đăng nhập.', 'success');
            
            // Clear form
            registerForm.reset();
            
            // Switch to login form after 2 seconds
            setTimeout(() => {
                registerForm.classList.remove('active');
                loginForm.classList.add('active');
                hideMessage();
            }, 2000);
        } else {
            showMessage(result.message || 'Đăng ký thất bại', 'error');
        }
    } catch (error) {
        console.error('Register error:', error);
        showMessage('Lỗi kết nối đến server', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Đăng ký';
    }
});

// Get display name for role
function getRoleDisplayName(role) {
    switch (role) {
        case 'admin': return 'Quản Trị Viên';
        case 'mechanic': return 'Kỹ Thuật Viên';
        case 'customer': return 'Khách Hàng';
        default: return 'Người dùng';
    }
}

// Check if already logged in and handle query params
window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
        try {
            const user = JSON.parse(userStr);
            // Redirect to appropriate portal based on role
            window.location.href = getRedirectUrl(user.role);
            return;
        } catch (e) {
            localStorage.clear();
        }
    }

    // Check URL parameters for mode
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    
    if (mode === 'register') {
        loginForm.classList.remove('active');
        registerForm.classList.add('active');
        hideMessage();
    }
});
