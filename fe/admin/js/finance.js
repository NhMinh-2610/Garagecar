document.addEventListener('DOMContentLoaded', () => {
    const select = document.querySelector('#finance-section select');
    const button = document.querySelector('#finance-section .btn-success');
    const details = document.querySelector('.invoice-details');
    let repairs = [], paid = null;
    function preview(ticket = null) {
        button.disabled = !ticket || ticket.status === 'paid';
        details.innerHTML = ticket ? `<p><strong>Phiếu:</strong> #${ticket.id}</p>
            <p><strong>Khách hàng:</strong> ${Garage.escape(ticket.vehicle.customerName)}</p>
            <p><strong>Biển số:</strong> ${Garage.escape(ticket.vehicle.licensePlate)}</p>
            ${ticket.items.map(i => `<p>${Garage.escape(i.taskName)} × ${i.quantity}: ${formatCurrency(i.totalPrice)}</p>`).join('')}
            <p><strong>Tổng tiền:</strong> ${formatCurrency(ticket.totalAmount)}</p>
            <p>${ticket.status === 'paid' ? 'Đã thanh toán — ' + Garage.date(ticket.paidAt).toLocaleString('vi-VN') : 'Chưa thanh toán'}</p>`
            : '<p>Chọn phiếu đã hoàn thành để xem chi tiết và thu tiền.</p>';
        document.querySelector('.invoice-header p').textContent = '';
    }
    async function load() {
        try {
            repairs = (await Garage.request('/repairs')).filter(r => r.status === 'completed');
            const current = select.value;
            select.replaceChildren(new Option(repairs.length ? '-- Chọn phiếu --' : 'Không có phiếu chờ thu tiền',''),
                ...repairs.map(r => new Option('#' + r.id + ' — ' + r.vehicle.licensePlate + ' — ' + formatCurrency(r.totalAmount),r.id)));
            select.value = current;
            preview(repairs.find(r => r.id === Number(select.value)) || paid);
        } catch (error) { showToast(error.message,'error'); }
    }
    select.onchange = () => { paid = null; preview(repairs.find(r => r.id === Number(select.value))); };
    button.onclick = async () => {
        const id = Number(select.value);
        if (!id || !confirm('Xác nhận đã thu đủ tiền cho phiếu này?')) return;
        button.disabled = true;
        try {
            paid = await Garage.request('/repairs/' + id, {method:'PUT',body:{status:'paid'}});
            preview(paid); showToast('Đã ghi nhận thanh toán.','success');
            await load();
        } catch (error) { showToast(error.message,'error'); button.disabled = false; }
    };
    button.textContent = 'Xác nhận thu tiền';
    const print = document.createElement('button');
    print.className = 'btn btn-secondary';
    print.textContent = 'In phiếu';
    print.onclick = () => window.print();
    button.after(print);
    Garage.subscribe(load);
    preview(); load();
});

