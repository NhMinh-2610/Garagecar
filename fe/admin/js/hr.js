// HR Module - Mechanics & User Account Management
const HR_API = Garage.base;

document.addEventListener('DOMContentLoaded', () => {
    loadMechanics();
    loadUsers();
    Garage.subscribe(loadMechanics);
    Garage.subscribe(loadUsers);

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
        const response = await Garage.apiFetch(`${HR_API}/mechanics`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const result = await response.json();

        const tbody = document.querySelector('#mechanicsTable tbody');
        if (!result.success || !result.data || result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #6b7280;">Chưa có thợ nào</td></tr>';
            return;
        }

        const staffSelect = document.getElementById("staffMechanicId");
        const current = staffSelect.value;
        staffSelect.replaceChildren(new Option("Tạo hồ sơ mới", ""), ...result.data.filter(m => !m.userId).map(m => new Option(m.fullName, m.id)));
        staffSelect.value = current;
        tbody.innerHTML = result.data.map(m => `
            <tr>
                <td><strong>${escapeHtml(m.fullName)}</strong> ${m.userId ? '' : '<small>(chưa liên kết tài khoản)</small>'}</td>
                <td>${escapeHtml(m.phone || '---')}</td>
                <td>${escapeHtml(m.specialty || 'Chung')}</td>
                <td><span class="badge badge-done">Hoạt động</span></td>
                <td>
                    <button class="btn btn-sm" onclick="linkMechanicAccount(${m.id})">Tài khoản</button><button class="btn btn-sm btn-secondary" style="color: #ef4444;" onclick="deleteMechanic(${m.id})">
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
        const response = await Garage.apiFetch(`${HR_API}/mechanics`, {
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
    if (!confirm(`Xóa thợ "#${id}"?`)) return;

    try {
        const response = await Garage.apiFetch(`${HR_API}/mechanics/${id}`, {
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
        const response = await Garage.apiFetch(`${HR_API}/auth/users`, {
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
                    <td><strong>${escapeHtml(user.username)}</strong></td>
                    <td>${escapeHtml(user.fullName)}</td>
                    <td>${escapeHtml(user.email)}</td>
                    <td><span class="badge ${role.class}">${role.label}</span></td>
                    <td>${new Date(user.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td>
                        ${isSelf ? '<span style="color: #6b7280; font-size: 0.85rem;">Bạn</span>' : `
                            <button class="btn btn-sm btn-secondary" style="color: #ef4444;" onclick="deleteUser(${user.id})">
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
        const response = await Garage.apiFetch(`${HR_API}/auth/register-staff`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ username, fullName, email, password, role, mechanicId: role === "mechanic" ? Number(document.getElementById("staffMechanicId").value) || null : null })
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
    if (!confirm(`Xóa tài khoản "#${userId}"? Hành động này không thể hoàn tác!`)) return;

    try {
        const response = await Garage.apiFetch(`${HR_API}/auth/users/${userId}`, {
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

async function linkMechanicAccount(id) {
    try {
        const [users,mechanics] = await Promise.all([Garage.request('/auth/users'),Garage.request('/mechanics')]);
        const current = mechanics.find(m => m.id === id);
        let dialog = document.getElementById('linkMechanicDialog');
        if (!dialog) { dialog = document.createElement('dialog'); dialog.id = 'linkMechanicDialog'; document.body.append(dialog); }
        dialog.innerHTML = '<h3>Liên kết tài khoản thợ</h3><label for="mechanicAccount">Tài khoản</label><select id="mechanicAccount"></select><p class="field-help">Thợ đăng nhập bằng tài khoản này để xem phiếu được giao.</p><button class="btn btn-primary" id="saveMechanicAccount">Lưu</button><form method="dialog"><button class="btn btn-secondary">Đóng</button></form>';
        const select = dialog.querySelector('select');
        select.replaceChildren(new Option('Chưa liên kết',''), ...users.filter(u => u.role === 'mechanic' && !mechanics.some(m => m.userId === u.id && m.id !== id)).map(u => new Option(u.fullName + ' — ' + u.email,u.id)));
        select.value = current.userId || '';
        dialog.querySelector('#saveMechanicAccount').onclick = async () => {
            try { await Garage.request('/mechanics/' + id,{method:'PUT',body:{userId:Number(select.value)||null}}); dialog.close(); showToast('Đã lưu liên kết.','success'); }
            catch(error) { showToast(error.message,'error'); }
        };
        dialog.showModal();
    } catch(error) { showToast(error.message,'error'); }
}
