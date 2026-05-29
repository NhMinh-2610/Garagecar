// Dashboard Statistics Module - Enhanced
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    
    if (!token) return;

    // Fetch and update dashboard stats
    const updateDashboardStats = async () => {
        try {
            // Fetch vehicles
            const vehiclesRes = await fetch('http://localhost:3000/api/vehicles', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!vehiclesRes.ok) return;
            
            const vehiclesData = await vehiclesRes.json();
            const vehicles = vehiclesData.data || [];

            // Calculate stats
            const today = new Date().toDateString();
            const todayVehicles = vehicles.filter(v => 
                new Date(v.receivedDate).toDateString() === today
            ).length;
            
            const workingCount = vehicles.filter(v => v.status === 'working').length;
            const doneCount = vehicles.filter(v => v.status === 'done').length;

            // Fetch repairs for revenue
            const repairsRes = await fetch('http://localhost:3000/api/repairs', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            let totalRevenue = 0;
            let repairs = [];
            if (repairsRes.ok) {
                const repairsData = await repairsRes.json();
                repairs = repairsData.data || [];
                totalRevenue = repairs
                    .filter(r => r.status === 'paid' || r.status === 'completed')
                    .reduce((sum, r) => sum + parseFloat(r.totalAmount || 0), 0);
            }

            // Update main stat cards
            const stats = document.querySelectorAll('.stat-card .stat-info h3');
            if (stats[0]) stats[0].textContent = todayVehicles;
            if (stats[1]) stats[1].textContent = workingCount;
            if (stats[2]) stats[2].textContent = doneCount;
            if (stats[3]) stats[3].textContent = (totalRevenue / 1000000).toFixed(1) + 'M';

            // Weekly stats
            updateWeeklyStats(vehicles, repairs);

            // Recent activities
            updateRecentActivities(vehicles, repairs);

            // Alerts
            updateAlerts(vehicles);

        } catch (error) {
            console.error('Dashboard stats error:', error);
        }
    };

    // Weekly statistics
    function updateWeeklyStats(vehicles, repairs) {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const weeklyVehicles = vehicles.filter(v => 
            new Date(v.receivedDate) > oneWeekAgo
        ).length;

        const weeklyRepairs = repairs.filter(r => 
            new Date(r.createdAt) > oneWeekAgo
        ).length;

        const weeklyRevenue = repairs
            .filter(r => new Date(r.createdAt) > oneWeekAgo && (r.status === 'paid' || r.status === 'completed'))
            .reduce((sum, r) => sum + parseFloat(r.totalAmount || 0), 0);

        document.getElementById('weeklyVehicles').textContent = weeklyVehicles;
        document.getElementById('weeklyRepairs').textContent = weeklyRepairs;
        document.getElementById('weeklyRevenue').textContent = weeklyRevenue.toLocaleString('vi-VN') + 'đ';
    }

    // Recent activities feed
    function updateRecentActivities(vehicles, repairs) {
        const container = document.getElementById('recentActivities');
        if (!container) return;

        // Combine and sort recent activities
        const activities = [];

        // Add recent vehicles
        vehicles.slice(0, 5).forEach(v => {
            activities.push({
                time: new Date(v.receivedDate),
                type: 'vehicle',
                icon: 'fa-car',
                color: '#3b82f6',
                text: `Tiếp nhận xe ${v.licensePlate} - ${v.customerName}`,
                data: v
            });
        });

        // Add recent repairs
        repairs.slice(0, 5).forEach(r => {
            if (r.vehicle) {
                activities.push({
                    time: new Date(r.createdAt),
                    type: 'repair',
                    icon: 'fa-wrench',
                    color: r.status === 'paid' ? '#10b981' : '#f59e0b',
                    text: `Phiếu sửa ${r.vehicle.licensePlate} - ${r.status === 'paid' ? 'Đã thanh toán' : 'Hoàn thành'}`,
                    data: r
                });
            }
        });

        // Sort by time
        activities.sort((a, b) => b.time - a.time);

        // Render
        container.innerHTML = activities.slice(0, 10).map(act => `
            <div style="display: flex; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid #e5e7eb;">
                <div style="width: 36px; height: 36px; background: ${act.color}15; color: ${act.color}; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                    <i class="fa-solid ${act.icon}"></i>
                </div>
                <div style="flex: 1;">
                    <p style="margin: 0; font-size: 0.875rem;">${act.text}</p>
                    <small style="color: #6b7280;">${formatRelativeTime(act.time)}</small>
                </div>
            </div>
        `).join('');
    }

    // Alerts
    function updateAlerts(vehicles) {
        const container = document.getElementById('alerts');
        if (!container) return;

        const alerts = [];

        // Pending vehicles
        const pendingCount = vehicles.filter(v => v.status === 'pending').length;
        if (pendingCount > 5) {
            alerts.push(`<div style="padding: 0.75rem; background: #fef3c7; border-left: 3px solid #f59e0b; margin-bottom: 0.75rem; border-radius: 4px;">
                <strong style="color: #92400e;">${pendingCount} xe</strong> đang chờ sửa
            </div>`);
        }

        // Working vehicles
        const workingCount = vehicles.filter(v => v.status === 'working').length;
        if (workingCount > 10) {
            alerts.push(`<div style="padding: 0.75rem; background: #dbeafe; border-left: 3px solid #3b82f6; margin-bottom: 0.75rem; border-radius: 4px;">
                <strong style="color: #1e40af;">${workingCount} xe</strong> đang sửa
            </div>`);
        }

        if (alerts.length > 0) {
            container.innerHTML = alerts.join('');
        } else {
            container.innerHTML = '<p style="color: #6b7280; font-size: 0.875rem;">Không có cảnh báo</p>';
        }
    }

    // Helper: Format relative time
    function formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Vừa xong';
        if (diffMins < 60) return `${diffMins} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        return `${diffDays} ngày trước`;
    }

    // Update on page load
    updateDashboardStats();

    // Refresh every 30 seconds
    setInterval(updateDashboardStats, 30000);
});
