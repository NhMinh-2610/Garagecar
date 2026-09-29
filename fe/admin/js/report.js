document.addEventListener('DOMContentLoaded', () => {
    const byId = id => document.getElementById(id);
    const now = new Date();
    byId('reportMonth').value = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    let rows = [], chart = null, loadedMonth = '';
    async function load() {
        const month = byId('reportMonth').value;
        if (!month) { showToast('Vui lòng chọn tháng báo cáo.','warning'); return; }
        try {
            rows = await Garage.request('/reports/revenue?month='+encodeURIComponent(month));
            rows.sort((a,b) => b.revenue-a.revenue);
            loadedMonth = month;
            const total = rows.reduce((s,r) => s+r.revenue,0);
            const count = rows.reduce((s,r) => s+r.count,0);
            byId('reportRevenue').textContent = formatCurrency(total);
            byId('reportCount').textContent = count;
            byId('reportAverage').textContent = formatCurrency(count ? total/count : 0);
            byId('reportBrands').textContent = rows.length;
            byId('reportPeriod').textContent = 'Tháng '+month.split('-').reverse().join('/');
            byId('reportTotal').textContent = 'Tổng cộng: '+count+' phiếu · '+formatCurrency(total);
            byId('exportReport').disabled = rows.length === 0;
            byId('reportTable').querySelector('tbody').innerHTML = rows.map(r => `<tr><td><strong>${Garage.escape(r.brand)}</strong></td>
                <td>${r.count}</td><td>${formatCurrency(r.revenue)}</td><td>${total ? (r.revenue/total*100).toFixed(1) : '0.0'}%</td></tr>`).join('')
                || '<tr><td colspan="4" class="empty-state">Chưa có phiếu thanh toán trong tháng này.</td></tr>';
            byId('revenueBreakdown').innerHTML = rows.map(r => `<div class="summary-row"><span>${Garage.escape(r.brand)}</span><strong>${formatCurrency(r.revenue)}</strong></div>
                <div class="breakdown-bar"><span style="width:${total ? r.revenue/total*100 : 0}%"></span></div>`).join('') || '<p class="empty-state">Chưa có dữ liệu để phân tích.</p>';
            if (chart) { chart.destroy(); chart=null; }
            byId('chartEmpty').hidden = rows.length > 0 && typeof Chart !== 'undefined';
            byId('chartEmpty').textContent = rows.length ? 'Xem số liệu chi tiết ở bảng bên dưới.' : 'Chưa có doanh thu trong kỳ này.';
            byId('revenueChart').hidden = !rows.length || typeof Chart === 'undefined';
            if (rows.length && typeof Chart !== 'undefined') {
                chart = new Chart(byId('revenueChart'),{type:'bar',data:{labels:rows.map(r=>r.brand),datasets:[{data:rows.map(r=>r.revenue),backgroundColor:'#7771df',borderRadius:6,maxBarThickness:56}]},
                    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>formatCurrency(c.parsed.y)}}},
                        scales:{y:{beginAtZero:true,ticks:{callback:v=>new Intl.NumberFormat('vi-VN',{notation:'compact'}).format(v)},grid:{color:'#edf0f6'}},x:{grid:{display:false}}}}});
            }
        } catch(error) { showToast(error.message,'error'); }
    }
    byId('btnViewReport').onclick = load;
    byId('reportMonth').onchange = load;
    byId('exportReport').onclick = () => {
        if (!rows.length) return;
        const safe = value => {
            let text=String(value);
            if (typeof value==='string' && /^[=+@-]/.test(text)) text="'"+text;
            return '"'+text.replaceAll('"','""')+'"';
        };
        const content = [['Tháng','Hiệu xe','Số phiếu đã thu','Doanh thu VND'],...rows.map(r=>[loadedMonth,r.brand,r.count,r.revenue])].map(row=>row.map(safe).join(',')).join('\r\n');
        const url=URL.createObjectURL(new Blob(['\uFEFF'+content],{type:'text/csv;charset=utf-8;'}));
        const link=document.createElement('a'); link.href=url; link.download='doanh-thu-'+loadedMonth+'.csv'; link.click();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    Garage.subscribe(load); load();
});
