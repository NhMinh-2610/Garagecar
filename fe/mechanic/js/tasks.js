// Mechanic Portal - Tasks Module
let allTasks = [];

document.addEventListener('DOMContentLoaded', () => {
    loadMyTasks();
});

// Tab switching
function switchTaskTab(tab) {
    const tabs = document.querySelectorAll('.task-tab');
    const contents = document.querySelectorAll('.task-tab-content');

    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => { c.classList.remove('active'); c.style.display = 'none'; });

    if (tab === 'working') {
        tabs[0].classList.add('active');
        document.getElementById('tabWorking').classList.add('active');
        document.getElementById('tabWorking').style.display = 'block';
    } else {
        tabs[1].classList.add('active');
        document.getElementById('tabCompleted').classList.add('active');
        document.getElementById('tabCompleted').style.display = 'block';
    }
}

async function loadMyTasks() {
    try {
        const response = await fetch(`${API_URL}/repairs/my-tasks`, { headers: getAuthHeaders() });
        const result = await response.json();

        if (!result.success) {
            showToast('Lỗi tải công việc', 'error');
            return;
        }

        allTasks = result.data || [];

        // Update stats
        const working = allTasks.filter(t => t.status === 'draft' || t.status === 'working');
        const done = allTasks.filter(t => t.status === 'completed' || t.status === 'paid');
        
        document.getElementById('statTotal').textContent = allTasks.length;
        document.getElementById('statWorking').textContent = working.length;
        document.getElementById('statDone').textContent = done.length;

        // Render tasks
        renderWorkingTasks(working);
        renderCompletedTasks(done);

    } catch (error) {
        console.error('Error loading tasks:', error);
        showToast('Lỗi kết nối server', 'error');
    }
}

