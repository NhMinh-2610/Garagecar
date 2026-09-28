/* Shared API, formatting and refresh contract for every portal. */
window.Garage = (() => {
    const base = (window.GARAGE_API_URL || (['8000','3000'].includes(location.port) || !location.port
        ? `${location.origin}/api` : `${location.protocol}//${location.hostname}:8000/api`)).replace(/\/$/, '');
    const listeners = new Set();
    let refreshTimer;
    let refreshing = false;
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
        refreshing = true;
        try { await Promise.allSettled([...listeners].map(fn => fn())); }
        finally { refreshing = false; }
    }
    function changed() {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refresh, 120);
    }
    async function apiFetch(url, options = {}) {
        const headers = new Headers(options.headers);
        const token = localStorage.getItem('token');
        if (token) headers.set('Authorization', `Bearer ${token}`);
        const response = await fetch(url, { ...options, headers });
        const data = await response.clone().json().catch(() => ({}));
        if (response.status === 401 && !String(url).endsWith('/auth/login')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            location.replace('../login/index.html');
        }
        if (!response.ok) toast(data.message || 'Không thể xử lý yêu cầu. Vui lòng thử lại.', 'error');
        if (response.ok && data.success && options.method && options.method !== 'GET') {
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
        if (event.key === 'token') location.reload();
    });
    setInterval(refresh, 20000);
    document.addEventListener('DOMContentLoaded', () => {
        window.showToast = toast;
        document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', changed));
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') document.querySelectorAll('.modal').forEach(modal => { modal.style.display = 'none'; });
        });
    });
    return { base, apiFetch, request, subscribe, changed, escape, date, toast };
})();
window.escapeHtml = Garage.escape;
