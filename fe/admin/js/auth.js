// Auth & HR Module Logic
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    // Logout Action
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Bạn có chắc muốn đăng xuất?')) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('activeSection');
                localStorage.removeItem('activeTitle');
                window.location.href = '../login/index.html'; 
            }
        });
    }
});

function checkAuth() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
        alert('Vui lòng đăng nhập để truy cập!');
        window.location.href = '../login/index.html';
        return;
    }

    try {
        const user = JSON.parse(userStr);

        // Check role - only admins allowed here
        if (user.role !== 'admin') {
            // Redirect to correct portal
            const redirectMap = {
                'mechanic': '../mechanic/',
                'customer': '../customer/',
            };
            const redirectUrl = redirectMap[user.role] || '../login/index.html';
            window.location.href = redirectUrl;
            return;
        }

        // Update UI with user info
        const userNameEl = document.querySelector('.user-info h4');
        const userRoleEl = document.querySelector('.user-info small');
        const userAvatarEl = document.querySelector('.user-info img');

        if (userNameEl) userNameEl.innerText = user.fullName || user.username;
        if (userRoleEl) userRoleEl.innerText = getRoleName(user.role);
        if (userAvatarEl) userAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=random`;

    } catch (e) {
        console.error('Error parsing user data:', e);
        localStorage.clear();
        window.location.href = '../login/index.html';
    }
}

function getRoleName(role) {
    switch(role) {
        case 'admin': return 'Quản Trị Viên';
        case 'mechanic': return 'Kỹ Thuật Viên';
        case 'customer': return 'Khách Hàng';
        case 'accountant': return 'Kế Toán';
        default: return 'Thành Viên';
    }
}
