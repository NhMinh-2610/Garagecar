(() => {
    const $ = id => document.getElementById(id), e = Garage.escape;
    let tasks = [], loading = false, mutation = false;
    const statusNames = {draft:'Chờ bắt đầu',working:'Đang sửa',completed:'Chờ thanh toán',paid:'Đã thanh toán'};
    async function load(context = {}) {
        const canRender = Garage.refreshGuard(context);
        if (loading || mutation) return;
        loading = true;
        $('refreshTasks').disabled = true;
        try {
            const data = await Garage.request('/repairs/my-tasks');
            if (!canRender()) return;
            tasks = data;
            $('taskError').hidden = true;
            $('statTotal').textContent = tasks.length;
            $('statWaiting').textContent = tasks.filter(t => t.status === 'draft').length;
            $('statWorking').textContent = tasks.filter(t => t.status === 'working').length;
            $('statDone').textContent = tasks.filter(t => ['completed','paid'].includes(t.status)).length;
            render();
        } catch (error) {
            $('taskError').textContent = `${error.message}. Nhấn Làm mới để thử lại.`;
            $('taskError').hidden = false;
            $('taskCount').textContent = 'Dữ liệu chưa được cập nhật.';
        } finally { loading = false; $('refreshTasks').disabled = false; }
    }
    function render() {
        const query = $('taskSearch').value.trim().toLocaleLowerCase('vi'), status = $('taskStatus').value;
        const filtered = tasks.filter(t => {
            const match = status === 'all' || (status === 'active' ? ['draft','working'].includes(t.status) : status === 'done' ? ['completed','paid'].includes(t.status) : t.status === status);
            return match && `#${t.id} ${t.vehicle?.licensePlate || ''} ${t.vehicle?.carBrand || ''} ${(t.items || []).map(i => i.taskName).join(' ')}`.toLocaleLowerCase('vi').includes(query);
        }).sort((a,b) => $('taskSort').value === 'newest' ? b.id-a.id : a.id-b.id);
        $('taskCount').textContent = `${filtered.length} / ${tasks.length} phiếu phù hợp`;
        $('workingTasks').innerHTML = filtered.map(t => {
            const items = t.items || [], done = items.filter(i => i.isCompleted).length;
            const active = ['draft','working'].includes(t.status), canComplete = t.status === 'working' && items.length > 0 && done === items.length;
            return `<article class="task-card" id="task-${t.id}"><div class="task-card-header"><div><p class="eyebrow">PHIẾU #${t.id}</p><h3>${e(t.vehicle?.licensePlate || 'Chưa có biển số')}</h3><p class="muted">${e(t.vehicle?.carBrand || '')} ${e(t.vehicle?.carModel || '')}</p></div><span class="badge badge-${t.status === 'draft' ? 'pending' : t.status === 'working' ? 'working' : 'done'}">${e(statusNames[t.status] || t.status)}</span></div><div class="task-card-meta"><span>Khách: ${e(t.vehicle?.customerName || '—')}</span><span>Tiếp nhận: ${formatDate(t.createdAt)}</span>${t.completedAt ? `<span>Hoàn thành: ${formatDate(t.completedAt)}</span>` : ''}</div><div class="progress-text"><span>${done}/${items.length} hạng mục</span><span>${items.length ? Math.round(done/items.length*100) : 0}%</span></div><div class="progress-bar" role="progressbar" aria-label="Tiến độ phiếu ${t.id}" aria-valuemin="0" aria-valuemax="${items.length || 1}" aria-valuenow="${done}"><div class="progress-bar-fill" style="width:${items.length ? done/items.length*100 : 0}%"></div></div><div class="checklist">${items.map(i => `<label class="checklist-item ${i.isCompleted ? 'done' : ''}"><input type="checkbox" data-ticket="${t.id}" data-item="${i.id}" ${i.isCompleted ? 'checked' : ''} ${t.status !== 'working' || mutation ? 'disabled' : ''}><span><strong>${e(i.taskName)}</strong><small>${i.partName && i.partName !== '---' ? `${e(i.partName)} · Số lượng: ${i.quantity}` : 'Không sử dụng vật tư'}</small>${i.completedAt ? `<small>Hoàn thành: ${formatDate(i.completedAt)}</small>` : ''}</span></label>`).join('') || '<p class="muted">Chưa có hạng mục. Liên hệ quản lý để bổ sung.</p>'}</div>${active ? `<div class="task-actions">${t.status === 'draft' ? `<button class="btn btn-primary" data-start="${t.id}" ${mutation ? 'disabled' : ''}>Bắt đầu sửa</button>` : `<button class="btn btn-success" data-complete="${t.id}" ${!canComplete || mutation ? 'disabled' : ''}>Hoàn thành phiếu</button>`}<span class="muted">${t.status === 'draft' ? 'Bắt đầu để cập nhật checklist.' : canComplete ? 'Đã đủ hạng mục để bàn giao.' : `Còn ${items.length-done} hạng mục cần xử lý.`}</span></div>` : '<p class="muted">Phiếu đã hoàn thành. Checklist được lưu để tra cứu.</p>'}</article>`;
        }).join('') || '<div class="card empty-state">Không có công việc phù hợp. Phiếu mới sẽ xuất hiện khi quản lý phân công cho bạn.</div>';
    }
    async function update(path, body) {
        if (mutation || loading) { render(); return; }
        mutation = true; render();
        try {
            await Garage.request(path,{method:'PUT',body});
            Garage.toast('Đã cập nhật tiến độ.','success');
        } catch (error) { Garage.toast(error.message,'error'); }
        finally {
            mutation = false;
            // Reload even after a conflict; restore the server checklist after a failed request.
            await load();
            render();
        }
    }
    document.addEventListener('DOMContentLoaded', () => {
        ['taskSearch','taskStatus','taskSort'].forEach(id => $(id).addEventListener('input',render));
        $('refreshTasks').addEventListener('click',load);
        $('workingTasks').addEventListener('change', event => {
            const input = event.target.closest('input[data-item]');
            if (!input) return;
            const ticket = tasks.find(t => t.id === Number(input.dataset.ticket));
            if (ticket?.status === 'working') update(`/repairs/${ticket.id}/items/${input.dataset.item}/toggle`,{isCompleted:input.checked});
        });
        $('workingTasks').addEventListener('click', event => {
            const button = event.target.closest('button');
            if (button?.dataset.start) update(`/repairs/${button.dataset.start}`,{status:'working'});
            if (button?.dataset.complete && confirm('Xác nhận đã hoàn thành tất cả hạng mục và bàn giao phiếu?')) update(`/repairs/${button.dataset.complete}`,{status:'completed'});
        });
        load(); Garage.subscribe(load);
    });
})();
