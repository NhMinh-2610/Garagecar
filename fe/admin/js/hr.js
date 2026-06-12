// HR Module - Mechanics & User Account Management
const HR_API = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
    loadMechanics();
    loadUsers();

    // Add Mechanic Modal
    const btnAddMechanic = document.getElementById('btnAddMechanic');
    const hrModal = document.getElementById('hrModal');
    const closeHrModal = document.getElementById('closeHrModal');

    if (btnAddMechanic) {
        btnAddMechanic.addEventListener('click', () => {
            hrModal.style.display = 'block';
        });
    }
    if (closeHrModal) {
        closeHrModal.addEventListener('click', () => {
            hrModal.style.display = 'none';
        });
    }

    // Add Mechanic Form
    const hrForm = document.getElementById('hrForm');
    if (hrForm) {
        hrForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await createMechanic();
        });
    }

    // Create User Account Modal
    const btnCreateUser = document.getElementById('btnCreateUser');
    const userModal = document.getElementById('userModal');
    const closeUserModal = document.getElementById('closeUserModal');

    if (btnCreateUser) {
        btnCreateUser.addEventListener('click', () => {
            userModal.style.display = 'block';
        });
    }
    if (closeUserModal) {
        closeUserModal.addEventListener('click', () => {
            userModal.style.display = 'none';
        });
    }

    // Create User Form
    const createUserForm = document.getElementById('createUserForm');
    if (createUserForm) {
        createUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await createUserAccount();
        });
    }
});

function getToken() {
    return localStorage.getItem('token');
}

// ===== MECHANICS =====
async function loadMechanics() {
    try {
        const response = await fetch(`${HR_API}/mechanics`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const result = await response.json();

        const tbody = document.querySelector('#mechanicsTable tbody');
        if (!result.success || !result.data || result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #6b7280;">Chưa có thợ nào</td></tr>';
            return;
        }

        tbody.innerHTML = result.data.map(m => `
            <tr>
                <td><strong>${m.fullName}</strong></td>
                <td>${m.phone || '---'}</td>
                <td>${m.specialty || 'Chung'}</td>
                <td><span class="badge badge-done">Hoạt động</span></td>
                <td>
                    <button class="btn btn-sm btn-secondary" style="color: #ef4444;" onclick="deleteMechanic(${m.id}, '${m.fullName}')">
                        <i class="fa-solid fa-trash"></i> Xóa
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Load mechanics error:', error);
    }
}

async function createMechanic() {
    const name = document.getElementById('mechName').value.trim();
    const phone = document.getElementById('mechPhone').value.trim();
    const specialty = document.getElementById('mechSpecialty').value;

    if (!name) {
        showToast('Vui lòng nhập tên thợ', 'warning');
        return;
    }

    try {
        const response = await fetch(`${HR_API}/mechanics`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ fullName: name, phone, specialty })
        });

        const result = await response.json();
        if (result.success) {
            showToast('Thêm thợ thành công!', 'success');
            document.getElementById('hrForm').reset();
            document.getElementById('hrModal').style.display = 'none';
            loadMechanics();
        } else {
            showToast(result.message || 'Lỗi thêm thợ', 'error');
        }
    } catch (error) {
        console.error('Create mechanic error:', error);
        showToast('Lỗi kết nối server', 'error');
    }
}

async function deleteMechanic(id, name) {
    if (!confirm(`Xóa thợ "${name}"?`)) return;

    try {
        const response = await fetch(`${HR_API}/mechanics/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        const result = await response.json();
        if (result.success) {
            showToast('Đã xóa thợ', 'success');
            loadMechanics();
        } else {
            showToast(result.message || 'Lỗi xóa thợ', 'error');
        }
    } catch (error) {
        showToast('Lỗi kết nối server', 'error');
    }
}

// ===== USER ACCOUNTS =====
async function loadUsers() {
    try {
        const response = await fetch(`${HR_API}/auth/users`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const result = await response.json();

        const tbody = document.querySelector('#usersTable tbody');
        if (!result.success || !result.data || result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #6b7280;">Không có tài khoản</td></tr>';
            return;
        }

        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

        tbody.innerHTML = result.data.map(user => {
            const roleMap = {
                'admin': { label: 'Admin', class: 'badge-done' },
                'mechanic': { label: 'Thợ', class: 'badge-working' },
                'customer': { label: 'Khách', class: 'badge-pending' },
                'accountant': { label: 'Kế Toán', class: 'badge-warning' }
            };
            const role = roleMap[user.role] || { label: user.role, class: 'badge-pending' };
            const isSelf = user.id === currentUser.id;

            return `
                <tr>
                    <td><strong>${user.username}</strong></td>
                    <td>${user.fullName}</td>
                    <td>${user.email}</td>
                    <td><span class="badge ${role.class}">${role.label}</span></td>
                    <td>${new Date(user.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td>
                        ${isSelf ? '<span style="color: #6b7280; font-size: 0.85rem;">Bạn</span>' : `
                            <button class="btn btn-sm btn-secondary" style="color: #ef4444;" onclick="deleteUser(${user.id}, '${user.username}')">
                                <i class="fa-solid fa-trash"></i> Xóa
                            </button>
                        `}
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Load users error:', error);
    }
}

async function createUserAccount() {
    const username = document.getElementById('newUsername').value.trim();
    const fullName = document.getElementById('newFullName').value.trim();
    const email = document.getElementById('newEmail').value.trim();
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;

    if (!username || !fullName || !email || !password || !role) {
        showToast('Vui lòng nhập đầy đủ thông tin', 'warning');
        return;
    }

    if (password.length < 6) {
        showToast('Mật khẩu phải có ít nhất 6 ký tự', 'warning');
        return;
    }

    try {
        const response = await fetch(`${HR_API}/auth/register-staff`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ username, fullName, email, password, role })
        });

        const result = await response.json();
        if (result.success) {
            showToast(`Tạo tài khoản ${role} thành công!`, 'success');
            document.getElementById('createUserForm').reset();
            document.getElementById('userModal').style.display = 'none';
            loadUsers();
        } else {
            showToast(result.message || 'Lỗi tạo tài khoản', 'error');
        }
    } catch (error) {
        console.error('Create user error:', error);
        showToast('Lỗi kết nối server', 'error');
    }
}

async function deleteUser(userId, username) {
    if (!confirm(`Xóa tài khoản "${username}"? Hành động này không thể hoàn tác!`)) return;

    try {
        const response = await fetch(`${HR_API}/auth/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        const result = await response.json();
        if (result.success) {
            showToast('Đã xóa tài khoản', 'success');
            loadUsers();
        } else {
            showToast(result.message || 'Lỗi xóa tài khoản', 'error');
        }
    } catch (error) {
        showToast('Lỗi kết nối server', 'error');
    }
}
