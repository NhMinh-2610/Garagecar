const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');

const root = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const vehicle = {id:1,licensePlate:'30A12345',customerName:'Customer <safe>',customerId:3,
    phone:'0901234567',carBrand:'Toyota',carModel:'Vios',status:'waiting',receivedDate:'2026-09-28T00:00:00Z',repairTickets:[]};
const part = {id:1,name:'Oil <safe>',quantity:10,unitPrice:100,createdAt:'2026-09-28T00:00:00Z'};
const mechanic = {id:1,fullName:'Mechanic',userId:2,status:'active'};

test('admin creates customer account linked to a vehicle, edits activation and resets passwords', async () => {
    const account = {id:3,username:'customer',fullName:'Customer',email:'c@example.com',role:'customer',isActive:true};
    const {dom,w,calls,errors} = await portal('admin',{'/vehicles':[{...vehicle,customerId:null}],'/auth/users':options=>response(options.method==='POST'?{id:9}:[account]),'/auth/users/3':account});
    try {
        const $=id=>w.document.getElementById(id);
        w.document.querySelector('[data-create-customer="1"]').click();
        assert.equal($('newRole').value,'customer');
        assert.equal($('staffMechanicId').disabled,true);
        assert.equal($('accountVehicleIds').value,'1');
        $('newUsername').value='newcustomer'; $('newEmail').value='new@example.com'; $('newPassword').value='initial123';
        $('createUserForm').dispatchEvent(new w.Event('submit',{cancelable:true})); await delay(80);
        const create=calls.find(c=>c.path==='/auth/users'&&c.method==='POST');
        assert.equal(create.body.role,'customer'); assert.deepEqual(create.body.vehicleIds,[1]); assert.equal(create.body.mechanicId,null);
        assert.equal($('newPassword').value,'');
        w.document.querySelector('[data-user="3"][data-action="edit"]').click();
        let form=$('accountEditForm'); form.elements.isActive.value='false';
        form.dispatchEvent(new w.Event('submit',{cancelable:true})); await delay(80);
        assert.equal(calls.find(c=>c.path==='/auth/users/3'&&c.method==='PUT').body.isActive,false);
        w.document.querySelector('[data-user="3"][data-action="password"]').click();
        form=$('accountEditForm'); form.elements.password.value='changed123'; form.elements.confirmPassword.value='mismatch';
        form.dispatchEvent(new w.Event('submit',{cancelable:true}));
        assert.ok($('accountEditError').textContent.includes('không khớp'));
        form.elements.confirmPassword.value='changed123'; form.dispatchEvent(new w.Event('submit',{cancelable:true})); await delay(80);
        assert.deepEqual(calls.find(c=>c.path==='/auth/users/3/password').body,{password:'changed123'});
        $('btnAddMechanic').click();
        assert.equal($('newRole').value,'mechanic');
        assert.equal($('staffMechanicId').disabled,false);
        assert.equal($('customerVehicleField').hidden,true);
        assert.deepEqual(errors,[]);
    } finally {dom.window.close();}
});

test('all roles can access account details; failed password change retains session', async () => {
    for(const role of ['admin','mechanic','customer']) {
        const {dom,w,calls,errors}=await portal(role,{'/auth/me':{id:1,role,fullName:'Test',email:'test@example.com'},'/auth/me/password':()=>response(null,400,'Mật khẩu hiện tại không đúng')});
        try {
            w.document.getElementById('myAccountButton').click(); await delay(50);
            const form=w.document.getElementById('changePasswordForm');
            assert.ok(form); form.elements.currentPassword.value='wrong123';form.elements.password.value='next123';form.elements.confirmPassword.value='next123';
            form.dispatchEvent(new w.Event('submit',{cancelable:true})); await delay(50);
            assert.ok(w.document.getElementById('passwordChangeError').textContent.includes('không đúng'));
            assert.equal(w.localStorage.getItem('token'),'test');
            assert.deepEqual(calls.find(c=>c.path==='/auth/me/password').body,{currentPassword:'wrong123',password:'next123'});
            assert.deepEqual(errors,[]);
        } finally {dom.window.close();}
    }
});

