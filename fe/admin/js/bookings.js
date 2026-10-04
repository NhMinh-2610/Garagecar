document.addEventListener('DOMContentLoaded', async () => {
    if (!await Garage.whenAllowed("reception")) return;
    const table = document.querySelector('#bookingsTable tbody');
    async function load(context = {}) {
        const canRender = Garage.refreshGuard(context);
        try {
            const bookings = await Garage.request('/bookings');
            if (!canRender()) return;
            table.innerHTML = bookings.map(b => `<tr><td>#${b.id}</td><td>${Garage.escape(b.customerName)}<br>${Garage.escape(b.phone)}</td>
                <td>${Garage.escape(b.preferredDate)}</td><td>${Garage.escape(({maintenance:'Bảo dưỡng',repair:'Sửa chữa',spa:'Chăm sóc xe',other:'Khác'})[b.service] || b.service)}<br>${Garage.escape(b.note)}</td>
                <td><select data-booking="${b.id}" aria-label="Trạng thái lịch hẹn">${Object.entries({pending:'Chờ xác nhận',confirmed:'Đã xác nhận',cancelled:'Đã hủy'})
                    .map(([value,label]) => `<option value="${value}" ${value === b.status ? 'selected' : ''}>${label}</option>`).join('')}</select></td></tr>`).join('')
                || '<tr><td colspan="5" class="empty-state">Chưa có yêu cầu đặt lịch</td></tr>';
        } catch (error) { showToast(error.message,'error'); }
    }
    table.onchange = async event => {
        const select = event.target.closest('[data-booking]');
        if (!select) return;
        select.disabled = true;
        try { await Garage.request('/bookings/' + select.dataset.booking,{method:'PUT',body:{status:select.value}}); showToast('Đã lưu trạng thái lịch hẹn.','success'); }
        catch(error) { showToast(error.message,'error'); }
        finally { await load(); }
    };
    Garage.subscribe(load);
    load();
});
