// Customer Portal - Repairs Module
document.addEventListener('DOMContentLoaded', () => {
    loadMyRepairs();

    // Close modal
    const closeBtn = document.getElementById('closeRepairDetail');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.getElementById('repairDetailModal').style.display = 'none';
        });
    }

    // Close modal on outside click
    const modal = document.getElementById('repairDetailModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }
});

async function loadMyRepairs() {
    try {
        const response = await fetch(`${API_URL}/repairs/my-repairs`, { headers: getAuthHeaders() });
        const result = await response.json();

        const tbody = document.querySelector('#repairsTable tbody');

        if (!result.success || !result.data || result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Chưa có phiếu sửa chữa nào</td></tr>';
            return;
        }

        tbody.innerHTML = result.data.map(repair => {
            const statusMap = {
                'draft': { label: 'Chờ xử lý', class: 'badge-pending' },
                'working': { label: 'Đang sửa', class: 'badge-working' },
                'completed': { label: 'Hoàn thành', class: 'badge-done' },
                'paid': { label: 'Đã thanh toán', class: 'badge-paid' }
            };
            const status = statusMap[repair.status] || { label: repair.status, class: 'badge-pending' };
            const vehicleInfo = repair.vehicle ? `${repair.vehicle.licensePlate} - ${repair.vehicle.carBrand}` : 'N/A';
            
            // Progress calculation
            const totalItems = repair.items ? repair.items.length : 0;
            const completedItems = repair.items ? repair.items.filter(i => i.isCompleted).length : 0;
            const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

            return `
                <tr>
                    <td><strong>#${repair.id}</strong></td>
                    <td>${vehicleInfo}</td>
                    <td>${repair.mechanicName || '---'}</td>
                    <td>
                        <div style="min-width: 120px;">
                            <span style="font-size: 0.85rem; color: var(--text-muted);">${completedItems}/${totalItems} (${progressPct}%)</span>
                            <div class="progress-bar">
                                <div class="progress-bar-fill" style="width: ${progressPct}%"></div>
                            </div>
                        </div>
                    </td>
                    <td><strong>${formatCurrency(repair.totalAmount)}</strong></td>
                    <td><span class="badge ${status.class}">${status.label}</span></td>
                    <td>
                        <button class="btn btn-sm btn-secondary" onclick="viewRepairDetail(${repair.id})">
                            <i class="fa-solid fa-eye"></i> Xem
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading repairs:', error);
        showToast('Lỗi tải lịch sử sửa chữa', 'error');
    }
}

async function viewRepairDetail(repairId) {
    try {
        const response = await fetch(`${API_URL}/repairs/${repairId}`, { headers: getAuthHeaders() });
        const result = await response.json();

        if (!result.success) {
            showToast(result.message || 'Không tìm thấy phiếu', 'error');
            return;
        }

        const repair = result.data;
        const vehicle = repair.vehicle;
        const statusMap = {
            'draft': 'Chờ xử lý',
            'working': 'Đang sửa',
            'completed': 'Hoàn thành',
            'paid': 'Đã thanh toán'
        };

        const totalItems = repair.items ? repair.items.length : 0;
        const completedItems = repair.items ? repair.items.filter(i => i.isCompleted).length : 0;

        const content = document.getElementById('repairDetailContent');
        content.innerHTML = `
            <div class="repair-detail-info">
                <p><strong>Mã phiếu:</strong> <span>#${repair.id}</span></p>
                <p><strong>Xe:</strong> <span>${vehicle ? vehicle.licensePlate + ' - ' + vehicle.carBrand + ' ' + (vehicle.carModel || '') : 'N/A'}</span></p>
                <p><strong>Thợ phụ trách:</strong> <span>${repair.mechanicName || 'Chưa phân công'}</span></p>
                <p><strong>Trạng thái:</strong> <span>${statusMap[repair.status] || repair.status}</span></p>
                <p><strong>Tiến độ:</strong> <span>${completedItems}/${totalItems} hạng mục hoàn thành</span></p>
                <p><strong>Tổng tiền:</strong> <span style="color: var(--primary-color); font-weight: 700;">${formatCurrency(repair.totalAmount)}</span></p>
                <p><strong>Ngày tạo:</strong> <span>${formatDate(repair.createdAt)}</span></p>
                ${repair.completedAt ? `<p><strong>Ngày hoàn thành:</strong> <span>${formatDate(repair.completedAt)}</span></p>` : ''}
            </div>

            <h4 style="margin-bottom: 0.75rem; font-size: 1rem;">
                <i class="fa-solid fa-list-check"></i> Chi tiết hạng mục
            </h4>
            <div class="repair-items-list">
                ${repair.items && repair.items.length > 0 ? repair.items.map(item => `
                    <div class="repair-item-row ${item.isCompleted ? 'completed' : 'pending'}">
                        <div>
                            <strong>${item.taskName}</strong>
                            <span style="font-size: 0.85rem; color: var(--text-muted); margin-left: 0.5rem;">
                                (Vật tư: ${item.partName || '---'})
                            </span>
                        </div>
                        <div style="text-align: right;">
                            <span style="font-weight: 600;">${formatCurrency(item.totalPrice)}</span>
                            <br>
                            <span style="font-size: 0.8rem; color: ${item.isCompleted ? '#10b981' : '#f59e0b'};">
                                ${item.isCompleted ? '✅ Hoàn thành' : '⏳ Đang xử lý'}
                            </span>
                        </div>
                    </div>
                `).join('') : '<p class="empty-state">Không có hạng mục</p>'}
            </div>
        `;

        document.getElementById('repairDetailModal').style.display = 'block';

    } catch (error) {
        console.error('Error loading repair detail:', error);
        showToast('Lỗi tải chi tiết phiếu', 'error');
    }
}
