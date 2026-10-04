/* Vehicle registration and ownership: account links are always explicit IDs. */
document.addEventListener('DOMContentLoaded', async () => {
    if (!await Garage.whenAllowed("reception")) return;
    const byId = id => document.getElementById(id);
    const esc = Garage.escape;
    let vehicles = [], customers = [], brands = [];
    async function load(context = {}) {
        const canRender = Garage.refreshGuard(context);
        try {
            const data = await Garage.request('/vehicles');
            if (!canRender()) return;
            vehicles = data;
            render();
        } catch (error) { showToast(error.message,'error'); }
    }
    function render() {
        const search = byId('vehicleSearch').value.toLowerCase();
        const labels = {waiting:'Chờ sửa',repairing:'Đang sửa',completed:'Chờ giao xe',delivered:'Đã giao xe'};
        byId('receptionTable').querySelector('tbody').innerHTML = vehicles.filter(v =>
            [v.licensePlate,v.customerName,v.phone,v.carBrand].join(' ').toLowerCase().includes(search)).map(v => {
            const unpaid = v.repairTickets.some(t => t.status !== 'paid');
            return `<tr><td>${esc(v.licensePlate)}</td><td>${esc(v.customerName)}<br><small>${esc(v.phone)} · ${v.customerId ? 'Đã liên kết tài khoản' : 'Khách vãng lai / chưa liên kết'}</small></td>
                <td>${esc(v.carBrand)} ${esc(v.carModel || '')}</td><td>${Garage.date(v.receivedDate)?.toLocaleDateString('vi-VN') || '—'}</td>
                <td><span class="badge badge-${v.status === 'repairing' ? 'working' : 'pending'}">${v.status === 'completed' && unpaid ? 'Chờ thanh toán' : labels[v.status]}</span></td>
                <td><div class="vehicle-actions">
                ${v.status !== 'delivered' && v.status !== 'completed' && !unpaid ? `<button class="btn btn-sm btn-primary" data-action="repair" data-id="${v.id}">＋ Tạo phiếu</button>` : ''}
                ${v.status === 'completed' && !unpaid ? `<button class="btn btn-sm btn-success" data-action="deliver" data-id="${v.id}">Giao xe</button>` : ''}
                ${v.status === 'delivered' ? `<button class="btn btn-sm btn-success" data-action="receive" data-id="${v.id}">Tiếp nhận lại</button>` : ''}
                <button class="btn btn-sm btn-secondary" data-action="edit" data-id="${v.id}">Sửa thông tin</button>
                ${!v.repairTickets.length ? `<button class="btn btn-sm btn-quiet-danger" data-action="delete" data-id="${v.id}" aria-label="Xóa xe ${esc(v.licensePlate)}">Xóa</button>` : ''}</div></td>
                <td><button class="btn btn-sm" data-action="history" data-id="${v.id}">Lịch sử (${v.repairTickets.length})</button></td></tr>
                <tr id="vehicle-history-${v.id}" hidden><td colspan="7">${v.repairTickets.map(t => `<p>#${t.id} · ${esc(t.mechanicName)} · ${{draft:'Chờ sửa',working:'Đang sửa',completed:'Chờ thanh toán',paid:'Đã thanh toán'}[t.status]} · ${formatCurrency(t.totalAmount)}</p>`).join('') || 'Chưa có lịch sử sửa chữa.'}</td></tr>`;
        }).join('') || '<tr><td colspan="7" class="empty-state">Không có xe phù hợp</td></tr>';
    }
    async function choices(editing = null) {
        const [users, data] = await Promise.all([Garage.request('/auth/users'), Garage.request('/settings/brands')]);
        customers = users.filter(u => u.role === 'customer');
        brands = data;
        for (const id of ['customerSelect','editCustomerSelect']) {
            byId(id).replaceChildren(new Option('Khách vãng lai / chưa liên kết',''), ...customers.map(c => new Option(c.fullName + ' — ' + c.email,c.id)));
        }
        for (const id of ['brandSelect','editBrandSelect']) {
            byId(id).replaceChildren(new Option('-- Chọn hiệu xe --',''), ...brands.map(b => new Option(b.name,b.name)));
            if (editing && !brands.some(b => b.name === editing.carBrand)) byId(id).add(new Option(editing.carBrand,editing.carBrand));
        }
    }
    byId('btnNewReception').onclick = async () => {
        try { await choices(); byId('receptionForm').reset(); byId('receptionModal').style.display = 'block'; }
        catch (error) { showToast(error.message,'error'); }
    };
    for (const [button,modal] of [['closeReceptionModal','receptionModal'],['closeEditModal','editVehicleModal']]) {
        byId(button).onclick = () => { byId(modal).style.display = 'none'; };
    }
    for (const [select,input] of [['customerSelect',byId('receptionForm').elements.customerName],['editCustomerSelect',byId('editCustomerName')]]) {
        byId(select).onchange = event => {
            const customer = customers.find(c => c.id === Number(event.target.value));
            if (customer) input.value = customer.fullName;
        };
    }
    for (const [formId,editing] of [['receptionForm',false],['editVehicleForm',true]]) {
        byId(formId).onsubmit = async event => {
            event.preventDefault();
            const form = event.target;
            const button = form.querySelector('[type="submit"]');
            const get = (name,id) => editing ? byId(id).value : form.elements[name].value;
            const data = {
                licensePlate:get('licensePlate','editLicensePlate'),customerName:get('customerName','editCustomerName'),
                phone:get('phone','editPhone'),address:get('address','editAddress'),
                customerId:Number(byId(editing ? 'editCustomerSelect':'customerSelect').value) || null,
                carBrand:byId(editing ? 'editBrandSelect':'brandSelect').value,
                carModel:byId(editing ? 'editModelSelect':'modelSelect').value,
            };
            if (!data.carBrand) { showToast('Chọn hiệu xe trong danh mục.','warning'); return; }
            if (button) button.disabled = true;
            try {
                await Garage.request('/vehicles' + (editing ? '/' + byId('editVehicleId').value : ''), {method:editing?'PUT':'POST',body:data});
                byId(editing?'editVehicleModal':'receptionModal').style.display = 'none';
                showToast('Đã lưu thông tin xe.','success'); await load();
            } catch (error) { showToast(error.message,'error'); }
            finally { if (button) button.disabled = false; }
        };
    }
    byId('vehicleSearch').oninput = render;
    byId('receptionTable').onclick = async event => {
        const button = event.target.closest('[data-action]');
        if (!button) return;
        const vehicle = vehicles.find(v => v.id === Number(button.dataset.id));
        const action = button.dataset.action;
        if (action === 'history') { const row = byId('vehicle-history-' + vehicle.id); row.hidden = !row.hidden; return; }
        try {
            if (action === 'edit') {
                await choices(vehicle);
                for (const [id,key] of [['editVehicleId','id'],['editCustomerName','customerName'],['editPhone','phone'],['editAddress','address'],['editLicensePlate','licensePlate'],['editBrandSelect','carBrand'],['editModelSelect','carModel'],['editCustomerSelect','customerId']]) {
                    byId(id).value = vehicle[key] || '';
                }
                byId('editVehicleModal').style.display = 'block'; return;
            }
            if (action === 'repair') { await window.openRepairModalWithVehicle(vehicle.id); return; }
            if (!confirm({deliver:'Xác nhận đã giao xe cho khách?',receive:'Tiếp nhận xe cho lần sửa mới?',delete:'Xóa xe chưa có lịch sử sửa chữa?'}[action])) return;
            await Garage.request('/vehicles/' + vehicle.id, action === 'delete' ? {method:'DELETE'} : {method:'PUT',body:{status:action==='deliver'?'delivered':'waiting'}});
            showToast('Đã cập nhật xe.','success'); await load();
        } catch (error) { showToast(error.message,'error'); }
    };
    Garage.subscribe(load);
    load();
});

