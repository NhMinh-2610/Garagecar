document.addEventListener('DOMContentLoaded', () => {
    const byId=id=>document.getElementById(id), esc=Garage.escape;
    let mechanics=[],users=[],vehicles=[];
    function render() {
        byId('hrActive').textContent=mechanics.filter(m=>m.status==='active').length;
        byId('hrUnlinked').textContent=mechanics.filter(m=>m.status==='active'&&!m.userId).length;
        byId('hrAccounts').textContent=users.length;
        byId('hrAdmins').textContent=users.filter(u=>u.role==='admin').length;
        const search=byId('staffSearch').value.toLowerCase(), filter=byId('staffFilter').value;
        const staff=mechanics.filter(m=>[m.fullName,m.phone,m.specialty].join(' ').toLowerCase().includes(search)
            && (!filter || (filter==='unlinked' ? !m.userId : m.status===filter)));
        byId('mechanicsTable').querySelector('tbody').innerHTML=staff.map(m=>`<tr><td><strong>${esc(m.fullName)}</strong><br>
            <small>${esc(users.find(u=>u.id===m.userId)?.email || 'Chưa liên kết tài khoản')}</small></td><td>${esc(m.phone || '—')}</td>
            <td>${esc(m.specialty || 'Chung')}</td><td><span class="badge ${m.status==='active'?'badge-done':'badge-inactive'}">${m.status==='active'?'Hoạt động':'Ngừng hoạt động'}</span></td>
            <td><button class="btn btn-sm" data-staff="${m.id}" data-action="edit">Sửa hồ sơ</button><button class="btn btn-sm" data-staff="${m.id}" data-action="account">Tài khoản</button>
            <button class="btn btn-sm" data-staff="${m.id}" data-action="status">${m.status==='active'?'Tạm ngừng':'Kích hoạt'}</button></td></tr>`).join('')
            || '<tr><td colspan="5" class="empty-state">Không có kỹ thuật viên phù hợp.</td></tr>';
        const userSearch=byId('userSearch').value.toLowerCase(), role=byId('userRoleFilter').value, accountStatus=byId('userStatusFilter').value;
        const current=JSON.parse(localStorage.getItem('user')||'{}');
        const roles={admin:'Quản trị viên',mechanic:'Kỹ thuật viên',customer:'Khách hàng'};
        const filtered=users.filter(u=>[u.username,u.fullName,u.email].join(' ').toLowerCase().includes(userSearch)&&(!role||u.role===role)&&(!accountStatus||(accountStatus==='locked' ? u.isActive===false : u.isActive!==false)));
        byId('accountSummary').textContent=`${filtered.length} / ${users.length} tài khoản · ${users.filter(u=>u.isActive===false).length} đã khóa`;
        byId('usersTable').querySelector('tbody').innerHTML=filtered
            .map(u=>`<tr><td><strong>${esc(u.username)}</strong></td><td>${esc(u.fullName)}</td><td>${esc(u.email)}</td>
            <td><span class="badge ${u.role==='admin'?'badge-working':'badge-inactive'}">${esc(roles[u.role]||u.role)}</span><br><small>${u.role==='customer' ? vehicles.filter(v=>v.customerId===u.id).length+' xe liên kết' : u.role==='mechanic' ? esc(mechanics.find(m=>m.userId===u.id)?.fullName || 'Chưa có hồ sơ thợ') : 'Điều hành garage'}</small></td>
            <td><span class="badge ${u.isActive===false?'badge-inactive':'badge-done'}">${u.isActive===false?'Đã khóa':'Hoạt động'}</span><br><small>${u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Chưa ghi nhận đăng nhập'}</small></td>
            <td><button class="btn btn-sm" data-user="${u.id}" data-action="edit">Quản lý</button>${u.id===current.id?'<small>Tài khoản của bạn</small>':`<button class="btn btn-sm" data-user="${u.id}" data-action="password">Đặt lại mật khẩu</button>`}</td></tr>`).join('')
            || '<tr><td colspan="6" class="empty-state">Không có tài khoản phù hợp.</td></tr>';
        const value=byId('staffMechanicId').value;
        byId('staffMechanicId').replaceChildren(new Option('Tạo hồ sơ mới',''),...mechanics.filter(m=>!m.userId&&m.status==='active').map(m=>new Option(m.fullName,m.id)));
        byId('staffMechanicId').value=value;
        const selected=[...byId('accountVehicleIds').selectedOptions].map(o=>o.value);
        byId('accountVehicleIds').replaceChildren(...vehicles.filter(v=>!v.customerId).map(v=>new Option(`${v.licensePlate} · ${v.customerName}`,v.id,false,selected.includes(String(v.id)))));
        const unlinked=vehicles.filter(v=>!v.customerId);
        byId('accountCoverage').innerHTML=`<div><strong>${unlinked.length} xe chưa liên kết tài khoản khách hàng</strong><p class="muted">Tạo tài khoản bằng email của chủ xe hoặc liên kết tài khoản có sẵn tại Tiếp nhận.</p>${unlinked.slice(0,10).map(v=>`<button class="btn btn-sm" data-create-customer="${v.id}">${esc(v.licensePlate)} · Tạo tài khoản</button>`).join('')}</div>`;
    }
    async function load(context = {}) {
        const canRender = Garage.refreshGuard(context);
        try { [mechanics,users,vehicles]=await Promise.all([Garage.request('/mechanics?include_inactive=true'),Garage.request('/auth/users'),Garage.request('/vehicles')]); if (!canRender()) return; render(); }
        catch(error){showToast(error.message,'error');}
    }
    for(const id of ['staffSearch','userSearch'])byId(id).oninput=render;
    for(const id of ['staffFilter','userRoleFilter','userStatusFilter'])byId(id).onchange=render;
    byId('btnAddMechanic').onclick=()=>openCreate('mechanic');
    byId('closeHrModal').onclick=()=>{byId('hrModal').style.display='none';};
    function syncRole() {
        const role=byId('newRole').value;
        byId('staffMechanicId').disabled=role!=='mechanic';
        byId('staffMechanicId').closest('.form-group').hidden=role!=='mechanic';
        byId('customerVehicleField').hidden=role!=='customer';
    }
    function openCreate(role='customer', profile=null) {
        byId('createUserForm').reset();byId('newRole').value=role;
        if(profile) {
            byId('newFullName').value=role==='mechanic'?profile.fullName:profile.customerName;
            if(role==='mechanic') byId('staffMechanicId').value=profile.id;
            else byId('accountVehicleIds').value=profile.id;
        }
        syncRole();byId('userModal').style.display='block';byId('newFullName').focus();
    }
    byId('btnCreateUser').onclick=()=>openCreate();
    byId('closeUserModal').onclick=()=>{byId('userModal').style.display='none';};
    byId('newRole').onchange=syncRole;
    byId('accountCoverage').onclick=event=>{
        const button=event.target.closest('[data-create-customer]');
        if(button)openCreate('customer',vehicles.find(v=>v.id===Number(button.dataset.createCustomer)));
    };
    byId('hrForm').onsubmit=async event=>{
        event.preventDefault();const id=byId('mechId').value,button=event.target.querySelector('[type="submit"]');button.disabled=true;
        try{
            await Garage.request('/mechanics'+(id?'/'+id:''),{method:id?'PUT':'POST',body:{fullName:byId('mechName').value,phone:byId('mechPhone').value,specialty:byId('mechSpecialty').value,status:byId('mechStatus').value}});
            byId('hrModal').style.display='none';showToast('Đã lưu hồ sơ kỹ thuật viên.','success');await load();
        }catch(error){showToast(error.message,'error');}finally{button.disabled=false;}
    };
    byId('createUserForm').onsubmit=async event=>{
        event.preventDefault();const button=event.target.querySelector('[type="submit"]');if(button.disabled||!event.target.reportValidity())return;button.disabled=true;
        try{
            await Garage.request('/auth/users',{method:'POST',body:{username:byId('newUsername').value,fullName:byId('newFullName').value,email:byId('newEmail').value,password:byId('newPassword').value,role:byId('newRole').value,mechanicId:byId('newRole').value==='mechanic'?Number(byId('staffMechanicId').value)||null:null,vehicleIds:byId('newRole').value==='customer'?[...byId('accountVehicleIds').selectedOptions].map(o=>Number(o.value)):[]}});
            byId('userModal').style.display='none';byId('createUserForm').reset();showToast('Đã tạo tài khoản. Người dùng có thể đăng nhập bằng email và đổi mật khẩu tại Tài khoản của tôi.','success');await load();
        }catch(error){showToast(error.message,'error');}finally{button.disabled=false;}
    };
    byId('mechanicsTable').onclick=async event=>{
        const button=event.target.closest('[data-staff]');if(!button)return;
        const m=mechanics.find(m=>m.id===Number(button.dataset.staff));
        if(button.dataset.action==='edit'){
            for(const [id,key] of [['mechId','id'],['mechName','fullName'],['mechPhone','phone'],['mechSpecialty','specialty'],['mechStatus','status']])byId(id).value=m[key]||'';
            byId('hrModal').style.display='block';return;
        }
        if(button.dataset.action==='account'){
            let dialog=byId('linkMechanicDialog');
            if(!dialog){dialog=document.createElement('dialog');dialog.id='linkMechanicDialog';document.body.append(dialog);}
            dialog.innerHTML='<h3>Liên kết tài khoản kỹ thuật viên</h3><p class="muted">Chọn đúng email đăng nhập của nhân viên.</p><select id="mechanicAccount" aria-label="Tài khoản thợ"></select><button class="btn btn-primary" id="saveMechanicAccount">Lưu liên kết</button><form method="dialog"><button class="btn btn-secondary">Đóng</button></form>';
            const select=dialog.querySelector('select');
            select.replaceChildren(new Option('Chưa liên kết',''),...users.filter(u=>u.role==='mechanic'&&!mechanics.some(other=>other.userId===u.id&&other.id!==m.id)).map(u=>new Option(u.fullName+' — '+u.email,u.id)));
            select.value=m.userId||'';
            if(!m.userId && m.status==='active') {
                const create=document.createElement('button');create.className='btn btn-secondary';create.textContent='Tạo tài khoản cho thợ này';
                create.onclick=()=>{dialog.close();openCreate('mechanic',m);};dialog.append(create);
            }
            byId('saveMechanicAccount').onclick=async()=>{
                try{await Garage.request('/mechanics/'+m.id,{method:'PUT',body:{userId:Number(select.value)||null}});dialog.close();await load();showToast('Đã lưu liên kết.','success');}
                catch(error){showToast(error.message,'error');}
            };
            dialog.showModal();return;
        }
        if(!confirm(m.status==='active'?'Tạm ngừng kỹ thuật viên này? Cần phân công lại các phiếu đang mở.':'Kích hoạt lại kỹ thuật viên?'))return;
        try{await Garage.request('/mechanics/'+m.id,{method:'PUT',body:{status:m.status==='active'?'inactive':'active'}});await load();showToast('Đã cập nhật trạng thái.','success');}
        catch(error){showToast(error.message,'error');}
    };
    byId('usersTable').onclick=async event=>{
        const button=event.target.closest('[data-user]');if(!button)return;
        const user=users.find(u=>u.id===Number(button.dataset.user));
        const reset=button.dataset.action==='password',self=user.id===JSON.parse(localStorage.getItem('user')||'{}').id;
        const dialog=document.createElement('dialog');dialog.className='account-dialog';dialog.setAttribute('aria-labelledby','accountDialogTitle');
        dialog.innerHTML=`<div class="card-heading"><h3 id="accountDialogTitle">${reset?'Đặt lại mật khẩu':'Quản lý tài khoản'}</h3><button class="btn-icon" data-close aria-label="Đóng">×</button></div><p class="muted">${esc(user.email)} · ${esc(user.role)}</p><form id="accountEditForm">${reset?'<p class="notice">Các phiên đăng nhập cũ sẽ kết thúc. Cung cấp mật khẩu mới cho đúng chủ tài khoản.</p><div class="form-group"><label>Mật khẩu mới<input name="password" type="password" autocomplete="new-password" minlength="6" maxlength="72" required></label></div><div class="form-group"><label>Nhập lại mật khẩu<input name="confirmPassword" type="password" autocomplete="new-password" required></label></div>':`<div class="form-group"><label>Họ tên<input name="fullName" value="${esc(user.fullName)}" maxlength="255" required></label></div><div class="form-group"><label>Tên đăng nhập<input name="username" value="${esc(user.username)}" maxlength="255" required></label></div><div class="form-group"><label>Email<input name="email" type="email" value="${esc(user.email)}" required></label></div><div class="form-group"><label>Trạng thái<select name="isActive" ${self?'disabled':''}><option value="true" ${user.isActive!==false?'selected':''}>Hoạt động</option><option value="false" ${user.isActive===false?'selected':''}>Khóa truy cập</option></select></label></div><p class="field-help">Khóa tài khoản kết thúc các phiên đăng nhập, giữ nguyên hồ sơ và lịch sử sửa chữa.</p>`}<p class="field-help" id="accountEditError" role="alert"></p><div class="form-actions"><button type="submit" class="btn btn-primary">${reset?'Đặt lại mật khẩu':'Lưu thay đổi'}</button></div></form>`;
        document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();
        dialog.addEventListener('close',()=>dialog.remove());
        dialog.querySelector('form').onsubmit=async event=>{
            event.preventDefault();const form=event.target,submit=form.querySelector('[type="submit"]');
            if(submit.disabled||!form.reportValidity())return;
            if(reset&&form.elements.password.value!==form.elements.confirmPassword.value){byId('accountEditError').textContent='Mật khẩu xác nhận không khớp.';return;}
            submit.disabled=true;
            try {
                const body=reset?{password:form.elements.password.value}:{fullName:form.elements.fullName.value,username:form.elements.username.value,email:form.elements.email.value,isActive:form.elements.isActive.value==='true'};
                const data=await Garage.request(`/auth/users/${user.id}${reset?'/password':''}`,{method:reset?'POST':'PUT',body});
                if(self&&!reset){localStorage.setItem('user',JSON.stringify(data));document.querySelector('.user-info h4').textContent=data.fullName;}
                dialog.close();showToast(reset?'Đã đặt lại mật khẩu.':'Đã cập nhật tài khoản.','success');await load();
            }catch(error){byId('accountEditError').textContent=error.message;}finally{submit.disabled=false;}
        };
        dialog.showModal();
    };
    Garage.subscribe(load);load();
});
