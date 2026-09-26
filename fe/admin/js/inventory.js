// Inventory Module - Full Functionality
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Elements
    const inventoryTable = document.querySelector('#inventoryTable tbody');
    const importForm = document.getElementById('importForm');
    
    const addInventoryModal = document.getElementById('addInventoryModal');
    const btnShowAddInventoryModal = document.getElementById('btnShowAddInventoryModal');
    const closeAddInventoryModal = document.getElementById('closeAddInventoryModal');

    // Modal Logic
    if (btnShowAddInventoryModal && addInventoryModal) {
        btnShowAddInventoryModal.addEventListener('click', () => {
            addInventoryModal.style.display = 'flex';
        });
    }

    if (closeAddInventoryModal && addInventoryModal) {
        closeAddInventoryModal.addEventListener('click', () => {
            addInventoryModal.style.display = 'none';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === addInventoryModal) {
            addInventoryModal.style.display = 'none';
        }
    });

    // Inventory Import Form
    if(importForm) {
        importForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(importForm);
            const inventoryData = {
                name: formData.get('name'),
                quantity: parseInt(formData.get('quantity')),
                unitPrice: parseFloat(formData.get('unitPrice'))
            };

            try {
                const response = await fetch('http://localhost:8000/api/inventory', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(inventoryData)
                });

                const result = await response.json();
                if (result.success) {
                    if (typeof showToast === 'function') showToast('Đã nhập kho thành công!', 'success');
                    else alert('Đã nhập kho thành công!');
                    importForm.reset();
                    if (addInventoryModal) addInventoryModal.style.display = 'none';
                    loadInventoryList();
                } else {
                    if (typeof showToast === 'function') showToast('Lỗi: ' + result.message, 'error');
                    else alert('Lỗi: ' + result.message);
                }
            } catch (error) {
                console.error('Import error:', error);
                if (typeof showToast === 'function') showToast('Không thể nhập kho', 'error');
                else alert('Không thể nhập kho');
            }
        });
    }

    // Load inventory list
    async function loadInventoryList() {
        try {
            const response = await fetch('http://localhost:8000/api/inventory', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const result = await response.json();
            if (result.success && inventoryTable) {
                inventoryTable.innerHTML = '';
                result.data.forEach(item => {
                    const price = item.unitPrice ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.unitPrice) : '0 ₫';
                    const date = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('vi-VN') : new Date(item.createdAt).toLocaleDateString('vi-VN');
                    
                    const row = `
                        <tr>
                            <td>#${item.id}</td>
                            <td style="font-weight: 500;">${item.name}</td>
                            <td><span class="badge ${item.quantity > 5 ? 'badge-completed' : 'badge-pending'}">${item.quantity}</span></td>
                            <td>${price}</td>
                            <td>${date}</td>
                            <td>
                                <button class="btn-icon btn-delete-inv" data-id="${item.id}" title="Xóa">
                                    <i class="fa-solid fa-trash-can text-red"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                    inventoryTable.innerHTML += row;
                });

                // Attach delete events
                document.querySelectorAll('.btn-delete-inv').forEach(btn => {
                    btn.addEventListener('click', deleteInventoryItem);
                });
            }
        } catch (error) {
            console.error('Load inventory error:', error);
        }
    }

    // Delete Inventory Item
    async function deleteInventoryItem(e) {
        const btn = e.currentTarget;
        const id = btn.getAttribute('data-id');
        
        if (!confirm('Bạn có chắc chắn muốn xóa vật tư này?')) return;

        try {
            const response = await fetch(`http://localhost:8000/api/inventory/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.success) {
                if (typeof showToast === 'function') showToast('Đã xóa vật tư!', 'success');
                loadInventoryList();
            } else {
                if (typeof showToast === 'function') showToast('Lỗi: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Delete error:', error);
            if (typeof showToast === 'function') showToast('Lỗi khi xóa vật tư', 'error');
        }
    }

    // Initial Load
    loadInventoryList();
    loadSettings();

    // --- Settings Logic ---
    async function loadSettings() {
        // Load Brands
        try {
            const res = await fetch('http://localhost:8000/api/settings/brands', { headers: { 'Authorization': `Bearer ${token}` } });
            const result = await res.json();
            if (result.success) {
                const list = document.querySelector('#inv-settings .card:nth-child(1) .list-group');
                if (list) {
                    list.innerHTML = '';
                    result.data.forEach(brand => {
                        list.innerHTML += `<li>${brand.name} <button class="btn-sm text-red btn-delete-brand" data-id="${brand.id}">Xóa</button></li>`;
                    });
                }
            }
        } catch (e) { console.error(e); }

        // Load Wages
        try {
            const res = await fetch('http://localhost:8000/api/settings/wages', { headers: { 'Authorization': `Bearer ${token}` } });
            const result = await res.json();
            if (result.success) {
                const list = document.querySelector('#inv-settings .card:nth-child(2) .list-group');
                if (list) {
                    list.innerHTML = '';
                    result.data.forEach(wage => {
                        const priceStr = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(wage.price);
                        list.innerHTML += `<li>${wage.name} - ${priceStr} <button class="btn-sm text-red btn-delete-wage" data-id="${wage.id}">Xóa</button></li>`;
                    });
                }
            }
        } catch (e) { console.error(e); }

        // Load Params
        try {
            const res = await fetch('http://localhost:8000/api/settings/params', { headers: { 'Authorization': `Bearer ${token}` } });
            const result = await res.json();
            if (result.success) {
                if (result.data.max_cars_per_day) {
                    const input = document.querySelector('#inv-settings .card.full-width input[type="number"]');
                    if (input) input.value = result.data.max_cars_per_day;
                }
            }
        } catch (e) { console.error(e); }

        attachSettingsEvents();
    }

    function attachSettingsEvents() {
        document.querySelectorAll('.btn-delete-brand').forEach(btn => {
            btn.onclick = async function() {
                if(!confirm('Xóa hiệu xe này?')) return;
                const id = this.getAttribute('data-id');
                await fetch(`http://localhost:8000/api/settings/brands/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                loadSettings();
            };
        });

        document.querySelectorAll('.btn-delete-wage').forEach(btn => {
            btn.onclick = async function() {
                if(!confirm('Xóa tiền công này?')) return;
                const id = this.getAttribute('data-id');
                await fetch(`http://localhost:8000/api/settings/wages/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                loadSettings();
            };
        });
    }

    // Add Brand
    const btnAddBrand = document.querySelector('#inv-settings .card:nth-child(1) .btn-primary');
    if (btnAddBrand) {
        btnAddBrand.onclick = async () => {
            const input = document.querySelector('#inv-settings .card:nth-child(1) input');
            const name = input.value.trim();
            if (!name) return;
            const res = await fetch('http://localhost:8000/api/settings/brands', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name })
            });
            if (res.ok) {
                input.value = '';
                loadSettings();
            }
        };
    }

    // Add Wage
    const btnAddWage = document.querySelector('#inv-settings .card:nth-child(2) .btn-primary');
    if (btnAddWage) {
        btnAddWage.onclick = async () => {
            const inputs = document.querySelectorAll('#inv-settings .card:nth-child(2) input');
            const name = inputs[0].value.trim();
            const price = parseFloat(inputs[1].value);
            if (!name || isNaN(price)) return;
            const res = await fetch('http://localhost:8000/api/settings/wages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name, price })
            });
            if (res.ok) {
                inputs[0].value = '';
                inputs[1].value = '';
                loadSettings();
            }
        };
    }

    // Save Params
    const btnSaveParams = document.querySelector('#inv-settings .card.full-width .btn-primary');
    if (btnSaveParams) {
        btnSaveParams.onclick = async () => {
            const val = document.querySelector('#inv-settings .card.full-width input[type="number"]').value;
            const res = await fetch('http://localhost:8000/api/settings/params', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ key: 'max_cars_per_day', value: val.toString() })
            });
            if (res.ok) {
                if (typeof showToast === 'function') showToast('Đã lưu tham số', 'success');
                else alert('Đã lưu tham số');
            }
        };
    }
});
