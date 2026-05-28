// Auth & HR Module Logic
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    // HR Actions
    const editBtns = document.querySelectorAll('#hr-section .text-blue');
    editBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            alert('Chức năng sửa thông tin nhân viên (Demo)');
        });
    });

    // Logout Action
    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', () => {
             if(confirm('Bạn có chắc muốn đăng xuất?')) {
                localStorage.removeItem('token');
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
        // Update UI with user info
        const userNameEl = document.querySelector('.user-info h4');
        const userRoleEl = document.querySelector('.user-info small');
        const userAvatarEl = document.querySelector('.user-info img');

        if(userNameEl) userNameEl.innerText = user.fullName || user.username;
        if(userRoleEl) userRoleEl.innerText = getRoleName(user.role);
        // Optional: Avatar based on name
        if(userAvatarEl) userAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=random`;

    } catch (e) {
        console.error('Error parsing user data:', e);
        localStorage.clear();
        window.location.href = '../login/index.html';
    }
}

function getRoleName(role) {
    switch(role) {
        case 'admin': return 'Quản Trị Viên';
        case 'staff': return 'Nhân Viên';
        case 'accountant': return 'Kế Toán';
        default: return 'Thành Viên';
    }
}
