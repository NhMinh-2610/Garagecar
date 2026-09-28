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
    async function request(path, options = {}) {
        const response = await apiFetch(`${base}${path}`, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...options.headers },
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Không thể tải dữ liệu');
        return result.data;
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
    return { base, apiFetch, request, subscribe, changed, escape, date, toast, refreshGuard, refresh };
})();
window.escapeHtml = Garage.escape;
