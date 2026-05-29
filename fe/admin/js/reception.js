// Module: Reception (Tiếp nhận xe) - Reorganized with Modal and Enhanced Actions

document.addEventListener('DOMContentLoaded', () => {
    const receptionForm = document.getElementById('receptionForm');
    const receptionTable = document.querySelector('#receptionTable tbody');
    const token = localStorage.getItem('token');

    // Modals
    const receptionModal = document.getElementById('receptionModal');
    const editModal = document.getElementById('editVehicleModal');
    const btnNewReception = document.getElementById('btnNewReception');
    const closeReceptionModal = document.getElementById('closeReceptionModal');
    const closeEditModal = document.getElementById('closeEditModal');
    const editForm = document.getElementById('editVehicleForm');

    // Check auth
    if (!token) {
        alert('Vui lòng đăng nhập lại');
        window.location.href = '../index.html';
        return;
    }

    let vehicles = [];

    // Open Reception Modal
    if (btnNewReception) {
        btnNewReception.addEventListener('click', () => {
            receptionModal.style.display = 'block';
        });
    }

    // Close Modals
    if (closeReceptionModal) {
        closeReceptionModal.addEventListener('click', () => {
            receptionModal.style.display = 'none';
        });
    }
    if (closeEditModal) {
        closeEditModal.addEventListener('click', () => {
            editModal.style.display = 'none';
        });
    }

    // Click outside to close
    window.addEventListener('click', (e) => {
        if (e.target == receptionModal) receptionModal.style.display = 'none';
        if (e.target == editModal) editModal.style.display = 'none';
    });

    // Fetch vehicles from API
    const fetchVehicles = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/vehicles', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401) {
                alert('Phiên đăng nhập hết hạn');
                localStorage.clear();
                window.location.href = '../index.html';
                return;
            }

            const result = await response.json();
            if (result.success) {
                vehicles = result.data;
                renderTable();
            }
        } catch (error) {
            console.error('Fetch vehicles error:', error);
            alert('Không thể tải danh sách xe. Kiểm tra backend đã chạy chưa.');
        }
    };

    // Initial load
    fetchVehicles();

    // Car Data
    const carData = {
        'Toyota': ['Vios', 'Camry', 'Corolla Altis', 'Fortuner', 'Innova', 'Raize', 'Veloz'],
        'Honda': ['City', 'Civic', 'CR-V', 'HR-V', 'Accord'],
        'Mazda': ['Mazda 2', 'Mazda 3', 'Mazda 6', 'CX-5', 'CX-8'],
        'Ford': ['Ranger', 'Everest', 'Explorer', 'Territory'],
        'Kia': ['Morning', 'K3', 'K5', 'Sonet', 'Seltos', 'Carnival'],
        'Hyundai': ['i10', 'Accent', 'Elantra', 'Tucson', 'SantaFe', 'Creta'],
        'Mercedes': ['C-Class', 'E-Class', 'S-Class', 'GLC', 'GLE'],
        'BMW': ['3 Series', '5 Series', '7 Series', 'X3', 'X5']
    };

    // Handle Brand Selection
    const brandSelect = document.getElementById('brandSelect');
    const modelSelect = document.getElementById('modelSelect');

    if (brandSelect && modelSelect) {
        brandSelect.addEventListener('change', function() {
            const brand = this.value;
            modelSelect.innerHTML = '<option value="">-- Chọn dòng xe --</option>';
            
            if (brand && carData[brand]) {
                modelSelect.disabled = false;
                carData[brand].forEach(model => {
                    const option = document.createElement('option');
                    option.value = model;
                    option.textContent = model;
                    modelSelect.appendChild(option);
                });
            } else {
                modelSelect.disabled = true;
            }
        });
    }

    // Handle Form Submit - Create vehicle via API
    if(receptionForm) {
        receptionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(receptionForm);
            const brand = formData.get('carBrand');
            const model = modelSelect.value;
            const fullBrand = model ? `${brand} ${model}` : brand;

            const vehicleData = {
                licensePlate: formData.get('licensePlate'),
                customerName: formData.get('customerName'),
                phone: formData.get('phone'),
                address: formData.get('address'),
                carBrand: fullBrand
            };

            try {
                const response = await fetch('http://localhost:3000/api/vehicles', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(vehicleData)
                });

                const result = await response.json();

                if (result.success) {
                    showToast('Đã tiếp nhận xe thành công!', 'success');
                    receptionForm.reset();
                    if(modelSelect) {
                        modelSelect.innerHTML = '<option value="">-- Chọn dòng xe --</option>';
                        modelSelect.disabled = true;
                    }
                    receptionModal.style.display = 'none';
                    fetchVehicles(); // Reload list
                } else {
                    showToast(result.message || 'Lỗi khi tiếp nhận xe', 'error');
                }
            } catch (error) {
                console.error('Create vehicle error:', error);
                showToast('Không thể kết nối đến server', 'error');
            }
        });
    }

    // Render Table Function
    // Render Table Function
    function renderTable() {
        if(!receptionTable) return;
        receptionTable.innerHTML = '';

        vehicles.forEach(v => {
            let statusBadge = '';
            
            // Check if vehicle has repair tickets
            const hasRepairTickets = v.repairTickets && v.repairTickets.length > 0;
            
            if (!hasRepairTickets) {
                // No repair tickets yet - just received
                statusBadge = '<span class="badge badge-pending">Mới tiếp nhận</span>';
            } else {
                // Has repair tickets - check the latest one's status
                const latestTicket = v.repairTickets[v.repairTickets.length - 1];
                
                switch(latestTicket.status) {
                    case 'draft':
                        statusBadge = '<span class="badge badge-pending">Chờ sửa</span>';
                        break;
                    case 'working':
                        statusBadge = '<span class="badge badge-working">Đang sửa</span>';
                        break;
                    case 'completed':
                        statusBadge = '<span class="badge badge-warning">Chờ thanh toán</span>';
                        break;
                    case 'paid':
                        statusBadge = '<span class="badge badge-done">Đã thanh toán</span>';
                        break;
                    default:
                        statusBadge = '<span class="badge badge-pending">Chờ xử lý</span>';
                }
            }

            const date = new Date(v.receivedDate).toLocaleDateString('vi-VN');

            // Main Row
            const row = `
                <tr data-id="${v.id}" class="vehicle-row">
                    <td class="font-weight-bold">${v.licensePlate}</td>
                    <td>
                        <div class="customer-info">
                            <span class="font-weight-medium">${v.customerName}</span>
                            <small class="text-muted d-block">${v.phone}</small>
                        </div>
                    </td>
                    <td>${v.carBrand}</td>
                    <td>${date}</td>
                    <td>${statusBadge}</td>
                    <td class="action-buttons">
                        <button class="btn-add-repair btn btn-light text-success btn-sm btn-icon" data-id="${v.id}" data-plate="${v.licensePlate}" title="Tạo phiếu sửa">
                            <i class="fa-solid fa-screwdriver-wrench"></i>
                        </button>
                        <button class="btn-edit btn btn-light text-primary btn-sm btn-icon" data-id="${v.id}" title="Sửa thông tin">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn-delete btn btn-light text-danger btn-sm btn-icon" data-id="${v.id}" title="Xóa xe">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                    <td class="text-center">
                        <button class="btn-expand-row" onclick="toggleExpandRow(${v.id})" title="Xem lịch sử">
                            <i class="fa-solid fa-chevron-right" id="icon-${v.id}"></i>
                        </button>
                    </td>
                </tr>
                <!-- Expandable Detail Row -->
                <tr id="detail-${v.id}" class="detail-row" style="display: none;">
                    <td colspan="7" class="p-0">
                        <div class="detail-container">
                            <div class="detail-header">
                                <i class="fa-solid fa-clock-rotate-left"></i> Lịch sử sửa chữa & Bảo dưỡng
                            </div>
                            ${renderRepairHistory(v.repairTickets)}
                        </div>
                    </td>
                </tr>
            `;
            receptionTable.innerHTML += row;
        });

        // Attach event listeners
        attachEditListeners();
        attachAddRepairListeners();
        attachDeleteListeners();
        updateRepairSelect();
    }

    // Helper: Render Repair History HTML
    function renderRepairHistory(tickets) {
        if (!tickets || tickets.length === 0) {
            return '<p style="color: #666; font-style: italic;">Chưa có lịch sử sửa chữa.</p>';
        }

        let html = `
            <table class="table table-sm" style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <thead style="background: #f9fafb; color: #6b7280; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">
                    <tr>
                        <th style="width: 25%; text-align: left; padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">Hạng mục sửa chữa</th>
                        <th style="width: 20%; text-align: left; padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">Thợ phụ trách</th>
                        <th style="width: 20%; text-align: left; padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">Thời gian</th>
                        <th style="width: 20%; text-align: center; padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">Trạng thái</th>
                        <th style="width: 15%; text-align: right; padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">Tổng tiền</th>
                    </tr>
                </thead>
                <tbody style="font-size: 0.9rem; color: #1f2937;">
        `;

        tickets.forEach(t => {
            const updatedAt = new Date(t.updatedAt).toLocaleString('vi-VN', { 
                hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' 
            });
            
            let statusText = '';
            let statusClass = '';
            
            switch(t.status) {
                case 'draft': statusText = 'Chờ sửa'; statusClass = 'badge-pending'; break;
                case 'working': statusText = 'Đang sửa'; statusClass = 'badge-working'; break;
                case 'completed': statusText = 'Đã xong'; statusClass = 'badge-done'; break;
                case 'paid': statusText = 'Đã thanh toán'; statusClass = 'badge-done'; break;
                default: statusText = t.status;
            }
            
            html += `
                <tr style="border-bottom: 1px solid #f3f4f6;">
                    <td style="text-align: left; padding: 12px 16px; font-weight: 500;">Phiếu #${t.id}</td>
                    <td style="text-align: left; padding: 12px 16px;">${t.mechanicName || 'Chưa phân công'}</td>
                    <td style="text-align: left; padding: 12px 16px; color: #6b7280;">${updatedAt}</td>
                    <td style="text-align: center; padding: 12px 16px;"><span class="badge ${statusClass}" style="display:inline-block; min-width:80px;">${statusText}</span></td>
                    <td style="text-align: right; padding: 12px 16px; font-weight: 500;">${(t.totalAmount || 0).toLocaleString()} đ</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        return html;
    }

    // Toggle Expand Row
    window.toggleExpandRow = function(id) {
        const detailRow = document.getElementById(`detail-${id}`);
        const icon = document.getElementById(`icon-${id}`);
        const btn = icon.parentElement;
        
        if (detailRow.style.display === 'none') {
            detailRow.style.display = 'table-row';
            icon.classList.remove('fa-chevron-right');
            icon.classList.add('fa-chevron-down');
            btn.classList.add('active');
        } else {
            detailRow.style.display = 'none';
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-right');
            btn.classList.remove('active');
        }
    };

    // Handle Edit Brand Selection
    const editBrandSelect = document.getElementById('editBrandSelect');
    const editModelSelect = document.getElementById('editModelSelect');

    if (editBrandSelect && editModelSelect) {
        editBrandSelect.addEventListener('change', function() {
            updateModelSelect(this.value, editModelSelect);
        });
    }

    // Helper: Update Model Select options
    function updateModelSelect(brand, selectElement, selectedModel = null) {
        selectElement.innerHTML = '<option value="">-- Chọn dòng xe --</option>';
        
        if (brand && carData[brand]) {
            selectElement.disabled = false;
            carData[brand].forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                if (model === selectedModel) option.selected = true;
                selectElement.appendChild(option);
            });
        } else {
            selectElement.disabled = true;
        }
    }

    // Edit functionality - Opens modal
    function attachEditListeners() {
        // ... (Keep existing implementation)
        const editBtns = document.querySelectorAll('.btn-edit');
        editBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const vehicleId = e.currentTarget.getAttribute('data-id');
                const vehicle = vehicles.find(v => v.id == vehicleId);
                
                if (!vehicle) return;

                // Populate basic fields
                document.getElementById('editVehicleId').value = vehicle.id;
                document.getElementById('editCustomerName').value = vehicle.customerName;
                document.getElementById('editPhone').value = vehicle.phone;
                document.getElementById('editAddress').value = vehicle.address || '';
                document.getElementById('editLicensePlate').value = vehicle.licensePlate;

                // Parse Brand & Model
                let brand = '';
                let model = '';
                
                const brands = Object.keys(carData);
                for (const b of brands) {
                    if (vehicle.carBrand.startsWith(b)) {
                        brand = b;
                        const remainder = vehicle.carBrand.replace(b, '').trim();
                        if (remainder) model = remainder;
                        break;
                    }
                }

                if (brand) {
                    document.getElementById('editBrandSelect').value = brand;
                    updateModelSelect(brand, document.getElementById('editModelSelect'), model);
                } else {
                    document.getElementById('editBrandSelect').value = '';
                    updateModelSelect('', document.getElementById('editModelSelect'));
                }

                editModal.style.display = 'block';
            });
        });
    }

    // Handle Edit Form Submit
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const vehicleId = document.getElementById('editVehicleId').value;
            const brand = document.getElementById('editBrandSelect').value;
            const model = document.getElementById('editModelSelect').value;
            const fullBrand = model ? `${brand} ${model}` : brand;

            const data = {
                customerName: document.getElementById('editCustomerName').value,
                phone: document.getElementById('editPhone').value,
                address: document.getElementById('editAddress').value,
                licensePlate: document.getElementById('editLicensePlate').value,
                carBrand: fullBrand
            };

            try {
                const response = await fetch(`http://localhost:3000/api/vehicles/${vehicleId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();
                if (result.success) {
                    showToast('Cập nhật thành công!', 'success');
                    editModal.style.display = 'none';
                    fetchVehicles();
                } else {
                    showToast('Lỗi: ' + result.message, 'error');
                }
            } catch (error) {
                console.error('Update error:', error);
                showToast('Không thể cập nhật', 'error');
            }
        });
    }

    // Add Repair functionality - Navigate to Repair section
    function attachAddRepairListeners() {
        const addRepairBtns = document.querySelectorAll('.btn-add-repair');
        addRepairBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const vehicleId = e.currentTarget.getAttribute('data-id');

                // Switch to repair section
                const repairSection = document.getElementById('repair-section');
                const repairNavItem = document.querySelector('.nav-item[data-target="repair-section"]');
                
                if (repairSection && repairNavItem) {
                    // Hide all sections
                    document.querySelectorAll('section').forEach(s => s.classList.remove('active-section'));
                    
                    // Show repair section
                    repairSection.classList.add('active-section');
                    
                    // Update nav
                    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                    repairNavItem.classList.add('active');
                    
                    // Update title
                    const pageTitle = document.getElementById('pageTitle');
                    if (pageTitle) pageTitle.textContent = 'Sửa chữa & Dịch vụ';

                    // Trigger Modal Open via Global Function (Defined in repair.js)
                    if (window.openRepairModalWithVehicle) {
                        window.openRepairModalWithVehicle(vehicleId);
                    } else {
                        console.error('Function openRepairModalWithVehicle not found');
                        // Fallback logic handled in repair.js listener if element exists
                    }
                }
            });
        });
    }

    // Helper to update select box in Repair section
    function updateRepairSelect() {
        const select = document.getElementById('repairVehicleSelect');
        if(!select) return;
        
        // Save current selection to prevent reset on auto-refresh
        const currentSelection = select.value;

        // Clear old options except first
        select.innerHTML = '<option value="">-- Chọn xe --</option>';
        
        vehicles.forEach(v => {
            const option = document.createElement('option');
            option.value = v.id;
            option.setAttribute('data-plate', v.licensePlate);
            option.textContent = `${v.licensePlate} - ${v.customerName} (${v.carBrand})`;
            select.appendChild(option);
        });

        // Restore selection if it still exists in the new list
        if (currentSelection) {
            select.value = currentSelection;
        }
    }

    // Delete functionality
    function attachDeleteListeners() {
        const deleteBtns = document.querySelectorAll('.btn-delete');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const vehicleId = e.currentTarget.getAttribute('data-id');
                const vehicle = vehicles.find(v => v.id == vehicleId);
                
                if (!vehicle) return;
                
                if (!confirm(`Bạn có chắc muốn xóa xe ${vehicle.licensePlate}? Hành động này không thể hoàn tác.`)) {
                    return;
                }

                try {
                    const response = await fetch(`http://localhost:3000/api/vehicles/${vehicleId}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    const result = await response.json();
                    if (result.success) {
                        showToast('Đã xóa xe thành công!', 'success');
                        fetchVehicles();
                    } else {
                        showToast('Lỗi: ' + result.message, 'error');
                    }
                } catch (error) {
                    console.error('Delete error:', error);
                    showToast('Không thể xóa xe', 'error');
                }
            });
        });
    }

    // Search Logic
    const searchInput = document.getElementById('vehicleSearch');
    if(searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            const term = e.target.value.toLowerCase();
            const rows = receptionTable.querySelectorAll('tr:not(.detail-row)'); // Exclude detail rows from search logic?

            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                // Find associated detail row
                const id = row.getAttribute('data-id');
                const detailRow = document.getElementById(`detail-${id}`);

                if (text.includes(term)) {
                    row.style.display = '';
                    // Keep detail row hidden unless it was already open? 
                    // Or keep it linked to main row. For simplicity, just hide toggle row if main row hidden
                } else {
                    row.style.display = 'none';
                    if(detailRow) detailRow.style.display = 'none';
                }
            });
        });
    }

    // Auto-refresh removed as per user request
});
