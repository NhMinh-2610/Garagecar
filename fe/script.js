document.addEventListener('DOMContentLoaded', () => {
    const menu = document.getElementById('publicNav');
    const toggle = document.querySelector('.public-menu-toggle');
    toggle.addEventListener('click', () => {
        const open = menu.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
    });
    menu.addEventListener('click', event => {
        if (!event.target.closest('a')) return;
        menu.classList.remove('open'); toggle.setAttribute('aria-expanded','false');
    });
    document.querySelectorAll('[data-service]').forEach(button => button.addEventListener('click', () => {
        document.getElementById('bookingService').value = button.dataset.service;
        document.getElementById('contact').scrollIntoView({behavior:'smooth'});
        document.getElementById('bookingName').focus({preventScroll:true});
    }));
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (localStorage.getItem('token') && ['admin','mechanic','customer','advisor','accountant','hr'].includes(user?.role)) {
            const link = document.getElementById('loginLink');
            link.textContent = 'Vào không gian của tôi'; link.href = '/' + user.role;
            document.getElementById('workspaceLink').href = link.href;
            document.getElementById('workspaceLink').textContent = user.role === 'customer' ? 'Theo dõi xe của tôi' : 'Mở trang làm việc';
            document.getElementById('registerLink').hidden = true;
        }
    } catch { /* The public page also works without a session. */ }
    async function loadServices() {
        const button = document.getElementById('reloadServices'), container = document.getElementById('servicePrices');
        button.disabled = true;
        try {
            const wages = await Garage.request('/settings/wages');
            container.replaceChildren();
            for (const wage of wages) {
                const card = document.createElement('article'); card.className = 'card';
                const title = document.createElement('h3'); title.textContent = wage.name;
                const price = document.createElement('p'); price.className = 'service-price';
                price.textContent = new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(wage.price);
                const note = document.createElement('p'); note.className = 'muted'; note.textContent = 'Tiền công / hạng mục · chưa gồm vật tư';
                card.append(title,price,note); container.append(card);
            }
            if (!wages.length) container.textContent = 'Danh mục đang được cập nhật. Gửi yêu cầu để được tư vấn.';
        } catch { container.textContent = 'Chưa tải được danh mục tiền công. Nhấn Tải lại danh mục để thử lại.'; }
        finally { button.disabled = false; }
    }
    document.getElementById('reloadServices').addEventListener('click', loadServices);
    loadServices();
});
