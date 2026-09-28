window.API_URL = Garage.base;
window.getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
});
window.formatCurrency = amount => new Intl.NumberFormat('vi-VN', {style:'currency',currency:'VND'}).format(Number(amount) || 0);
window.formatDate = value => Garage.date(value)?.toLocaleDateString('vi-VN') || '—';
window.showToast = Garage.toast;

Garage.initPortal = role => {
    const nav = [...document.querySelectorAll('.nav-item')];
    const sections = [...document.querySelectorAll('main section')];
    const key = `garage:${role}:section`;
    const activate = item => {
        if (!item) return;
        const target = item.dataset.target;
        if (!document.getElementById(target)) return;
        nav.forEach(node => node.classList.toggle('active', node === item));
        sections.forEach(section => section.classList.toggle('active-section', section.id === target));
        const title = document.getElementById('pageTitle');
        if (title) title.textContent = item.textContent.trim();
        localStorage.setItem(key,target);
    };
    nav.forEach(item => item.addEventListener('click', () => activate(item)));
    activate(nav.find(item => item.dataset.target === localStorage.getItem(key)) || nav[0]);
    document.querySelector('.toggle-sidebar')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('active');
        document.getElementById('content')?.classList.toggle('active');
    });
    document.querySelectorAll('.tab-btn').forEach(button => button.addEventListener('click', () => {
        const section = button.closest('section');
        if (!section) return;
        section.querySelectorAll('.tab-btn').forEach(node => node.classList.toggle('active',node === button));
        section.querySelectorAll('.tab-content').forEach(node => node.classList.toggle('active',node.id === button.dataset.tab));
    }));
};