const response = (data, status = 200, message = '') => new Response(JSON.stringify({success:status < 400,data,message}),{status,headers:{'Content-Type':'application/json'}});
const repairFixture = (id, status) => ({id,status,vehicleId:1,vehicle,mechanicName:'Mechanic <safe>',totalAmount:250,
    createdAt:'2026-09-28T01:00:00Z',startedAt:status !== 'draft' ? '2026-09-28T02:00:00Z' : null,
    completedAt:['completed','paid'].includes(status) ? '2026-09-28T03:00:00Z' : null,
    paidAt:status === 'paid' ? '2026-09-28T04:00:00Z' : null,
    items:[{id:10,taskName:'Change oil <safe>',partName:part.name,quantity:2,partPrice:100,laborPrice:50,totalPrice:250,isCompleted:['completed','paid'].includes(status)}]});

test('customer filters by vehicle and status, opens safe cost breakdown and prints only paid receipts', async () => {
    const rows = ['draft','working','completed','paid'].map((status,i) => repairFixture(i+1,status));
    const {dom,w,errors,calls} = await portal('customer',{'/repairs/my-repairs':rows,'/repairs/4':rows[3],'/repairs/2':rows[1]});
    try {
        const $ = id => w.document.getElementById(id);
        assert.equal($('statActiveRepairs').textContent,'2');
        assert.equal($('statOutstanding').textContent,w.formatCurrency(250));
        assert.equal($('statPaid').textContent,w.formatCurrency(250));
        w.document.querySelector('[data-vehicle="1"]').click();
        assert.equal($('repairVehicle').value,'1');
        assert.ok($('repairs-section').classList.contains('active-section'));
        $('repairStatus').value='paid'; $('repairStatus').dispatchEvent(new w.Event('input'));
        assert.equal(w.document.querySelectorAll('#repairsTable tbody tr').length,1);
        w.document.querySelector('#repairsTable [data-detail="4"]').click(); await delay(60);
        assert.ok($('repairDetailModal').open);
        assert.ok($('repairDetailContent').textContent.includes('Change oil <safe>'));
        assert.equal($('repairDetailContent').querySelector('safe'),null);
        const cells = [...$('repairDetailContent').querySelectorAll('tbody td')].map(td=>td.textContent);
        assert.deepEqual(cells.slice(1,5),['2',w.formatCurrency(100),w.formatCurrency(50),w.formatCurrency(250)]);
        let printed = false; w.print = () => { printed = true; };
        $('printReceipt').click(); assert.ok(printed);
        $('closeRepairDetail').click(); assert.equal($('repairDetailModal').open,false);
        $('repairStatus').value='working'; $('repairStatus').dispatchEvent(new w.Event('input'));
        w.document.querySelector('#repairsTable [data-detail="2"]').click(); await delay(60);
        assert.equal($('printReceipt'),null);
        assert.ok(calls.some(c=>c.path === '/repairs/4'));
        assert.deepEqual(errors,[]);
    } finally { dom.window.close(); }
});

test('booking forms persist the same admin request and show its reference', async () => {
    for (const role of ['customer','home']) {
        const {dom,w,calls,errors} = await portal(role,{'/bookings':{id:42}},{anonymous:role === 'home'});
        try {
            const form = w.document.getElementById('bookingForm');
            form.elements.customerName.value='Customer'; form.elements.phone.value='0901234567';
            form.elements.preferredDate.value='2099-01-01'; form.elements.service.value='repair';
            form.elements.note.value='30A12345 - kiểm tra phanh';
            form.dispatchEvent(new w.Event('submit',{cancelable:true}));
            form.dispatchEvent(new w.Event('submit',{cancelable:true}));
            await delay(60);
            const callsPost = calls.filter(c=>c.path==='/bookings' && c.method==='POST');
            assert.equal(callsPost.length,1);
            assert.deepEqual(callsPost[0].body,{customerName:'Customer',phone:'0901234567',preferredDate:'2099-01-01',service:'repair',note:'30A12345 - kiểm tra phanh'});
            assert.ok(w.document.getElementById('bookingResult').textContent.includes('#42'));
            assert.equal(form.querySelector('[type="submit"]').disabled,false);
            assert.ok(form.elements.preferredDate.min);
            assert.deepEqual(errors,[]);
        } finally { dom.window.close(); }
    }
});

