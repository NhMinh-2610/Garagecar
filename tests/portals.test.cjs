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

async function portal(role) {
    const dir = path.join(root, 'fe', role);
    const dom = new JSDOM(fs.readFileSync(path.join(dir,'index.html'),'utf8'), {
        url:`http://localhost:8000/static/${role}/index.html`,runScripts:'outside-only',
    });
    await new Promise(resolve => dom.window.addEventListener('load',resolve,{once:true}));
    const w = dom.window, errors = [], calls = [];
    w.addEventListener('error', e => errors.push(e.error));
    w.console.error = (...args) => errors.push(args.map(String).join(' '));
    w.Headers = Headers;
    w.confirm = () => true;
    w.alert = () => {};
    w.setInterval = () => 0;
    w.localStorage.setItem('token','test');
    w.localStorage.setItem('user',JSON.stringify({id:1,role,fullName:'Test'}));
    w.fetch = async (url, options={}) => {
        const pathname = new URL(url).pathname.replace('/api','');
        calls.push({path:pathname,method:options.method || 'GET',body:options.body && JSON.parse(options.body)});
        const data = {
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
        const file = path.resolve(dir,script.getAttribute('src').split('?')[0]);
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
