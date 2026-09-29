document.addEventListener('DOMContentLoaded', () => {
    const byId = id => document.getElementById(id);
    const select = byId('paymentSelect');
    const button = byId('confirmPayment');
    const details = document.querySelector('.invoice-details');
    const print = document.createElement('button');
    print.className = 'btn btn-secondary'; print.textContent = 'In phiếu';
    print.onclick = () => window.print(); button.after(print);
    let all = [], selectedId = null;
    const esc = Garage.escape;
    function preview(ticket = null) {
        button.disabled = !ticket || ticket.status === 'paid';
        print.disabled = !ticket;
        details.innerHTML = ticket ? `<div class="summary-row"><span>Phiếu sửa</span><strong>#${ticket.id}</strong></div>
            <div class="summary-row"><span>Khách hàng</span><strong>${esc(ticket.vehicle.customerName)}</strong></div>
            <div class="summary-row"><span>Biển số</span><strong>${esc(ticket.vehicle.licensePlate)}</strong></div>
            <table><thead><tr><th>Hạng mục</th><th>SL</th><th>Thành tiền</th></tr></thead><tbody>
            ${ticket.items.map(i => `<tr><td>${esc(i.taskName)}</td><td>${i.quantity}</td><td>${formatCurrency(i.totalPrice)}</td></tr>`).join('')}</tbody></table>
            <div class="summary-row"><strong>Tổng thanh toán</strong><strong>${formatCurrency(ticket.totalAmount)}</strong></div>
            <p><span class="badge ${ticket.status === 'paid' ? 'badge-done':'badge-warning'}">${ticket.status === 'paid' ? 'Đã thu tiền' : 'Chưa thu tiền'}</span>
            ${ticket.paidAt ? Garage.date(ticket.paidAt).toLocaleString('vi-VN') : ''}</p>`
            : '<p class="empty-state">Chọn phiếu đã hoàn thành để xem chi tiết và thu tiền.</p>';
    }
    function renderHistory() {
        const search = byId('paymentSearch').value.toLowerCase();
        const rows = all.filter(r => r.status === 'paid' && [r.id,r.vehicle?.licensePlate,r.vehicle?.customerName].join(' ').toLowerCase().includes(search))
            .sort((a,b) => Garage.date(b.paidAt) - Garage.date(a.paidAt));
        byId('paymentHistory').querySelector('tbody').innerHTML = rows.map(r => `<tr><td>#${r.id}</td>
            <td><strong>${esc(r.vehicle.customerName)}</strong><br><small>${esc(r.vehicle.licensePlate)}</small></td>
            <td>${r.paidAt ? Garage.date(r.paidAt).toLocaleString('vi-VN') : 'Chưa có ngày thu'}</td><td><strong>${formatCurrency(r.totalAmount)}</strong></td>
            <td><button class="btn btn-sm" data-invoice="${r.id}">Xem / In lại</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">Chưa có phiếu thu phù hợp.</td></tr>';
    }
    async function load(context = {}) {
        const canRender = Garage.refreshGuard(context);
        try {
            const data = await Garage.request('/repairs');
            if (!canRender()) return;
            all = data;
            const pending = all.filter(r => r.status === 'completed');
            const paid = all.filter(r => r.status === 'paid');
            const now = new Date();
            const monthKey = date => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit'}).format(date);
            byId('financePending').textContent = pending.length;
            byId('financeOutstanding').textContent = formatCurrency(pending.reduce((s,r) => s + r.totalAmount,0));
            byId('financePaidCount').textContent = paid.length;
            byId('financeMonth').textContent = formatCurrency(paid.filter(r => r.paidAt && monthKey(Garage.date(r.paidAt)) === monthKey(now)).reduce((s,r) => s+r.totalAmount,0));
            const value = select.value;
            select.replaceChildren(new Option(pending.length ? '-- Chọn phiếu chờ thu --':'Không có phiếu chờ thu',''),
                ...pending.map(r => new Option('#'+r.id+' — '+r.vehicle.licensePlate+' — '+formatCurrency(r.totalAmount),r.id)));
            select.value = value;
            preview(all.find(r => r.id === selectedId));
            renderHistory();
        } catch(error) { showToast(error.message,'error'); }
    }
    select.onchange = () => { selectedId = Number(select.value) || null; preview(all.find(r => r.id === selectedId)); };
    window.openPaymentForTicket = async id => {
        document.querySelector('.nav-item[data-target="finance-section"]')?.click();
        await load();
        selectedId = Number(id);
        const ticket = all.find(r => r.id === selectedId);
        if (!ticket || !['completed','paid'].includes(ticket.status)) { showToast('Phiếu chưa sẵn sàng để thu tiền.','warning'); return; }
        select.value = ticket.status === 'completed' ? String(id) : '';
        preview(ticket);
        document.querySelector('.invoice-box').scrollIntoView({behavior:'smooth',block:'center'});
    };
    byId('paymentSearch').oninput = renderHistory;
    byId('paymentHistory').onclick = event => {
        const action = event.target.closest('[data-invoice]');
        if (!action) return;
        selectedId = Number(action.dataset.invoice);
        select.value = '';
        preview(all.find(r => r.id === selectedId));
        document.querySelector('.invoice-box').scrollIntoView({behavior:'smooth',block:'center'});
    };
    button.onclick = async () => {
        if (!selectedId || !confirm('Xác nhận garage đã nhận đủ tiền cho phiếu #' + selectedId + '?')) return;
        button.disabled = true;
        try {
            await Garage.request('/repairs/'+selectedId,{method:'PUT',body:{status:'paid'}});
            showToast('Đã ghi nhận thu tiền.','success'); await load();
        } catch(error) { showToast(error.message,'error'); button.disabled=false; }
    };
    Garage.subscribe(load); preview(); load();
});
