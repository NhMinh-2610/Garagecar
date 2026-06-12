// Customer Portal - Dashboard Module
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
});

async function loadDashboard() {
    try {
        // Load vehicles
        const vehiclesRes = await fetch(`${API_URL}/vehicles/my-vehicles`, { headers: getAuthHeaders() });
        const vehiclesData = await vehiclesRes.json();
        const vehicles = vehiclesData.success ? vehiclesData.data : [];

        // Load repairs
        const repairsRes = await fetch(`${API_URL}/repairs/my-repairs`, { headers: getAuthHeaders() });
        const repairsData = await repairsRes.json();
        const repairs = repairsData.success ? repairsData.data : [];

        // Update stat cards
        document.getElementById('statVehicles').textContent = vehicles.length;
        document.getElementById('statTotalRepairs').textContent = repairs.length;
        document.getElementById('statActiveRepairs').textContent = repairs.filter(r => r.status === 'draft' || r.status === 'working').length;
        document.getElementById('statCompleted').textContent = repairs.filter(r => r.status === 'completed' || r.status === 'paid').length;

        // Render recent repairs
        renderRecentRepairs(repairs.slice(0, 5));

    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

function renderRecentRepairs(repairs) {
    const container = document.getElementById('recentRepairs');
    
    if (!repairs || repairs.length === 0) {
        container.innerHTML = '<p class="empty-state">Chưa có phiếu sửa chữa nào</p>';
        return;
    }

    container.innerHTML = repairs.map(repair => {
        const statusMap = {
            'draft': { label: 'Chờ xử lý', class: 'badge-pending' },
            'working': { label: 'Đang sửa', class: 'badge-working' },
            'completed': { label: 'Hoàn thành', class: 'badge-done' },
            'paid': { label: 'Đã thanh toán', class: 'badge-paid' }
        };
        const status = statusMap[repair.status] || { label: repair.status, class: 'badge-pending' };
        const vehicleInfo = repair.vehicle ? `${repair.vehicle.licensePlate} - ${repair.vehicle.carBrand}` : 'N/A';
        const totalItems = repair.items ? repair.items.length : 0;
        const completedItems = repair.items ? repair.items.filter(i => i.isCompleted).length : 0;

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid #f1f5f9;">
                <div>
                    <strong style="color: var(--text-main);">${vehicleInfo}</strong>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
                        ${totalItems} hạng mục · ${completedItems}/${totalItems} hoàn thành · ${formatDate(repair.createdAt)}
                    </p>
                </div>
                <span class="badge ${status.class}">${status.label}</span>
            </div>
        `;
    }).join('');
}
