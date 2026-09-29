/* One data snapshot keeps the overview, vehicle list and repair history consistent. */
(() => {
    const $ = id => document.getElementById(id);
    const e = Garage.escape;
    const statuses = {draft:['Chờ xử lý','pending'],working:['Đang sửa','working'],completed:['Chờ thanh toán','warning'],paid:['Đã thanh toán','paid']};
    const vehicleStatuses = {waiting:'Chờ xử lý',repairing:'Đang sửa',completed:'Đã hoàn thành',delivered:'Đã giao xe'};
    let vehicles = [], repairs = [], loading = false, detailVersion = 0, selectedRepairId = null, loaded = false;
    const badge = status => `<span class="badge badge-${statuses[status]?.[1] || 'inactive'}">${e(statuses[status]?.[0] || status)}</span>`;
    const sum = status => repairs.filter(r => r.status === status).reduce((total,r) => total + Number(r.totalAmount),0);
    const progress = repair => {
        const items = repair.items || [], done = items.filter(i => i.isCompleted).length;
        return `<span class="muted">${done}/${items.length} hạng mục</span><div class="progress-bar" role="progressbar" aria-label="Tiến độ sửa chữa" aria-valuemin="0" aria-valuemax="${items.length || 1}" aria-valuenow="${done}"><div class="progress-bar-fill" style="width:${items.length ? done / items.length * 100 : 0}%"></div></div>`;
    };
    function navigate(target) { document.querySelector(`.nav-item[data-target="${target}"]`)?.click(); }
    async function load(context = {}) {
        const canRender = Garage.refreshGuard(context);
        if (loading) return;
        loading = true;
        $('refreshData').disabled = true;
        try {
            const data = await Promise.all([Garage.request('/vehicles/my-vehicles'), Garage.request('/repairs/my-repairs')]);
            if (!canRender()) return;
            [vehicles,repairs] = data;
            loaded = true;
            repairs.sort((a,b) => b.id - a.id);
            $('loadError').hidden = true;
            $('statVehicles').textContent = vehicles.length;
            $('statActiveRepairs').textContent = repairs.filter(r => ['draft','working'].includes(r.status)).length;
            $('statOutstanding').textContent = formatCurrency(sum('completed'));
            $('statPaid').textContent = formatCurrency(sum('paid'));
            $('recentRepairs').innerHTML = repairs.slice(0,5).map(r => `<li><div><strong>${e(r.vehicle?.licensePlate || 'Xe')} · Phiếu #${r.id}</strong><small>${formatDate(r.createdAt)} · ${e(r.mechanicName || 'Chưa phân công')}</small>${progress(r)}</div><div class="actions">${badge(r.status)}<button class="btn btn-sm" data-detail="${r.id}">Chi tiết</button></div></li>`).join('') || '<li class="empty-state">Chưa có phiếu sửa chữa. Bạn có thể đặt lịch để garage tiếp nhận xe.</li>';
            const selected = $('repairVehicle').value;
            $('repairVehicle').innerHTML = '<option value="">Tất cả xe</option>' + vehicles.map(v => `<option value="${v.id}">${e(v.licensePlate)}</option>`).join('');
            $('repairVehicle').value = vehicles.some(v => String(v.id) === selected) ? selected : '';
            renderVehicles(); renderRepairs();
            if ($('repairDetailModal').open && selectedRepairId) await detail(selectedRepairId, true);
        } catch (error) {
            $('loadError').textContent = `${error.message}. Dữ liệu có thể chưa được cập nhật; nhấn Làm mới để thử lại.`;
            $('loadError').hidden = false;
            if (!loaded) {
                $('recentRepairs').innerHTML = '<li class="empty-state">Chưa tải được dữ liệu. Vui lòng thử lại.</li>';
                document.querySelector('#vehiclesTable tbody').innerHTML = '<tr><td colspan="5" class="empty-state">Chưa tải được dữ liệu.</td></tr>';
                document.querySelector('#repairsTable tbody').innerHTML = '<tr><td colspan="7" class="empty-state">Chưa tải được dữ liệu.</td></tr>';
            }
        } finally { loading = false; $('refreshData').disabled = false; }
    }
    function renderVehicles() {
        const query = $('vehicleSearch').value.trim().toLocaleLowerCase('vi'), status = $('vehicleStatus').value;
        const rows = vehicles.filter(v => (!status || v.status === status) && `${v.licensePlate} ${v.carBrand} ${v.carModel || ''}`.toLocaleLowerCase('vi').includes(query));
        document.querySelector('#vehiclesTable tbody').innerHTML = rows.map(v => `<tr><td><strong>${e(v.licensePlate)}</strong></td><td>${e(v.carBrand)} ${e(v.carModel || '')}</td><td><span class="badge badge-${v.status === 'repairing' ? 'working' : 'inactive'}">${e(vehicleStatuses[v.status] || v.status)}</span></td><td>${formatDate(v.receivedDate)}</td><td><button class="btn btn-sm" data-vehicle="${v.id}">Xem phiếu sửa</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">Không có xe phù hợp.</td></tr>';
    }
    function renderRepairs() {
        const query = $('repairSearch').value.trim().toLocaleLowerCase('vi'), status = $('repairStatus').value, vehicle = $('repairVehicle').value;
        const rows = repairs.filter(r => (!status || status === r.status) && (!vehicle || String(r.vehicleId) === vehicle) && `#${r.id} ${r.vehicle?.licensePlate || ''} ${r.mechanicName || ''}`.toLocaleLowerCase('vi').includes(query));
        document.querySelector('#repairsTable tbody').innerHTML = rows.map(r => `<tr><td><strong>#${r.id}</strong><br><small>${formatDate(r.createdAt)}</small></td><td>${e(r.vehicle?.licensePlate || '—')}</td><td>${e(r.mechanicName || 'Chưa phân công')}</td><td>${progress(r)}</td><td><strong>${formatCurrency(r.totalAmount)}</strong></td><td>${badge(r.status)}</td><td><button class="btn btn-sm" data-detail="${r.id}">Xem chi tiết</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty-state">Không có phiếu phù hợp với bộ lọc.</td></tr>';
    }
    async function detail(id, quiet = false) {
        selectedRepairId = id;
        const version = ++detailVersion;
        const dialog = $('repairDetailModal');
        if (!quiet) $('repairDetailContent').textContent = 'Đang tải chi tiết…';
        if (!dialog.open) dialog.showModal();
        try {
            const r = await Garage.request(`/repairs/${id}`);
            if (version !== detailVersion || !dialog.open) return;
            const current = Object.keys(statuses).indexOf(r.status);
            const dates = [r.createdAt,r.startedAt,r.completedAt,r.paidAt];
            $('repairDetailContent').innerHTML = `<div class="invoice-box"><p class="eyebrow">AUTOPRO · ${r.status === 'paid' ? 'PHIẾU THU' : 'CHI TIẾT SỬA CHỮA'}</p><h2>Phiếu #${r.id} · ${e(r.vehicle?.licensePlate || '')}</h2><dl class="detail-grid"><div><dt>Khách hàng</dt><dd>${e(r.vehicle?.customerName || '—')}</dd></div><div><dt>Kỹ thuật viên</dt><dd>${e(r.mechanicName || 'Chưa phân công')}</dd></div><div><dt>Xe</dt><dd>${e(r.vehicle?.carBrand || '')} ${e(r.vehicle?.carModel || '')}</dd></div><div><dt>Trạng thái</dt><dd>${badge(r.status)}</dd></div></dl><ol class="timeline">${Object.entries(statuses).map(([status,[label]],i) => `<li class="${i <= current ? 'reached' : ''}" ${i === current ? 'aria-current="step"' : ''}>${label}<small>${dates[i] ? formatDate(dates[i]) : '—'}</small></li>`).join('')}</ol><div class="table-responsive"><table><thead><tr><th>Hạng mục / Vật tư</th><th>Số lượng</th><th>Đơn giá vật tư</th><th>Tiền công</th><th>Thành tiền</th><th>Tiến độ</th></tr></thead><tbody>${(r.items || []).map(i => `<tr><td><strong>${e(i.taskName)}</strong><br><small>${e(i.partName || 'Không có vật tư')}</small></td><td>${i.quantity}</td><td>${formatCurrency(i.partPrice)}</td><td>${formatCurrency(i.laborPrice)}</td><td>${formatCurrency(i.totalPrice)}</td><td>${i.isCompleted ? 'Hoàn thành' : 'Chưa xong'}</td></tr>`).join('')}</tbody></table></div><div class="summary-row"><span>Tổng chi phí</span><strong>${formatCurrency(r.totalAmount)}</strong></div><p class="panel-note">${r.status === 'paid' ? `Đã thanh toán tại garage · ${formatDate(r.paidAt)}` : 'Chi phí = số lượng × đơn giá vật tư + tiền công mỗi hạng mục. Thanh toán tại garage sau khi hoàn thành.'}</p></div>${r.status === 'paid' ? '<div class="invoice-actions"><button class="btn btn-primary" id="printReceipt">In / Lưu PDF phiếu thu</button></div>' : ''}`;
            $('printReceipt')?.addEventListener('click', () => window.print());
        } catch (error) { if (version === detailVersion) $('repairDetailContent').textContent = error.message; }
    }
    document.addEventListener('DOMContentLoaded', () => {
        $('refreshData').addEventListener('click', load);
        ['vehicleSearch','vehicleStatus'].forEach(id => $(id).addEventListener('input',renderVehicles));
        ['repairSearch','repairStatus','repairVehicle'].forEach(id => $(id).addEventListener('input',renderRepairs));
        document.addEventListener('click', event => {
            const button = event.target.closest('button');
            if (button?.dataset.go) navigate(button.dataset.go);
            if (button?.dataset.detail) detail(Number(button.dataset.detail));
            if (button?.dataset.vehicle) {
                $('repairVehicle').value = button.dataset.vehicle;
                $('repairStatus').value = ''; $('repairSearch').value = '';
                renderRepairs(); navigate('repairs-section');
            }
        });
        $('closeRepairDetail').addEventListener('click', () => $('repairDetailModal').close());
        load(); Garage.subscribe(load);
    });
})();
