/**
 * login/script.js
 * Toàn bộ code được đặt trong DOMContentLoaded để đảm bảo:
 *   1. DOM đã sẵn sàng (getElementById trả về element thật)
 *   2. core.js (defer) đã chạy xong → window.Garage tồn tại
 */
document.addEventListener('DOMContentLoaded', () => {
    // ── DOM refs ──────────────────────────────────────────────────────────────
    const API_URL        = Garage.base;
    const loginForm      = document.getElementById('loginForm');
    const registerForm   = document.getElementById('registerForm');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink  = document.getElementById('showLogin');
    const messageBox     = document.getElementById('messageBox');

    // ── Helpers ───────────────────────────────────────────────────────────────
    function showMessage(message, type = 'error') {
        messageBox.textContent = message;
        messageBox.className = `message-box show ${type}`;
    }

    function hideMessage() {
        messageBox.className = 'message-box';
    }

    function setMode(register, focus = true) {
        loginForm.classList.toggle('active', !register);
        registerForm.classList.toggle('active', register);
        document.title = `AutoPro · ${register ? 'Đăng ký' : 'Đăng nhập'}`;
        document.querySelectorAll('[data-auth-mode]').forEach(button => button.setAttribute('aria-pressed', String((button.dataset.authMode === 'register') === register)));
        history.replaceState(null, '', `?mode=${register ? 'register' : 'login'}`);
        if (focus) document.getElementById(register ? 'registerFullName' : 'loginEmail').focus();
    }
    document.querySelectorAll('[data-password]').forEach(button => button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.password);
        const reveal = input.type === 'password';
        input.type = reveal ? 'text' : 'password';
        button.textContent = reveal ? 'Ẩn' : 'Hiện';
        button.setAttribute('aria-pressed', String(reveal));
        button.setAttribute('aria-label', reveal ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    }));
    document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => {
        setMode(button.dataset.authMode === 'register'); hideMessage();
    }));

    function getRedirectUrl(role) {
        switch (role) {
            case 'advisor': return '/advisor';
            case 'accountant': return '/accountant';
            case 'hr': return '/hr';
            case 'admin':    return '/admin';
            case 'mechanic': return '/mechanic';
            case 'customer': return '/customer';
            default:         return '/login';
        }
    }

    function getRoleDisplayName(role) {
        switch (role) {
            case 'advisor': return 'Cố vấn dịch vụ';
            case 'accountant': return 'Kế toán';
            case 'hr': return 'Nhân sự';
            case 'admin':    return 'Quản Trị Viên';
            case 'mechanic': return 'Kỹ Thuật Viên';
            case 'customer': return 'Khách Hàng';
            default:         return 'Người dùng';
        }
    }

    // ── Nếu đã đăng nhập → redirect luôn ────────────────────────────────────
    const token   = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
        try {
            const user = JSON.parse(userStr);
            window.location.replace(getRedirectUrl(user.role));
            return; // dừng lại, không gắn event nào nữa
        } catch {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    }

    // ── Kiểm tra query ?mode=register ────────────────────────────────────────
    const mode = new URLSearchParams(window.location.search).get('mode');
    if (new URLSearchParams(window.location.search).get('password') === 'changed') {
        showMessage('Đã đổi mật khẩu. Đăng nhập bằng mật khẩu mới để tiếp tục.', 'success');
    }
    if (mode === 'register') {
        setMode(true, false);
    }

    // ── Chuyển tab Đăng ký / Đăng nhập ───────────────────────────────────────
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        setMode(true);
        hideMessage();
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        setMode(false);
        hideMessage();
    });

    // ── Đăng nhập ─────────────────────────────────────────────────────────────
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!loginForm.reportValidity() || loginForm.querySelector('[type="submit"]').disabled) return;
        hideMessage();

        const email    = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            showMessage('Vui lòng nhập đầy đủ thông tin', 'error');
            return;
        }

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang đăng nhập…';

        try {
            const response = await Garage.apiFetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const result = await response.json();

            if (result.success) {
                localStorage.setItem('token', result.data.token);
                localStorage.setItem('user', JSON.stringify(result.data.user));

                const role     = result.data.user.role;
                showMessage(`Đăng nhập thành công! Chào mừng ${getRoleDisplayName(role)}...`, 'success');

                setTimeout(() => { window.location.replace(getRedirectUrl(role)); }, 800);
            } else {
                showMessage(result.message || 'Đăng nhập thất bại', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Đăng nhập';
            }
        } catch (err) {
            console.error('Login error:', err);
            showMessage('Lỗi kết nối đến server', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Đăng nhập';
        }
    });

    // ── Đăng ký ──────────────────────────────────────────────────────────────
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!registerForm.reportValidity() || registerForm.querySelector('[type="submit"]').disabled) return;
        hideMessage();

        const fullName        = document.getElementById('registerFullName').value.trim();
        const username        = document.getElementById('registerUsername').value.trim();
        const email           = document.getElementById('registerEmail').value.trim();
        const password        = document.getElementById('registerPassword').value;
        const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

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
        submitBtn.textContent = 'Đang đăng ký…';

        try {
            const response = await Garage.apiFetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName, username, email, password }),
            });

            const result = await response.json();

            if (result.success) {
                showMessage('Đăng ký thành công! Vui lòng đăng nhập.', 'success');
                registerForm.reset();
                setTimeout(() => {
                    document.getElementById('loginEmail').value = email;
                    setMode(false);
                }, 2000);
            } else {
                showMessage(result.message || 'Đăng ký thất bại', 'error');
            }
        } catch (err) {
            console.error('Register error:', err);
            showMessage('Lỗi kết nối đến server', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Tạo tài khoản';
        }
    });
});
