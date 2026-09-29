document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const byId = id => document.getElementById(id);
    const existingSelect = byId('existingInventory');
    const importForm = byId('importForm');
    let inventoryItems = [], brands = [], wages = [];
    existingSelect.onchange = () => {
        const item = inventoryItems.find(i => i.id === Number(existingSelect.value));
        byId('invName').value = item?.name || '';
        byId('invName').readOnly = Boolean(item);
        byId('invPrice').value = item?.unitPrice || 0;
    };
    function render() {
        byId('inventorySku').textContent = inventoryItems.length;
        byId('inventoryUnits').textContent = inventoryItems.reduce((sum,i) => sum + i.quantity,0);
        byId('inventoryValue').textContent = formatCurrency(inventoryItems.reduce((sum,i) => sum + i.quantity * i.unitPrice,0));
        byId('inventoryLow').textContent = inventoryItems.filter(i => i.quantity <= 5).length;
        const search = byId('inventorySearch').value.toLowerCase();
        const filter = byId('inventoryFilter').value;
        const items = inventoryItems.filter(i => (i.name + ' ' + i.id).toLowerCase().includes(search) && (!filter || (filter === 'empty' ? i.quantity === 0 : i.quantity > 0 && i.quantity <= 5)));
        byId('inventoryTable').querySelector('tbody').innerHTML = items.map(i => `<tr><td>#${i.id}</td><td><strong>${Garage.escape(i.name)}</strong></td>
            <td><span class="badge ${i.quantity > 5 ? 'badge-done' : 'badge-warning'}">${i.quantity}${i.quantity === 0 ? ' · Hết hàng' : i.quantity <= 5 ? ' · Sắp hết' : ''}</span></td>
            <td>${formatCurrency(i.unitPrice)}</td><td>${formatDate(i.updatedAt || i.createdAt)}</td>
            <td><button class="btn btn-sm" data-stock="${i.id}" data-action="receive">Nhập</button><button class="btn btn-sm" data-stock="${i.id}" data-action="edit">Sửa</button><button class="btn btn-sm" data-stock="${i.id}" data-action="history">Lịch sử</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty-state">Không tìm thấy vật tư phù hợp.</td></tr>';
    }
    async function loadInventoryList(context = {}) {
        const canRender = Garage.refreshGuard(context);
        try {
            const data = await Garage.request('/inventory');
            if (!canRender()) return;
            inventoryItems = data;
            const value = existingSelect.value;
            existingSelect.replaceChildren(new Option('Tạo vật tư mới',''), ...inventoryItems.map(i => new Option(i.name + ' (Tồn: ' + i.quantity + ')',i.id)));
            existingSelect.value = value;
            render();
        } catch(error) { showToast(error.message,'error'); }
    }
    byId('inventorySearch').oninput = render;
    byId('inventoryFilter').onchange = render;
    byId('inventoryTable').onclick = async event => {
        const button = event.target.closest('[data-stock]');
        if (!button) return;
        const item = inventoryItems.find(i => i.id === Number(button.dataset.stock));
        if (button.dataset.action === 'history') return showStockHistory(item.id);
        if (button.dataset.action === 'receive') { existingSelect.value = item.id; existingSelect.onchange(); byId('invQuantity').focus(); return; }
        let dialog = byId('editStockDialog');
        if (!dialog) { dialog = document.createElement('dialog'); dialog.id='editStockDialog'; document.body.append(dialog); }
        dialog.innerHTML = '<h3>Thông tin vật tư #' + item.id + '</h3><form id="stockEditForm"><div class="form-group"><label>Tên vật tư<input name="name" required></label></div><div class="form-group"><label>Đơn giá hiện tại (đ)<input name="unitPrice" type="number" min="0" required></label></div><p class="field-help">Giữ nguyên tồn kho. Dùng Nhập kho để bổ sung số lượng.</p><div class="form-actions"><button class="btn btn-primary">Lưu thay đổi</button></div></form><form method="dialog"><button class="btn btn-secondary">Đóng</button></form>';
        const form = dialog.querySelector('#stockEditForm');
        form.elements.name.value = item.name; form.elements.unitPrice.value = item.unitPrice;
        form.onsubmit = async event => {
            event.preventDefault();
            try { await Garage.request('/inventory/' + item.id,{method:'PUT',body:{name:form.elements.name.value,unitPrice:Number(form.elements.unitPrice.value)}}); dialog.close(); showToast('Đã lưu vật tư.','success'); await loadInventoryList(); }
            catch(error) { showToast(error.message,'error'); }
        };
        dialog.showModal();
    };
    importForm.onsubmit = async event => {
        event.preventDefault();
        const button = importForm.querySelector('[type="submit"]');
        button.disabled = true;
        try {
            await Garage.request(existingSelect.value ? '/inventory/' + existingSelect.value + '/receive' : '/inventory', {
                method:'POST',body:{name:byId('invName').value,quantity:Number(byId('invQuantity').value),unitPrice:Number(byId('invPrice').value)},
            });
            importForm.reset(); byId('invName').readOnly=false;
            showToast('Đã ghi nhận nhập kho.','success'); await loadInventoryList();
        } catch(error) { showToast(error.message,'error'); }
        finally { button.disabled=false; }
    };
    Garage.subscribe(loadInventoryList); Garage.subscribe(loadSettings);
    loadInventoryList(); loadSettings();
    // --- Settings Logic ---
    async function loadSettings(context = {}) {
        const canRender = Garage.refreshGuard(context);
        // Load Brands
        try {
            const res = await Garage.apiFetch(`${Garage.base}/settings/brands`, { headers: { 'Authorization': `Bearer ${token}` } });
            const result = await res.json();
            if (!canRender()) return;
            if (result.success) {
                const list = document.querySelector('#inv-settings .card:nth-child(1) .list-group');
                if (list) {
                    list.innerHTML = '';
                    brands = result.data;
                    result.data.forEach(brand => {
                        list.innerHTML += `<li><span>${escapeHtml(brand.name)}</span><span><button class="btn-sm btn-edit-catalog" data-kind="brands" data-id="${brand.id}">Sửa</button> <button class="btn-sm text-red btn-delete-brand" data-id="${brand.id}">Xóa</button></span></li>`;
                    });
                }
            }
        } catch (e) { console.error(e); }

        // Load Wages
        try {
            const res = await Garage.apiFetch(`${Garage.base}/settings/wages`, { headers: { 'Authorization': `Bearer ${token}` } });
            const result = await res.json();
            if (!canRender()) return;
            if (result.success) {
                const list = document.querySelector('#inv-settings .card:nth-child(2) .list-group');
                if (list) {
                    list.innerHTML = '';
                    wages = result.data;
                    result.data.forEach(wage => {
                        const priceStr = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(wage.price);
                        list.innerHTML += `<li><span>${escapeHtml(wage.name)} · ${priceStr}</span><span><button class="btn-sm btn-edit-catalog" data-kind="wages" data-id="${wage.id}">Sửa</button> <button class="btn-sm text-red btn-delete-wage" data-id="${wage.id}">Xóa</button></span></li>`;
                    });
                }
            }
        } catch (e) { console.error(e); }

        // Load Params
        try {
            const res = await Garage.apiFetch(`${Garage.base}/settings/params`, { headers: { 'Authorization': `Bearer ${token}` } });
            const result = await res.json();
            if (!canRender()) return;
            if (result.success) {
                if (result.data.max_cars_per_day) {
                    const input = document.querySelector('#inv-settings .card.full-width input[type="number"]');
                    if (input && document.activeElement !== input) input.value = result.data.max_cars_per_day;
                }
            }
        } catch (e) { console.error(e); }

        attachSettingsEvents();
    }

    function attachSettingsEvents() {
        document.querySelectorAll('.btn-edit-catalog').forEach(button => {
            button.onclick = () => {
                const kind = button.dataset.kind;
                const item = (kind === 'brands' ? brands : wages).find(i => i.id === Number(button.dataset.id));
                let dialog = document.getElementById('catalogDialog');
                if (!dialog) { dialog = document.createElement('dialog'); dialog.id='catalogDialog'; document.body.append(dialog); }
                dialog.innerHTML='<h3>' + (kind === 'brands' ? 'Sửa hiệu xe' : 'Sửa tiền công') + '</h3><form id="catalogEdit"><div class="form-group"><label>Tên<input name="name" required></label></div>' + (kind === 'wages' ? '<div class="form-group"><label>Tiền công (đ)<input name="price" type="number" min="0" required></label></div><p class="field-help">Giá mới chỉ áp dụng khi tạo hạng mục mới.</p>' : '<p class="field-help">Tên hiệu xe được cập nhật cho các xe đang dùng trong danh sách.</p>') + '<div class="form-actions"><button class="btn btn-primary">Lưu thay đổi</button></div></form><form method="dialog"><button class="btn btn-secondary">Đóng</button></form>';
                const form=dialog.querySelector('#catalogEdit');form.elements.name.value=item.name;
                if (kind==='wages') form.elements.price.value=item.price;
                form.onsubmit=async event=>{
                    event.preventDefault();
                    const body={name:form.elements.name.value};if(kind==='wages')body.price=Number(form.elements.price.value);
                    try { await Garage.request('/settings/'+kind+'/'+item.id,{method:'PUT',body});dialog.close();await loadSettings();showToast('Đã lưu danh mục.','success'); }
                    catch(error){showToast(error.message,'error');}
                };
                dialog.showModal();
            };
        });
        document.querySelectorAll('.btn-delete-brand').forEach(btn => {
            btn.onclick = async function() {
                if(!confirm('Xóa hiệu xe này?')) return;
                const id = this.getAttribute('data-id');
                await Garage.apiFetch(`${Garage.base}/settings/brands/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                loadSettings();
            };
        });

        document.querySelectorAll('.btn-delete-wage').forEach(btn => {
            btn.onclick = async function() {
                if(!confirm('Xóa tiền công này?')) return;
                const id = this.getAttribute('data-id');
                await Garage.apiFetch(`${Garage.base}/settings/wages/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
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
            const res = await Garage.apiFetch(`${Garage.base}/settings/brands`, {
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
            const res = await Garage.apiFetch(`${Garage.base}/settings/wages`, {
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
            const res = await Garage.apiFetch(`${Garage.base}/settings/params`, {
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

async function showStockHistory(id) {
    try {
        const rows = await Garage.request('/inventory/' + id + '/movements');
        let dialog = document.getElementById('stockHistoryDialog');
        if (!dialog) { dialog = document.createElement('dialog'); dialog.id = 'stockHistoryDialog'; document.body.append(dialog); }
        dialog.innerHTML = '<h3>Lịch sử nhập / xuất kho</h3>' + (rows.length ? '<table class="data-table"><thead><tr><th>Ngày</th><th>Thay đổi</th><th>Tồn sau</th><th>Lý do</th></tr></thead><tbody>' + rows.map(r => '<tr><td>' + Garage.date(r.createdAt).toLocaleString('vi-VN') + '</td><td>' + r.quantityChange + '</td><td>' + r.balanceAfter + '</td><td>' + Garage.escape(({opening:'Tồn đầu',receipt:'Nhập kho',repair:'Phiếu sửa',adjustment:'Điều chỉnh'})[r.reason] || r.reason) + ' ' + Garage.escape(r.reference || '') + '</td></tr>').join('') + '</tbody></table>' : '<p>Chưa có phát sinh kể từ khi nâng cấp.</p>') + '<form method="dialog"><button class="btn btn-secondary">Đóng</button></form>';
        dialog.showModal();
    } catch (error) { showToast(error.message,'error'); }
}