test('mechanic starts assigned ticket, toggles checklist, completes, and filters stock', async () => {
    const ticket = repairFixture(7,'draft');
    const {dom,w,calls,errors} = await portal('mechanic',{
        '/repairs/my-tasks':()=>response([ticket]),
        '/repairs/7':options=>{ ticket.status=JSON.parse(options.body).status; return response(ticket); },
        '/repairs/7/items/10/toggle':options=>{ ticket.items[0].isCompleted=JSON.parse(options.body).isCompleted; return response(ticket); },
        '/inventory':[part,{...part,id:2,name:'Empty stock',quantity:0},{...part,id:3,name:'Low stock',quantity:2}],
    });
    try {
        const $ = id => w.document.getElementById(id);
        assert.equal($('statWaiting').textContent,'1');
        assert.equal(w.document.querySelector('[data-item]').disabled,true);
        w.document.querySelector('[data-start="7"]').click(); await delay(80);
        assert.equal(ticket.status,'working');
        assert.equal(w.document.querySelector('[data-complete]').disabled,true);
        const checkbox = w.document.querySelector('[data-item]');
        checkbox.checked=true; checkbox.dispatchEvent(new w.Event('change',{bubbles:true})); await delay(80);
        assert.equal(w.document.querySelector('[data-complete]').disabled,false);
        assert.equal(ticket.items[0].isCompleted,true);
        w.document.querySelector('[data-complete]').click(); await delay(80);
        assert.equal(ticket.status,'completed'); assert.equal($('statDone').textContent,'1');
        $('taskStatus').value='done'; $('taskStatus').dispatchEvent(new w.Event('input'));
        assert.equal(w.document.querySelector('[data-item]').disabled,true);
        $('taskSearch').value='missing'; $('taskSearch').dispatchEvent(new w.Event('input'));
        assert.equal(w.document.querySelectorAll('.task-card').length,0);
        $('stockFilter').value='empty'; $('stockFilter').dispatchEvent(new w.Event('input'));
        assert.ok($('inventoryTable').textContent.includes('Empty stock'));
        assert.ok(!$('inventoryTable').textContent.includes('Low stock'));
        assert.deepEqual(calls.filter(c=>c.method==='PUT').map(c=>c.body),[{status:'working'},{isCompleted:true},{status:'completed'}]);
        assert.deepEqual(errors,[]);
    } finally { dom.window.close(); }
});

test('mechanic restores server checklist on failed update', async () => {
    const ticket = repairFixture(7,'working');
    const {dom,w} = await portal('mechanic',{'/repairs/my-tasks':[ticket],'/repairs/7/items/10/toggle':()=>response(null,409,'Phiếu đã thay đổi')});
    try {
        const checkbox = w.document.querySelector('[data-item]'); checkbox.checked=true;
        checkbox.dispatchEvent(new w.Event('change',{bubbles:true})); await delay(80);
        assert.equal(w.document.querySelector('[data-item]').checked,false);
        assert.equal(w.document.querySelector('[data-item]').disabled,false);
        assert.ok(w.document.getElementById('toast-container').textContent.includes('Phiếu đã thay đổi'));
    } finally { dom.window.close(); }
});

test('public welcome page renders real prices and service selection', async () => {
    const {dom,w,errors} = await portal('home',{'/settings/wages':[{id:1,name:'Kiểm tra <safe>',price:123000}]},{anonymous:true});
    try {
        assert.ok(w.document.getElementById('servicePrices').textContent.includes('123.000'));
        assert.equal(w.document.querySelector('#servicePrices safe'),null);
        w.document.querySelector('[data-service="repair"]').click();
        assert.equal(w.document.getElementById('bookingService').value,'repair');
        w.document.querySelector('.public-menu-toggle').click();
        assert.equal(w.document.querySelector('.public-menu-toggle').getAttribute('aria-expanded'),'true');
        assert.deepEqual(errors,[]);
    } finally { dom.window.close(); }
});