function renderWorkingTasks(tasks) {
    const container = document.getElementById('workingTasks');

    if (tasks.length === 0) {
        container.innerHTML = '<p class="empty-state">🎉 Không có công việc nào đang xử lý</p>';
        return;
    }

    container.innerHTML = tasks.map(task => {
        const vehicle = task.vehicle;
        const items = task.items || [];
        const completedItems = items.filter(i => i.isCompleted).length;
        const totalItems = items.length;
        const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
        const canComplete = totalItems > 0 && completedItems === totalItems;

        const statusBadge = task.status === 'draft' 
            ? '<span class="badge badge-pending">Chờ bắt đầu</span>'
            : '<span class="badge badge-working">Đang sửa</span>';

        return `
            <div class="task-card" id="task-${task.id}">
                <div class="task-card-header">
                    <h4>${vehicle ? vehicle.licensePlate : 'N/A'} - ${vehicle ? vehicle.carBrand + ' ' + (vehicle.carModel || '') : ''}</h4>
                    ${statusBadge}
                </div>

                <div class="task-card-meta">
                    <span><i class="fa-solid fa-user"></i> ${vehicle ? vehicle.customerName : 'N/A'}</span>
                    <span><i class="fa-solid fa-calendar"></i> ${formatDate(task.createdAt)}</span>
                    <span><i class="fa-solid fa-coins"></i> ${formatCurrency(task.totalAmount)}</span>
                </div>

                <!-- Progress -->
                <div>
                    <div class="progress-bar">
                        <div class="progress-bar-fill" style="width: ${progressPct}%"></div>
                    </div>
                    <div class="progress-text">
                        <span>${completedItems}/${totalItems} hạng mục</span>
                        <span>${progressPct}%</span>
                    </div>
                </div>

                <!-- Checklist -->
                <div class="checklist">
                    ${items.map(item => `
                        <div class="checklist-item ${item.isCompleted ? 'done' : ''}" onclick="toggleItem(${task.id}, ${item.id}, ${!item.isCompleted})">
                            <input type="checkbox" ${item.isCompleted ? 'checked' : ''} 
                                onclick="event.stopPropagation(); toggleItem(${task.id}, ${item.id}, ${!item.isCompleted})">
                            <span class="item-name">${item.taskName}</span>
                            <span class="item-price">${item.partName !== '---' ? item.partName + ' · ' : ''}${formatCurrency(item.totalPrice)}</span>
                        </div>
                    `).join('')}
                </div>

                <div class="task-actions">
                    ${task.status === 'draft' ? `
                        <button class="btn btn-primary btn-sm" onclick="startRepair(${task.id})">
                            <i class="fa-solid fa-play"></i> Bắt đầu sửa
                        </button>
                    ` : ''}
                    <button class="btn btn-success btn-sm" onclick="completeRepair(${task.id})" ${!canComplete ? 'disabled' : ''}>
                        <i class="fa-solid fa-check-double"></i> Hoàn thành phiếu
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderCompletedTasks(tasks) {
    const container = document.getElementById('completedTasks');

    if (tasks.length === 0) {
        container.innerHTML = '<p class="empty-state">Chưa có công việc hoàn thành</p>';
        return;
    }

    container.innerHTML = tasks.map(task => {
        const vehicle = task.vehicle;
        const items = task.items || [];
        const statusLabel = task.status === 'paid' ? 'Đã thanh toán' : 'Hoàn thành';
        const statusClass = task.status === 'paid' ? 'badge-paid' : 'badge-done';

        return `
            <div class="task-card completed">
                <div class="task-card-header">
                    <h4>${vehicle ? vehicle.licensePlate : 'N/A'} - ${vehicle ? vehicle.carBrand + ' ' + (vehicle.carModel || '') : ''}</h4>
                    <span class="badge ${statusClass}">${statusLabel}</span>
                </div>
                <div class="task-card-meta">
                    <span><i class="fa-solid fa-user"></i> ${vehicle ? vehicle.customerName : 'N/A'}</span>
                    <span><i class="fa-solid fa-calendar"></i> Hoàn thành: ${formatDate(task.completedAt)}</span>
                    <span><i class="fa-solid fa-coins"></i> ${formatCurrency(task.totalAmount)}</span>
                    <span><i class="fa-solid fa-list-check"></i> ${items.length} hạng mục</span>
                </div>
            </div>
        `;
    }).join('');
}

async function toggleItem(ticketId, itemId, isCompleted) {
    try {
        const response = await fetch(`${API_URL}/repairs/${ticketId}/items/${itemId}/toggle`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ isCompleted })
        });

        const result = await response.json();

        if (result.success) {
            showToast(isCompleted ? 'Đã hoàn thành hạng mục' : 'Đã bỏ đánh dấu', 'success');
            // Reload tasks to refresh progress
            await loadMyTasks();
        } else {
            showToast(result.message || 'Lỗi cập nhật', 'error');
        }
    } catch (error) {
        console.error('Toggle item error:', error);
        showToast('Lỗi kết nối server', 'error');
    }
}

async function startRepair(ticketId) {
    try {
        const response = await fetch(`${API_URL}/repairs/${ticketId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: 'working' })
        });

        const result = await response.json();

        if (result.success) {
            showToast('Đã bắt đầu sửa chữa!', 'success');
            await loadMyTasks();
        } else {
            showToast(result.message || 'Lỗi cập nhật', 'error');
        }
    } catch (error) {
        console.error('Start repair error:', error);
        showToast('Lỗi kết nối server', 'error');
    }
}

async function completeRepair(ticketId) {
    if (!confirm('Xác nhận hoàn thành phiếu sửa chữa này?')) return;

    try {
        const response = await fetch(`${API_URL}/repairs/${ticketId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: 'completed' })
        });

        const result = await response.json();

        if (result.success) {
            showToast('🎉 Phiếu sửa chữa đã hoàn thành!', 'success');
            await loadMyTasks();
        } else {
            showToast(result.message || 'Lỗi hoàn thành phiếu', 'error');
        }
    } catch (error) {
        console.error('Complete repair error:', error);
        showToast('Lỗi kết nối server', 'error');
    }
}
