/* Shared API, formatting and refresh contract for every portal. */
window.Garage = (() => {
    const base = (window.GARAGE_API_URL || (['8000','3000'].includes(location.port) || !location.port
        ? `${location.origin}/api` : `${location.protocol}//${location.hostname}:8000/api`)).replace(/\/$/, '');
    const listeners = new Set();
    let refreshTimer;
    let refreshing = false;
    let activityVersion = 0, lastActivity = 0, pending = false;
    const dirty = new Set();
    function visible(node) {
        if (!node?.isConnected || node.closest('[hidden]')) return false;
        const modal = node.closest('.modal'), dialog = node.closest('dialog');
        if (modal?.style.display === 'none' || (dialog && !dialog.open)) return false;
        return !node.closest('section') || node.closest('section').classList.contains('active-section');
    }
    function editing() {
        return Date.now() - lastActivity < 1800 ||
            document.activeElement?.matches('input,select,textarea,[contenteditable="true"]') ||
            [...document.querySelectorAll('dialog[open],.modal')].some(el => el.open || (el.classList.contains('modal') && el.style.display !== 'none' && visible(el))) ||
            [...dirty].some(visible) ||
            [...document.querySelectorAll('tr[id^="details-"],tr[id^="vehicle-history-"]')].some(el => !el.hidden && visible(el));
    }
    function syncStatus(text) { const label = document.querySelector('.sync-label'); if (label) label.textContent = text; }
    function refreshGuard(context = {}) {
        const version = activityVersion;
        return () => {
            if (!context.background || (version === activityVersion && !editing())) return true;
            pending = true; syncStatus('Đang thao tác · Đồng bộ sau'); return false;
        };
    }
    for (const name of ['pointerdown','keydown','input','change']) document.addEventListener(name, event => {
        activityVersion++; lastActivity = Date.now();
        if (name === 'input' || name === 'change') {
            const form = event.target.closest('form');
            if (form || event.target.closest('#inv-settings,.editor-panel')) dirty.add(form || event.target);
        }
    }, true);
    document.addEventListener('reset', event => dirty.delete(event.target), true);
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
    function toast(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.append(container);
        }
        container.setAttribute('aria-live', 'polite');
        if ([...container.children].some(item => item.textContent === message)) return;
        const item = document.createElement('div');
        item.className = `toast ${type}`;
        item.textContent = message;
        container.append(item);
        setTimeout(() => item.remove(), 5000);
    }
    async function refresh() {
        if (refreshing || document.hidden || !localStorage.getItem('token')) return;
        if (editing()) { pending = true; syncStatus('Đang thao tác · Đồng bộ sau'); return; }
        refreshing = true;
        pending = false;
        try { await Promise.allSettled([...listeners].map(fn => fn({background:true}))); }
        finally { refreshing = false; }
        if (!pending) syncStatus('Đã đồng bộ · ' + new Date().toLocaleTimeString('vi-VN'));
    }
    function changed() {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refresh, 120);
    }
    async function apiFetch(url, options = {}) {
        const editScope = document.activeElement?.closest('form,.card,.modal,dialog');
        const headers = new Headers(options.headers);
        const token = localStorage.getItem('token');
        if (token) headers.set('Authorization', `Bearer ${token}`);
        const response = await fetch(url, { ...options, headers });
        const data = await response.clone().json().catch(() => ({}));
        if (response.status === 401 && !String(url).endsWith('/auth/login')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            const onLoginPage = location.pathname.startsWith('/static/login') || location.pathname === '/login';
            if (!onLoginPage) location.replace('/login');
        }
        if (!response.ok) toast(data.message || 'Không thể xử lý yêu cầu. Vui lòng thử lại.', 'error');
        if (response.ok && data.success && options.method && options.method !== 'GET') {
            if (editScope) for (const node of dirty) { if (editScope.contains(node)) dirty.delete(node); }
            changed();
            localStorage.setItem('garage:data-changed', String(Date.now()));
        }
        return response;
    }
    const pendingOperations = new Map(), pageViews = new Map();
    function pageLabel(state) {
        for (const nav of state.nodes) {
            nav.hidden = !state.meta?.hasMore && !state.previous.length;
            nav.querySelector('[data-page-label]').textContent = state.label + ' · Trang ' + (state.previous.length + 1);
            nav.querySelector('[data-page-prev]').disabled = !state.previous.length || state.loading;
            nav.querySelector('[data-page-next]').disabled = !state.meta?.hasMore || state.loading;
        }
    }
    function pager(path, host, load, {view = 'default', search = null} = {}) {
        host = typeof host === 'string' ? document.querySelector(host) : host;
        if (!host) return;
        const key = path + '|' + view;
        const labels = {'/vehicles':'Xe','/repairs':'Phiếu sửa','/inventory':'Kho','/bookings':'Lịch hẹn','/finance/expenses':'Đề nghị chi','/finance/receipts':'Phiếu thu','/hr/operations':'Lịch nhân viên','/advisor/followups':'Chăm sóc','/service/visits':'Lượt dịch vụ','/maintenance/reminders':'Nhắc bảo dưỡng','/vehicles/my-vehicles':'Xe của tôi','/repairs/my-repairs':'Lịch sử sửa'};
        if (!pageViews.has(key)) pageViews.set(key, {cursor:null, offset:0, previous:[], nodes:new Set(), revision:0, q:'', label:labels[path] || 'Danh sách'});
        const state = pageViews.get(key);
        if ([...state.nodes].some(node => node.isConnected && node.dataset.host === host.id)) return;
        const nav = document.createElement('nav');
        nav.className = 'server-pagination'; nav.setAttribute('aria-label','Phân trang danh sách'); nav.dataset.host = host.id;
        nav.innerHTML = '<button type="button" class="btn btn-sm" data-page-prev>Trang trước</button><span data-page-label aria-live="polite"></span><button type="button" class="btn btn-sm" data-page-next>Trang tiếp</button>';
        (host.closest('.table-responsive') || host).after(nav);
        state.nodes.add(nav);
        const move = async forward => {
            if (state.loading) return;
            const old = {cursor:state.cursor,offset:state.offset,previous:[...state.previous]}, revision = state.revision;
            if (forward) { state.previous.push({cursor:state.cursor,offset:state.offset}); state.cursor = state.meta.nextCursor; state.offset = state.meta.nextOffset || 0; }
            else Object.assign(state, state.previous.pop());
            state.loading = true; pageLabel(state);
            try { await load(); }
            finally { if (state.revision === revision) Object.assign(state, old); state.loading = false; pageLabel(state); }
        };
        nav.querySelector('[data-page-prev]').onclick = () => move(false);
        nav.querySelector('[data-page-next]').onclick = () => move(true);
        const input = typeof search === 'string' ? document.querySelector(search) : search;
        if (input) {
            let debounce;
            input.addEventListener('input', () => {
                clearTimeout(debounce);
                debounce = setTimeout(() => {state.q = input.value;state.cursor = null;state.offset = 0;state.previous = [];load();}, 250);
            });
        }
        pageLabel(state);
    }
    async function requestPage(path, options = {}) {
        const state = options.pageView === false ? null : pageViews.get(path.split('?')[0] + '|' + (options.pageView || 'default'));
        const target = new URL(`${base}${path}`);
        if (state) {
            if (state.cursor && !target.searchParams.has('cursor')) target.searchParams.set('cursor',state.cursor);
            if (state.offset && !target.searchParams.has('offset')) target.searchParams.set('offset',state.offset);
            if (state.q && !target.searchParams.has('q')) target.searchParams.set('q',state.q);
        }
        const protectedWrite = options.method === 'POST' && (/^\/inventory\/\d+\/receive$/.test(path) || /^\/workshop\/tickets\/\d+\/items\/\d+\/evidence$/.test(path));
        const identity = protectedWrite ? path + ':' + JSON.stringify(options.body) : null;
        if (identity && !pendingOperations.has(identity)) {
            pendingOperations.set(identity, crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join(''));
        }
        const response = await apiFetch(target.href, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...(identity ? {'Idempotency-Key': pendingOperations.get(identity)} : {}), ...options.headers },
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
        const result = await response.json().catch(() => null);
        if (!result) throw new Error('Máy chủ chưa trả kết quả hợp lệ. Vui lòng thử lại.');
        if (!response.ok || !result.success) throw new Error(result.message || 'Không thể tải dữ liệu');
        if (identity) pendingOperations.delete(identity);
        if (Array.isArray(result.data) && result.summary) Object.defineProperty(result.data,'summary',{value:result.summary});
        if (state) { state.meta = result; state.revision++; pageLabel(state); }
        return result;
    }
    async function request(path, options = {}) { return (await requestPage(path, options)).data; }
    async function requestAll(path) {
        const items = [], seen = new Set(); let next = path, summary;
        while (true) {
            const page = await requestPage(next, {pageView:false});
            items.push(...page.data); summary ??= page.summary;
            if (!page.hasMore) { if (summary) Object.defineProperty(items,'summary',{value:summary}); return items; }
            const url = new URL(path, location.origin);
            const marker = page.nextCursor ?? page.nextOffset;
            if (marker == null || seen.has(marker)) throw new Error('Không thể tải trang tiếp theo. Vui lòng thử lại.');
            seen.add(marker); url.searchParams.set(page.nextCursor != null ? 'cursor':'offset', marker);
            next = url.pathname + url.search;
        }
    }
    async function requestResources(path) {
        const result = {vehicles:[],mechanics:[],inventory:[]}, done = new Set(), cursors = {};
        const fields = {vehicles:'vehicleCursor',mechanics:'mechanicCursor',inventory:'inventoryCursor'};
        while (done.size < 3) {
            const query = new URLSearchParams({limit:'200',...cursors});
            const data = await request(path + '?' + query, {pageView:false});
            if (!data.pages) return data;
            for (const key of Object.keys(result)) {
                if (done.has(key)) continue;
                result[key].push(...data[key]);
                if (data.pages[key].hasMore) cursors[fields[key]] = data.pages[key].nextCursor;
                else done.add(key);
            }
        }
        return result;
    }
    function subscribe(fn) { listeners.add(fn); }
    function date(value) {
        if (!value) return null;
        return new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`);
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) changed(); });
    window.addEventListener('focus', changed);
    window.addEventListener('storage', event => {
        if (event.key === 'garage:data-changed') changed();
        if (event.key === 'token' && !event.newValue) location.replace('/login');
    });
    setInterval(refresh, 20000);
    setInterval(() => { if (pending && !editing()) refresh(); }, 2000);
    document.addEventListener('DOMContentLoaded', () => {
        window.showToast = toast;
        document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', changed));
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') document.querySelectorAll('.modal').forEach(modal => { modal.style.display = 'none'; });
        });
    });
    return { base, apiFetch, request, requestPage, requestAll, requestResources, pager, subscribe, changed, escape, date, toast, refreshGuard, refresh };
})();
window.escapeHtml = Garage.escape;