test('auth supports register mode, password visibility and matching confirmation', async () => {
    const {dom,w,calls,errors} = await portal('login',{'/auth/register':{id:5}},{anonymous:true,query:'?mode=register'});
    try {
        const $ = id => w.document.getElementById(id);
        assert.ok($('registerForm').classList.contains('active'));
        w.document.querySelector('[data-password="registerPassword"]').click();
        assert.equal($('registerPassword').type,'text');
        $('registerFullName').value='Customer'; $('registerUsername').value='customer'; $('registerEmail').value='c@example.com';
        $('registerPassword').value='abcdef123'; $('registerPasswordConfirm').value='different';
        $('registerForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
        assert.ok($('messageBox').textContent.includes('không khớp'));
        assert.equal(calls.filter(c=>c.path==='/auth/register').length,0);
        $('registerPasswordConfirm').value='abcdef123';
        $('registerForm').dispatchEvent(new w.Event('submit',{cancelable:true})); await delay(2100);
        assert.ok($('loginForm').classList.contains('active'));
        assert.equal($('loginEmail').value,'c@example.com');
        assert.deepEqual(calls.find(c=>c.path==='/auth/register').body,{fullName:'Customer',username:'customer',email:'c@example.com',password:'abcdef123'});
        assert.deepEqual(errors,[]);
    } finally { dom.window.close(); }
});

test('login preserves backend rate-limit feedback and allows retry', async () => {
    const {dom,w} = await portal('login',{'/auth/login':()=>response(null,429,'Vui lòng thử lại sau 15 phút')},{anonymous:true});
    try {
        w.document.getElementById('loginEmail').value='c@example.com';
        w.document.getElementById('loginPassword').value='abcdef123';
        const form = w.document.getElementById('loginForm'); form.dispatchEvent(new w.Event('submit',{cancelable:true})); await delay(60);
        assert.ok(w.document.getElementById('messageBox').textContent.includes('15 phút'));
        assert.equal(form.querySelector('[type="submit"]').disabled,false);
    } finally { dom.window.close(); }
});

async function portal(role, overrides = {}, options = {}) {
    const dir = path.join(root, 'fe', role === 'home' ? '' : role);
    const dom = new JSDOM(fs.readFileSync(path.join(dir,'index.html'),'utf8'), {
        url:`http://localhost:8000/static/${role === 'home' ? '' : role + '/'}index.html${options.query || ''}`,runScripts:'outside-only',
    });
    await new Promise(resolve => dom.window.addEventListener('load',resolve,{once:true}));
    const w = dom.window, errors = [], calls = [];
    w.addEventListener('error', e => errors.push(e.error));
    w.console.error = (...args) => errors.push(args.map(String).join(' '));
    w.Headers = Headers;
    w.confirm = () => true;
    w.alert = () => {};
    w.setInterval = () => 0;
    w.HTMLElement.prototype.scrollIntoView = () => {};
    w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
    if (!options.anonymous) {
        w.localStorage.setItem('token','test');
        w.localStorage.setItem('user',JSON.stringify({id:1,role,fullName:'Test'}));
    }
    w.fetch = async (url, options={}) => {
        const pathname = new URL(url).pathname.replace('/api','');
        calls.push({path:pathname,method:options.method || 'GET',body:options.body && JSON.parse(options.body)});
        if (typeof overrides[pathname] === 'function') return overrides[pathname](options);
        const data = overrides[pathname] ?? {
            '/vehicles':[vehicle],'/vehicles/my-vehicles':[vehicle],'/repairs':[],
            '/repairs/my-repairs':[], '/repairs/my-tasks':[], '/inventory':[part],'/mechanics':[mechanic],
            '/auth/users':[{id:3,role:'customer',fullName:'Customer',email:'c@example.com'}],
            '/settings/brands':[{id:1,name:'Toyota'}], '/settings/wages':[{id:1,name:'Change oil',price:50}],
            '/settings/params':{max_cars_per_day:'30'}, '/bookings':[], '/reports/revenue':[],
        }[pathname] ?? {};
        return new Response(JSON.stringify({success:true,data}),{headers:{'Content-Type':'application/json'}});
    };
    for (const script of w.document.querySelectorAll('script[src]')) {
        if (/^https?:/.test(script.src) && !script.src.startsWith('http://localhost:8000')) continue;
        const src = script.getAttribute('src').split('?')[0];
        const file = src.startsWith('/static/') ? path.join(root,'fe',src.slice(8)) : path.resolve(dir,src);
        w.eval(fs.readFileSync(file,'utf8'));
    }
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    await delay(120);
    return {dom,w,calls,errors};
}

for (const role of ['admin','customer','mechanic']) {
    test(`${role} portal loads its actual HTML and scripts without runtime errors`, async () => {
        const {dom,w,errors,calls} = await portal(role);
        try {
            assert.deepEqual(errors,[]);
            assert.ok(w.document.querySelector('section.active-section'));
            assert.ok(calls.length > 0);
            assert.equal(w.Garage.base,'http://localhost:8000/api');
        } finally { dom.window.close(); }
    });
}

test('repair editor submits IDs and quantities; reception opens the correct section', async () => {
    const {dom,w,calls,errors} = await portal('admin');
    try {
        await w.openRepairModalWithVehicle(1);
        assert.ok(w.document.getElementById('repair-section').classList.contains('active-section'));
        w.document.getElementById('mechanicSelect').value='1';
        const task = w.document.getElementById('taskSelect');
        task.value='Change oil'; task.dispatchEvent(new w.Event('change'));
        const part = w.document.getElementById('partSelect');
        part.value='1'; part.dispatchEvent(new w.Event('change'));
        w.document.getElementById('partQuantity').value='3';
        w.document.getElementById('btnAddItem').click();
        w.document.getElementById('btnSaveTicket').click();
        await delay(100);
        const request = calls.find(c=>c.path==='/repairs' && c.method==='POST');
        assert.ok(request);
        assert.equal(request.body.vehicleId,1);
        assert.equal(request.body.mechanicId,1);
        assert.deepEqual(request.body.items,[{taskName:'Change oil',inventoryId:1,quantity:3,laborPrice:50}]);
        assert.deepEqual(errors,[]);
    } finally { dom.window.close(); }
});

test('existing stock uses atomic receipt endpoint instead of creating duplicate material', async () => {
    const {dom,w,calls} = await portal('admin');
    try {
        const select = w.document.getElementById('existingInventory');
        select.value='1'; select.dispatchEvent(new w.Event('change'));
        w.document.getElementById('invQuantity').value='5';
        w.document.getElementById('importForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
        await delay(100);
        const request = calls.find(c=>c.path==='/inventory/1/receive');
        assert.ok(request); assert.equal(request.body.quantity,5);
        assert.equal(w.document.querySelector('#inventoryTable script'),null);
        assert.ok(w.document.querySelector('#inventoryTable').textContent.includes('Oil <safe>'));
    } finally { dom.window.close(); }
});

test('admin sections have distinct controls and inventory search works', async () => {
    const {dom,w,errors} = await portal('admin');
    try {
        const ids=[...w.document.querySelectorAll('[id]')].map(el=>el.id);
        assert.equal(new Set(ids).size,ids.length);
        for(const section of ['repair','inventory','finance','report','hr']) {
            assert.equal(w.document.querySelectorAll('#'+section+'-section .metrics .metric').length,4);
        }
        const search=w.document.getElementById('inventorySearch');
        search.value='does not exist';search.dispatchEvent(new w.Event('input'));
        assert.match(w.document.getElementById('inventoryTable').textContent,/Không tìm thấy/);
        search.value='Oil';search.dispatchEvent(new w.Event('input'));
        assert.match(w.document.getElementById('inventoryTable').textContent,/Oil <safe>/);
        assert.deepEqual(errors,[]);
    } finally {dom.window.close();}
});

test('finance distinguishes pending amounts from received money and reopens old receipts', async () => {
    const repair={id:1,vehicle,mechanicId:1,mechanicName:'Mechanic',items:[],status:'completed',totalAmount:250};
    const paid={...repair,id:2,status:'paid',totalAmount:100,paidAt:new Date().toISOString()};
    const {dom,w,errors} = await portal('admin',{'/repairs':[repair,paid]});
    try {
        assert.equal(w.document.getElementById('financePending').textContent,'1');
        assert.equal(w.document.getElementById('financePaidCount').textContent,'1');
        assert.equal(w.document.getElementById('financeOutstanding').textContent,w.formatCurrency(250));
        assert.equal(w.document.getElementById('financeMonth').textContent,w.formatCurrency(100));
        w.document.querySelector('[data-invoice="2"]').click();
        assert.match(w.document.querySelector('.invoice-details').textContent,/Đã thu tiền/);
        assert.equal(w.document.getElementById('confirmPayment').disabled,true);
        assert.deepEqual(errors,[]);
    } finally {dom.window.close();}
});

test('reports render real aggregates and wage editor uses the selected record', async () => {
    const {dom,w,calls,errors} = await portal('admin',{'/reports/revenue':[
        {brand:'Toyota',count:2,revenue:200},{brand:'Honda',count:1,revenue:100},
    ]});
    try {
        assert.equal(w.document.getElementById('reportCount').textContent,'3');
        assert.equal(w.document.getElementById('reportRevenue').textContent,w.formatCurrency(300));
        assert.equal(w.document.getElementById('reportAverage').textContent,w.formatCurrency(100));
        assert.equal(w.document.getElementById('exportReport').disabled,false);
        w.document.querySelector('[data-kind="wages"]').click();
        const form=w.document.getElementById('catalogEdit');
        assert.equal(form.elements.name.value,'Change oil');
        form.elements.price.value='75';form.dispatchEvent(new w.Event('submit',{cancelable:true}));
        await delay(80);
        assert.ok(calls.some(c=>c.path==='/settings/wages/1' && c.method==='PUT' && c.body.price===75));
        assert.deepEqual(errors,[]);
    } finally {dom.window.close();}
});
