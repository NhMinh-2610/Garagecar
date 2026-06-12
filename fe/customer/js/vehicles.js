// Customer Portal - Vehicles Module
document.addEventListener('DOMContentLoaded', () => {
    loadMyVehicles();
});

async function loadMyVehicles() {
    try {
        const response = await fetch(`${API_URL}/vehicles/my-vehicles`, { headers: getAuthHeaders() });
        const result = await response.json();

        const tbody = document.querySelector('#vehiclesTable tbody');

        if (!result.success || !result.data || result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Chưa có xe nào được tiếp nhận</td></tr>';
            return;
        }

        tbody.innerHTML = result.data.map(vehicle => {
            const statusMap = {
                'waiting': { label: 'Chờ sửa', class: 'badge-pending' },
                'pending': { label: 'Chờ sửa', class: 'badge-pending' },
                'repairing': { label: 'Đang sửa', class: 'badge-working' },
                'working': { label: 'Đang sửa', class: 'badge-working' },
                'completed': { label: 'Hoàn thành', class: 'badge-done' },
                'delivered': { label: 'Đã giao', class: 'badge-paid' }
            };
            const status = statusMap[vehicle.status] || { label: vehicle.status, class: 'badge-pending' };

            return `
                <tr>
                    <td><strong>${vehicle.licensePlate}</strong></td>
                    <td>${vehicle.carBrand || '---'}</td>
                    <td>${vehicle.carModel || '---'}</td>
                    <td><span class="badge ${status.class}">${status.label}</span></td>
                    <td>${formatDate(vehicle.receivedDate)}</td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading vehicles:', error);
        showToast('Lỗi tải danh sách xe', 'error');
    }
}
