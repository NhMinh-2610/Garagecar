// Module: Repair (Sửa chữa) - Reorganized

// ===== UTILITY FUNCTIONS =====

// Get time warning for repair ticket
function getTimeWarning(ticket) {
    const now = new Date();
    const created = new Date(ticket.createdAt);
    const hoursPassed = (now - created) / (1000 * 60 * 60);
    
    if (ticket.status === 'draft' && hoursPassed > 24) {
        return { level: 'warning', text: '⚠️ Chờ quá lâm (>24h)', color: '#f59e0b' };
    }
    
    if (ticket.status === 'working' && hoursPassed > 48) {
        return { level: 'danger', text: '⚠️ Sửa quá lâu (>48h)', color: '#ef4444' };
    }
    
    if (ticket.status === 'completed') {
        const daysPassed = hoursPassed / 24;
        if (daysPassed > 7) {
            return { level: 'danger', text: '⚠️ Chưa TT >7 ngày!', color: '#ef4444' };
        }
    }
    
    return null;
}

// Format time ago (e.g., "2 giờ trước")
function formatTimeAgo(date) {
    if (!date) return '';
    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return `${diffDays} ngày trước`;
}

// Check if action is allowed based on status
function canPerformAction(status, action) {
    const permissions = {
        'draft': ['start', 'edit', 'delete'],
        'working': ['complete', 'edit', 'delete'],
        'completed': ['pay', 'view'],
        'paid': ['deliver', 'view']
    };
    return permissions[status] && permissions[status].includes(action);
}

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Elements
    const repairsTable = document.querySelector('#repairTable tbody');
    const repairModal = document.getElementById('repairModal');
    const btnNewRepair = document.getElementById('btnNewRepair');
    const closeRepairModal = document.getElementById('closeRepairModal');

    // Form Elements
    const repairVehicleSelect = document.getElementById('repairVehicleSelect');
    const mechanicSelect = document.getElementById('mechanicSelect');
    const btnAddItem = document.getElementById('btnAddItem');
    const repairItemsTable = document.querySelector('#repairItemsTable tbody');
    const totalAmountSpan = document.getElementById('totalAmount');
    const btnSaveTicket = document.getElementById('btnSaveTicket');


    // Inputs
    const taskSelect = document.getElementById('taskSelect');
    const customTask = document.getElementById('customTask');
    const partSelect = document.getElementById('partSelect'); // Changed from partName
    const laborPrice = document.getElementById('laborPrice');
    const partPrice = document.getElementById('partPrice');

    let currentItems = [];
    let allInventoryItems = []; // Store all inventory for filtering

    // Modal Logic
    if (btnNewRepair) {
        btnNewRepair.addEventListener('click', () => {
             openRepairModal();
        });
    }

    // Global function to open modal (can be called from Reception)
    window.openRepairModalWithVehicle = function(vehicleId) {
        openRepairModal(vehicleId);
    };

    function openRepairModal(preSelectedVehicleId = null) {
         // Reset form
         currentItems = [];
         // Reset UI
         if(mechanicSelect) mechanicSelect.value = '';
         partSelect.innerHTML = '<option value="" data-price="0">-- Không dùng vật tư --</option>'; 
         repairModal.style.display = 'block';
         
         // Initial fetches
         loadMechanicsForRepair(); 
         loadInventoryForRepair(); 
         renderItems();

         // Pre-select vehicle if ID provided
         if (preSelectedVehicleId) {
             setTimeout(() => {
                 if (repairVehicleSelect) repairVehicleSelect.value = preSelectedVehicleId;
             }, 500); // Wait for modal/select to be ready
         }
    }

    // Auto-Price: Task & Labor + Filter Parts
    if (taskSelect) {
        taskSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const labor = selectedOption.getAttribute('data-labor') || 0;
            const partFilter = selectedOption.getAttribute('data-part-filter') || '';
            
            if (this.value === 'Khác') {
                customTask.style.display = 'block';
                customTask.focus();
                laborPrice.readOnly = false; // Allow edit for custom
                laborPrice.value = 0;
            } else {
                customTask.style.display = 'none';
                laborPrice.readOnly = true;
                laborPrice.value = labor;
            }

            // Filter parts based on task
            filterPartsByTask(partFilter);
        });
    }

    // Helper: Filter parts dropdown based on task keywords
    function filterPartsByTask(filterKeywords) {
        if (!partSelect || !allInventoryItems.length) return;

        // Clear and reset
        partSelect.innerHTML = '<option value="" data-price="0">-- Không dùng vật tư --</option>';

        // If no filter or wildcard, show all
        if (!filterKeywords || filterKeywords === '*') {
            allInventoryItems.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.setAttribute('data-price', item.unitPrice);
                option.textContent = `${item.name} (Tồn: ${item.quantity} - ${formatCurrency(item.unitPrice)})`;
                partSelect.appendChild(option);
            });
            return;
        }

        // Split keywords and filter
        const keywords = filterKeywords.toLowerCase().split(',').map(k => k.trim());
        const filteredItems = allInventoryItems.filter(item => {
            const itemName = item.name.toLowerCase();
            return keywords.some(keyword => itemName.includes(keyword));
        });

        // Populate with filtered items
        if (filteredItems.length > 0) {
            filteredItems.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.setAttribute('data-price', item.unitPrice);
                option.textContent = `${item.name} (Tồn: ${item.quantity} - ${formatCurrency(item.unitPrice)})`;
                partSelect.appendChild(option);
            });
        } else {
            // If no matching parts, show message
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Không có vật tư phù hợp';
            option.disabled = true;
            partSelect.appendChild(option);
        }
    }

    // Auto-Price: Part
    if (partSelect) {
        partSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const price = selectedOption.getAttribute('data-price') || 0;
            partPrice.value = price;
        });
    }

    // Add Item to Temporary List
    if (btnAddItem) {
        btnAddItem.addEventListener('click', () => {
            const task = taskSelect.value === 'Khác' ? customTask.value : taskSelect.value;
            const hasPart = partSelect.value !== '';
            const partName = hasPart ? partSelect.options[partSelect.selectedIndex].text : '---';
            const labor = parseFloat(laborPrice.value) || 0;
            const partP = parseFloat(partPrice.value) || 0;
            const total = labor + partP;

            // Validation
            if (!taskSelect.value) {
                showToast('Vui lòng chọn công việc', 'error');
                return;
            }
            if (taskSelect.value === 'Khác' && !customTask.value.trim()) {
                showToast('Vui lòng nhập tên công việc khác', 'error');
                return;
            }
            // If part is selected (value not empty), price should be > 0 ideally, but let's just allow 0 if free.
            // But if user didn't pick part, ensure partPrice is 0 or ignored.

            currentItems.push({
                taskName: task,
                partName: partName, // Store full name e.g. "Nhớt (100k)"
                laborPrice: labor,
                partPrice: partP,
                totalPrice: total,
                quantity: 1
            });

            // Reset inputs partial
            partSelect.value = "";
            partPrice.value = 0;
            // Keep task select or reset? 
            // usually repair involves multiple diff tasks. Resetting is better.
            taskSelect.value = "";
            laborPrice.value = 0;
            customTask.style.display = 'none';

            renderItems();
        });
    }

    // Helper: Fetch Inventory
    async function loadInventoryForRepair() {
        if(!partSelect) return;
        try {
            const response = await fetch('http://localhost:3000/api/inventory', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if(result.success) {
                // Store all items for filtering
                allInventoryItems = result.data;
                
                // Initially populate with all items
                partSelect.innerHTML = '<option value="" data-price="0">-- Không dùng vật tư --</option>';
                result.data.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.id;
                    option.setAttribute('data-price', item.unitPrice);
                    option.textContent = `${item.name} (Tồn: ${item.quantity} - ${formatCurrency(item.unitPrice)})`;
                    partSelect.appendChild(option);
                });
            }
        } catch(e) { console.error(e); }
    }

    // Helper: Load Mechanics for Dropdown
    async function loadMechanicsForRepair() {
        if(!mechanicSelect) return;
        try {
            const response = await fetch('http://localhost:3000/api/mechanics', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if(result.success) {
                mechanicSelect.innerHTML = '<option value="">-- Chọn thợ --</option>';
                result.data.forEach(mech => {
                    const option = document.createElement('option');
                    option.value = mech.id;
                    option.textContent = mech.fullName;
                    mechanicSelect.appendChild(option);
                });
            }
        } catch(e) { console.error(e); }
    }

    // Close Modal
    if (closeRepairModal) {
        closeRepairModal.addEventListener('click', () => {
            repairModal.style.display = 'none';
        });
    }

    // Click outside to close
    window.addEventListener('click', (e) => {
        if (e.target == repairModal) repairModal.style.display = 'none';
    });

    function renderItems() {
        if (!repairItemsTable) return;
        repairItemsTable.innerHTML = '';
        let total = 0;

        currentItems.forEach((item, index) => {
            total += item.totalPrice;
            repairItemsTable.innerHTML += `
                <tr>
                    <td>${item.taskName}</td>
                    <td>${item.partName}</td>
                    <td>${formatCurrency(item.totalPrice)}</td>
                    <td><i class="fa-solid fa-trash text-red pointer" onclick="window.removeRepairItem(${index})"></i></td>
                </tr>
            `;
        });

        totalAmountSpan.textContent = formatCurrency(total).replace('₫', '').trim();
    }

    // Global remove function
    window.removeRepairItem = function(index) {
        currentItems.splice(index, 1);
        renderItems();
    };

    // Save Ticket
    if (btnSaveTicket) {
        btnSaveTicket.addEventListener('click', async () => {
            const vehicleId = repairVehicleSelect.value;
            const mechanicName = mechanicSelect.value ? mechanicSelect.options[mechanicSelect.selectedIndex].text : 'Chưa phân công';

            if (!vehicleId) {
                showToast('Vui lòng chọn xe', 'error');
                return;
            }
            if (currentItems.length === 0) {
                showToast('Vui lòng thêm ít nhất 1 hạng mục', 'error');
                return;
            }
            if (!mechanicSelect.value) {
                showToast('Vui lòng chọn thợ phụ trách', 'warning');
            }

            const payload = {
                vehicleId: vehicleId,
                totalAmount: currentItems.reduce((sum, i) => sum + i.totalPrice, 0),
                mechanicName: mechanicName,
                items: currentItems
            };

            try {
                const response = await fetch('http://localhost:3000/api/repairs', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                if (result.success) {
                    showToast('Đã lưu phiếu sửa chữa!', 'success');
                    repairModal.style.display = 'none';
                    loadActiveRepairs(); // Refresh UI
                } else {
                    showToast('Lỗi: ' + result.message, 'error');
                }
            } catch (error) {
                console.error('Save ticket error:', error);
                showToast('Không thể lưu phiếu', 'error');
            }
        });
    }

    // Tab Logic
    window.switchRepairTab = function(tabName) {
        // Update tabs
        document.querySelectorAll('.repair-tab').forEach(t => t.classList.remove('active'));
        const activeTabBtn = document.querySelector(`.repair-tab[onclick="switchRepairTab('${tabName}')"]`);
        if(activeTabBtn) activeTabBtn.classList.add('active');

        // Update content
        document.querySelectorAll('.repair-tab-content').forEach(c => c.style.display = 'none');
        document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`).style.display = 'block';
    }

    // Filter Logic
    const globalSearch = document.getElementById('globalRepairSearch');
    const filterMechanic = document.getElementById('filterMechanic');

    if (globalSearch) {
        globalSearch.addEventListener('input', () => applyFilters());
    }
    
    if (filterMechanic) {
        filterMechanic.addEventListener('change', () => applyFilters());
    }

    // Populate Mechanic Filter
    function populateMechanicFilter() {
        if (!filterMechanic) return;
        
        // Fetch mechanics (using existing API)
        fetch('http://localhost:3000/api/mechanics', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(result => {
            if (result.success) {
                let html = '<option value="">Tất cả thợ</option>';
                result.data.forEach(m => {
                    html += `<option value="${m.fullName}">${m.fullName}</option>`;
                });
                filterMechanic.innerHTML = html;
            }
        })
        .catch(console.error);
    }
    
    // Call on load
    populateMechanicFilter();

    // Main Filter Function
    window.applyFilters = function() {
        const searchTerm = globalSearch ? globalSearch.value.toLowerCase() : '';
        const mechanicTerm = filterMechanic ? filterMechanic.value.toLowerCase() : '';

        // Filter all tables
        filterTableData('waitingTable', searchTerm, mechanicTerm);
        filterTableData('workingTable', searchTerm, mechanicTerm);
        filterTableData('completedTable', searchTerm, mechanicTerm);
    };

    function filterTableData(tableId, search, mechanic) {
        const table = document.getElementById(tableId);
        if (!table) return;
        
        const rows = table.querySelector('tbody').getElementsByTagName('tr');
        
        // Iterate through actual data rows, not header
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const text = row.textContent.toLowerCase();
            const mechanicCell = row.cells[3] ? row.cells[3].textContent.toLowerCase() : ''; // Index 3 is Mechanic
            
            const matchSearch = text.includes(search);
            const matchMechanic = mechanic === '' || mechanicCell.includes(mechanic);
            
            if (matchSearch && matchMechanic) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    }

    // Load Active Repairs for the Main List
    async function loadActiveRepairs() {
        // Elements
        const waitingTable = document.querySelector('#waitingTable tbody');
        const workingTable = document.querySelector('#workingTable tbody');
        const completedTable = document.querySelector('#completedTable tbody');
        
        if(!waitingTable) return;
        
        try {
            const response = await fetch('http://localhost:3000/api/repairs', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) return;
            const result = await response.json();
            
            if (result.success) {
                const repairs = result.data;
                
                // Clear tables
                waitingTable.innerHTML = '';
                workingTable.innerHTML = '';
                completedTable.innerHTML = '';

                repairs.forEach(r => {
                    if (!r.vehicle) return;
                    
                    const tasks = r.items ? r.items.map(i => i.taskName).join(', ') : 'Chưa có mục';
                    
                    // Common Columns
                    const plate = `<td>${r.vehicle.licensePlate}</td>`;
                    const brand = `<td>${r.vehicle.carBrand}</td>`;
                    const taskCol = `<td><div style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${tasks}">${tasks}</div></td>`;
                    const mech = `<td>${r.mechanicName || '---'}</td>`;

                    // Generate Row based on Status
                    if (r.status === 'draft') {
                        // Section: Waiting
                        const warning = getTimeWarning(r);
                        const warningBadge = warning ? `<br><small style="color:${warning.color};">${warning.text}</small>` : '';
                        
                        const row = `
                            <tr>
                                ${plate} ${brand} ${taskCol} ${mech}
                                <td><span class="badge badge-pending">Chờ sửa</span>${warningBadge}</td>
                                <td>
                                    <button class="btn btn-success btn-sm" onclick="startRepair(${r.id})" title="Bắt đầu sửa"><i class="fa-solid fa-play"></i> Bắt đầu</button>
                                    <button class="btn btn-primary btn-sm" onclick="editRepair(${r.id})" title="Sửa phiếu"><i class="fa-solid fa-pen"></i></button>
                                    <button class="btn btn-danger btn-sm" onclick="deleteRepair(${r.id})" title="Xóa phiếu"><i class="fa-solid fa-trash"></i></button>
                                </td>
                            </tr>
                        `;
                        waitingTable.innerHTML += row;

                    } else if (r.status === 'working') {
                        // Section: Working - Accordion Style
                        const warning = getTimeWarning(r);
                        const warningBadge = warning ? `<br><small style="color:${warning.color};">${warning.text}</small>` : '';
                        
                        // Calculate Progress
                        const totalItems = r.items ? r.items.length : 0;
                        const completedItems = r.items ? r.items.filter(i => i.isCompleted).length : 0;
                        const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
                        const progressColor = progressPercent === 100 ? '#10b981' : '#3b82f6';

                        // Generate Items List HTML
                        let itemsHtml = '';
                        if (r.items && r.items.length > 0) {
                            itemsHtml = r.items.map(item => `
                                <li class="task-item ${item.isCompleted ? 'completed' : ''}">
                                    <input type="checkbox" class="task-checkbox" 
                                        ${item.isCompleted ? 'checked' : ''} 
                                        onchange="toggleItemStatus(${r.id}, ${item.id}, this)">
                                    <div style="flex:1">
                                        <div style="font-weight: 500;">${item.taskName}</div>
                                        <div style="font-size: 0.85rem; color: #6b7280;">${item.partName !== '---' ? item.partName : 'Không dùng vật tư'}</div>
                                    </div>
                                    <span style="font-weight: 600;">${formatCurrency(item.totalPrice)}</span>
                                </li>
                            `).join('');
                        } else {
                            itemsHtml = '<p class="text-muted">Chưa có hạng mục nào.</p>';
                        }

                        const row = `
                            <tr>
                                <td><button id="btn-expand-${r.id}" class="btn-expand" onclick="toggleRepairDetails(${r.id})"><i class="fa-solid fa-chevron-right"></i></button></td>
                                <td>${r.vehicle.licensePlate}</td>
                                <td>${r.vehicle.carBrand}</td>
                                <td>${r.mechanicName || '---'}</td>
                                <td>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <div style="flex: 1; height: 6px; background: #e5e7eb; border-radius: 3px; width: 80px;">
                                            <div style="width: ${progressPercent}%; height: 100%; background: ${progressColor}; border-radius: 3px;"></div>
                                        </div>
                                        <small>${completedItems}/${totalItems}</small>
                                    </div>
                                    ${warningBadge}
                                </td>
                                <td>
                                    <button class="btn btn-success btn-sm" onclick="completeRepair(${r.id})" title="Hoàn thành"><i class="fa-solid fa-check"></i> Xong</button>
                                    <button class="btn btn-primary btn-sm" onclick="editRepair(${r.id})" title="Sửa phiếu"><i class="fa-solid fa-pen"></i></button>
                                </td>
                            </tr>
                            <tr id="details-${r.id}" class="expanded-row" style="display: none;">
                                <td colspan="6">
                                    <div class="repair-details-container">
                                        <h4 style="margin-bottom: 10px;">Danh sách công việc:</h4>
                                        <ul class="task-list">
                                            ${itemsHtml}
                                        </ul>
                                    </div>
                                </td>
                            </tr>
                        `;
                        workingTable.innerHTML += row;

                    } else if (r.status === 'completed' || r.status === 'paid') {
                        // Section: Completed
                        const warning = getTimeWarning(r);
                        const warningBadge = warning ? `<br><small style="color:${warning.color};">${warning.text}</small>` : '';
                        
                        let statusBadge = '';
                        let actionButtons = '';
                        
                        if (r.status === 'completed') {
                            statusBadge = `<span class="badge badge-warning">Đã sửa xong</span>${warningBadge}`;
                            actionButtons = `<button class="btn btn-success btn-sm" onclick="markAsPaid(${r.id})" title="Thanh toán"><i class="fa-solid fa-money-bill"></i> Thanh toán</button>`;
                        } else if (r.status === 'paid') {
                            statusBadge = '<span class="badge badge-done">Đã thanh toán</span>';
                            actionButtons = `<button class="btn btn-info btn-sm" onclick="viewRepairDetails(${r.id})" title="Xem chi tiết"><i class="fa-solid fa-eye"></i> Xem</button>`;
                        }

                        const row = `
                            <tr>
                                ${plate} ${brand} ${taskCol} ${mech}
                                <td>${formatCurrency(r.totalAmount)}</td>
                                <td>${statusBadge}</td>
                                <td>${actionButtons}</td>
                            </tr>
                        `;
                        completedTable.innerHTML += row;
                    }
                });

                // Re-apply filters after refresh
                applyFilters();
            }
        } catch (error) {
            console.error('Load active repairs error:', error);
        }
    }

    // Toggle Details Row
    window.toggleRepairDetails = function(id) {
        const row = document.getElementById(`details-${id}`);
        const btn = document.getElementById(`btn-expand-${id}`);
        
        if (row.style.display === 'none') {
            row.style.display = 'table-row';
            btn.classList.add('open');
        } else {
            row.style.display = 'none';
            btn.classList.remove('open');
        }
    };

    // Toggle Item Status API
    window.toggleItemStatus = async function(ticketId, itemId, checkbox) {
        const isChecked = checkbox.checked; // Goal status
        // const row = checkbox.closest('.task-item'); // UI Update target

        try {
            // Optimistic UI Update
            // if(isChecked) row.classList.add('completed');
            // else row.classList.remove('completed');

            // Call API
            const response = await fetch(`http://localhost:3000/api/repairs/${ticketId}/items/${itemId}/toggle`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isCompleted: isChecked })
            });

            const result = await response.json();
            if(!result.success) {
                // Revert if failed
                checkbox.checked = !isChecked;
                showToast('Lỗi cập nhật: ' + result.message, 'error');
            } else {
                // Check if all done to maybe prompt user? Or just let them click 'Complete'
                // Update progress bar or badges if we had them
                loadActiveRepairs(); // Refresh to update main status if needed
            }

        } catch(e) {
            console.error(e);
            checkbox.checked = !isChecked;
            showToast('Lỗi kết nối', 'error');
        }
    };

    // Action: Start Repair (Draft -> Working)
    window.startRepair = async function(id) {
        if (!confirm('Bắt đầu sửa chữa xe này?')) return;
        updateRepairStatus(id, 'working');
    };

    // Action: Complete Repair (Working -> Completed) with validation
    window.completeRepair = async function(id) {
        try {
            // Step 1: Skip check - Auto complete on backend
            // (Previous check removed to simplify UX)
            
            // Step 2: Confirm with user
            if (!confirm('Xác nhận đã sửa xong? Xe sẽ được chuyển sang chờ thanh toán.')) return;
            
            // Step 3: Update status
            updateRepairStatus(id, 'completed');
        } catch (e) {
            console.error('Complete repair validation error:', e);
            showToast('Lỗi khi kiểm tra trạng thái', 'error');
        }
    };

    // Action: Delete Repair with status check
    window.deleteRepair = async function(id) {
        try {
            // Fetch ticket to check status
            const response = await fetch(`http://localhost:3000/api/repairs/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            
            if (result.success && result.data) {
                const status = result.data.status;
                
                // Block deletion if completed or paid
                if (status === 'completed' || status === 'paid') {
                    showToast('❌ Không thể xóa phiếu đã hoàn thành hoặc đã thanh toán!', 'error');
                    return;
                }
            }
            
            // Confirm deletion
            if (!confirm('Bạn có chắc muốn xóa phiếu này không?')) return;
            
            // Perform deletion
            const deleteResponse = await fetch(`http://localhost:3000/api/repairs/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const deleteResult = await deleteResponse.json();
            
            if(deleteResult.success) {
                showToast('Đã xóa phiếu sửa chữa', 'success');
                loadActiveRepairs();
            } else {
                showToast('Lỗi: ' + deleteResult.message, 'error');
            }
        } catch(e) {
            console.error('Delete repair error:', e);
            showToast('Lỗi kết nối', 'error');
        }
    };
    
    // Placeholder for Edit
    window.editRepair = function(id) {
        showToast('Chức năng sửa phiếu đang được phát triển', 'info');
    };

    // New: Mark repair as paid
    window.markAsPaid = async function(id) {
        if (!confirm('Xác nhận đã nhận thanh toán?')) return;
        updateRepairStatus(id, 'paid');
    };

    // New: View repair details
    window.viewRepairDetails = async function(id) {
        try {
            const response = await fetch(`http://localhost:3000/api/repairs/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            
            if (result.success) {
                const repair = result.data;
                let details = `Biển số: ${repair.vehicle.licensePlate}\n`;
                details += `Khách hàng: ${repair.vehicle.customerName}\n`;
                details += `Thợ: ${repair.mechanicName}\n`;
                details += `Tổng tiền: ${formatCurrency(repair.totalAmount)}\n\n`;
                details += `Hạng mục:\n`;
                repair.items.forEach(item => {
                    details += `- ${item.taskName}: ${formatCurrency(item.totalPrice)}\n`;
                });
                
                alert(details);
            }
        } catch (e) {
            showToast('Lỗi khi tải thông tin', 'error');
        }
    };

    // Helper: Update Status API
    async function updateRepairStatus(id, newStatus) {
        try {
            const response = await fetch(`http://localhost:3000/api/repairs/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            
            const result = await response.json();
            if(result.success) {
                showToast('Đã cập nhật trạng thái!', 'success');
                loadActiveRepairs();
            } else {
                showToast(result.message, 'error');
            }
        } catch (e) {
            showToast('Lỗi kết nối', 'error');
        }
    };

    // Initial Load
    loadActiveRepairs();

    // Initial Load
    loadActiveRepairs();

    // Refresh every 30s
    setInterval(loadActiveRepairs, 30000);

});
