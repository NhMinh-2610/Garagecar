window.API_URL = Garage.base;
window.getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
});
window.formatCurrency = amount => new Intl.NumberFormat('vi-VN', {style:'currency',currency:'VND'}).format(Number(amount) || 0);
window.formatDate = value => Garage.date(value)?.toLocaleDateString('vi-VN') || '—';
window.showToast = Garage.toast;

Garage.initPortal = role => {
    const accountButton = document.createElement('button');
    accountButton.className = 'btn btn-sm';
    accountButton.id = 'myAccountButton';
    accountButton.textContent = 'Tài khoản của tôi';
    document.querySelector('.topbar')?.append(accountButton);
    accountButton.addEventListener('click', async () => {
        accountButton.disabled = true;
        try {
            const user = await Garage.request('/auth/me');
            const dialog = document.createElement('dialog');
            dialog.className = 'account-dialog';
            dialog.setAttribute('aria-labelledby', 'myAccountTitle');
            dialog.innerHTML = `<div class="card-heading"><h3 id="myAccountTitle">Tài khoản của tôi</h3><button class="btn-icon" data-close aria-label="Đóng">×</button></div><p><strong>${Garage.escape(user.fullName)}</strong></p><p class="muted">${Garage.escape(user.email)} · ${Garage.escape({admin:'Quản trị viên',mechanic:'Kỹ thuật viên',customer:'Khách hàng',advisor:'Cố vấn dịch vụ',accountant:'Kế toán',hr:'Nhân sự'}[user.role] || user.role)}</p><form id="changePasswordForm"><h4>Đổi mật khẩu</h4><div class="form-group"><label>Mật khẩu hiện tại<input name="currentPassword" type="password" autocomplete="current-password" required></label></div><div class="form-group"><label>Mật khẩu mới<input name="password" type="password" minlength="6" maxlength="72" autocomplete="new-password" required></label></div><div class="form-group"><label>Nhập lại mật khẩu mới<input name="confirmPassword" type="password" autocomplete="new-password" required></label></div><p class="field-help">Sau khi đổi mật khẩu, bạn sẽ đăng nhập lại trên các thiết bị.</p><p id="passwordChangeError" class="text-red" role="alert"></p><button class="btn btn-primary" type="submit">Đổi mật khẩu</button></form>`;
            document.body.append(dialog);
            dialog.querySelector('[data-close]').onclick = () => dialog.close();
            dialog.addEventListener('close', () => dialog.remove());
            dialog.querySelector('form').onsubmit = async event => {
                event.preventDefault();
                const form = event.target, button = form.querySelector('[type="submit"]');
                if (button.disabled || !form.reportValidity()) return;
                const error = dialog.querySelector('#passwordChangeError');
                if (form.elements.password.value !== form.elements.confirmPassword.value) { error.textContent = 'Mật khẩu xác nhận không khớp.'; return; }
                button.disabled = true;
                try {
                    await Garage.request('/auth/me/password', {method:'PUT',body:{currentPassword:form.elements.currentPassword.value,password:form.elements.password.value}});
                    localStorage.removeItem('token'); localStorage.removeItem('user');
                    location.replace('/login?password=changed');
                } catch (failure) { error.textContent = failure.message; button.disabled = false; }
            };
            dialog.showModal();
        } catch (error) { Garage.toast(error.message, 'error'); }
        finally { accountButton.disabled = false; }
    });
    const nav = [...document.querySelectorAll('.nav-item')];
    const sections = [...document.querySelectorAll('main section')];
    const key = `garage:${role}:section`;
    const activate = item => {
        if (!item) return;
        const target = item.dataset.target;
        if (!document.getElementById(target)) return;
        nav.forEach(node => node.classList.toggle('active', node === item));
        nav.forEach(node => node.setAttribute('aria-current', node === item ? 'page' : 'false'));
        sections.forEach(section => section.classList.toggle('active-section', section.id === target));
        const title = document.getElementById('pageTitle');
        if (title) title.textContent = item.textContent.trim();
        localStorage.setItem(key,target);
        document.getElementById('sidebar')?.classList.remove('active');
        document.querySelector('.toggle-sidebar')?.setAttribute('aria-expanded', 'false');
    };
    nav.forEach(item => item.addEventListener('click', () => activate(item)));
    activate(nav.find(item => item.dataset.target === localStorage.getItem(key)) || nav[0]);
    document.querySelector('.toggle-sidebar')?.addEventListener('click', () => {
        const expanded = document.getElementById('sidebar')?.classList.toggle('active');
        document.querySelector('.toggle-sidebar')?.setAttribute('aria-expanded', String(!!expanded));
    });
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        document.getElementById('sidebar')?.classList.remove('active');
        document.querySelector('.toggle-sidebar')?.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('.tab-btn').forEach(button => button.addEventListener('click', () => {
        const section = button.closest('section');
        if (!section) return;
        section.querySelectorAll('.tab-btn').forEach(node => node.classList.toggle('active',node === button));
        section.querySelectorAll('.tab-content').forEach(node => node.classList.toggle('active',node.id === button.dataset.tab));
    }));
};
