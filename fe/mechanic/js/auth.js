// Mechanic Portal - Auth Module
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    // Logout Action
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Bạn có chắc muốn đăng xuất?')) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('mechanicActiveSection');
                localStorage.removeItem('mechanicActiveTitle');
                window.location.href = '../login/index.html';
            }
        });
    }
});

function checkAuth() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
        window.location.href = '../login/index.html';
        return;
    }

    try {
        const user = JSON.parse(userStr);

        // Check role - only mechanics allowed here
        if (user.role !== 'mechanic') {
            const redirectMap = {
                'admin': '../admin/',
                'customer': '../customer/',
            };
            window.location.href = redirectMap[user.role] || '../login/index.html';
            return;
        }

        // Update UI with user info
        const userNameEl = document.querySelector('.user-info h4');
        const userRoleEl = document.querySelector('.user-info small');
        const userAvatarEl = document.querySelector('.user-info img');

        if (userNameEl) userNameEl.innerText = user.fullName || user.username;
        if (userRoleEl) userRoleEl.innerText = 'Kỹ Thuật Viên';
        if (userAvatarEl) userAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=d97706&color=fff`;

    } catch (e) {
        console.error('Error parsing user data:', e);
        localStorage.clear();
        window.location.href = '../login/index.html';
    }
}
