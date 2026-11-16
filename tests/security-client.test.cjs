const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const test = require('node:test');
const {JSDOM} = require('jsdom');

function client(fetch) {
  const dom = new JSDOM('<main><input id="search"><table id="stock"><tbody></tbody></table></main>', {url:'http://localhost:8000/admin',runScripts:'outside-only'});
  Object.assign(dom.window, {fetch,Headers,Response});
  dom.window.eval(readFileSync(join(__dirname,'../fe/shared/core.js'),'utf8'));
  return dom;
}
const response = payload => new Response(JSON.stringify({success:true,...payload}), {headers:{'Content-Type':'application/json'}});
const settle = () => new Promise(resolve => setTimeout(resolve,30));

test('a lost stock or photo response reuses its operation key; a confirmed next operation gets a new key', async () => {
  for (const path of ['/inventory/1/receive','/workshop/tickets/1/items/2/evidence']) {
    const calls = []; let lost = true;
    const dom = client(async (url,options) => {
      calls.push(new Headers(options.headers).get('Idempotency-Key'));
      if (lost) {lost=false;throw new Error('response lost after commit');}
      return response({data:{id:1}});
    });
    try {
      const options = {method:'POST',body:{quantity:2}};
      await assert.rejects(dom.window.Garage.request(path,options));
      await dom.window.Garage.request(path,options);
      await dom.window.Garage.request(path,options);
      assert.ok(calls[0]); assert.equal(calls[0],calls[1]); assert.notEqual(calls[1],calls[2]);
    } finally {dom.window.close();}
  }
});

test('server pagination follows cursors, returns to the first page, and keeps whole-ledger totals', async () => {
  const calls=[];
  const dom=client(async url => {
    const cursor=new URL(url).searchParams.get('cursor'); calls.push(cursor);
    return response({data:[{id:cursor ? 900:1000}],hasMore:!cursor,nextCursor:cursor ? null:901,summary:{skuCount:1105}});
  });
  try {
    let rows;
    const load=async () => {rows=await dom.window.Garage.request('/inventory');};
    dom.window.Garage.pager('/inventory','#stock',load);
    await load();
    assert.equal(rows.summary.skuCount,1105);
    dom.window.document.querySelector('[data-page-next]').click(); await settle();
    assert.equal(rows[0].id,900); assert.equal(rows.summary.skuCount,1105);
    dom.window.document.querySelector('[data-page-prev]').click(); await settle();
    assert.equal(rows[0].id,1000); assert.deepEqual(calls,[null,'901',null]);
    dom.window.Garage.pager('/inventory','#stock',load);
    assert.equal(dom.window.document.querySelectorAll('.server-pagination').length,1);
  } finally {dom.window.close();}
});

test('a selector explicitly loading all pages retains its vehicle filter', async () => {
  const urls=[];
  const dom=client(async url => {
    const query=new URL(url);urls.push(query);
    return response(query.searchParams.has('cursor') ? {data:[{id:1}],hasMore:false} : {data:[{id:2}],hasMore:true,nextCursor:2});
  });
  try {
    const rows=await dom.window.Garage.requestAll('/repairs?vehicleId=8');
    assert.equal(rows.length,2);assert.equal(urls[1].searchParams.get('vehicleId'),'8');
  } finally {dom.window.close();}
});
