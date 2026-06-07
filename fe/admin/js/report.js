// Report Module Logic - Dynamic Data with Chart.js
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const reportMonthInput = document.getElementById('reportMonth');
    const btnViewReport = document.getElementById('btnViewReport');
    const reportTableBody = document.querySelector('#reportTable tbody');
    let revenueChartInstance = null;

    // Set default month to current month
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    if (reportMonthInput) {
        reportMonthInput.value = currentMonthStr;
    }

    async function fetchAndRenderReport() {
        if (!reportMonthInput || !reportTableBody) return;

        const selectedMonth = reportMonthInput.value; // Format: YYYY-MM
        if (!selectedMonth) {
            showToast('Vui lòng chọn tháng', 'error');
            return;
        }

        const [year, month] = selectedMonth.split('-');

        try {
            // Fetch all repairs (in a real production app, we would query by date from backend)
            const response = await fetch('http://localhost:3000/api/repairs', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const result = await response.json();
            if (!result.success) {
                showToast('Không thể tải dữ liệu báo cáo', 'error');
                return;
            }

            const repairs = result.data || [];
            
            // Filter completed/paid repairs in selected month
            const filteredRepairs = repairs.filter(r => {
                const isPaidOrCompleted = r.status === 'paid' || r.status === 'completed';
                if (!isPaidOrCompleted || !r.completedAt) return false;
                
                const repairDate = new Date(r.completedAt);
                return repairDate.getFullYear() == year && (repairDate.getMonth() + 1) == month;
            });

            // Aggregate data by carBrand
            const brandStats = {};
            let totalRevenueAll = 0;

            filteredRepairs.forEach(r => {
                const brand = r.vehicle?.carBrand || 'Khác';
                const amount = parseFloat(r.totalAmount) || 0;
                
                if (!brandStats[brand]) {
                    brandStats[brand] = { count: 0, revenue: 0 };
                }
                brandStats[brand].count += 1;
                brandStats[brand].revenue += amount;
                totalRevenueAll += amount;
            });

            // Sort by revenue descending
            const sortedBrands = Object.keys(brandStats).sort((a, b) => brandStats[b].revenue - brandStats[a].revenue);

            // Render Table
            reportTableBody.innerHTML = '';
            if (sortedBrands.length === 0) {
                reportTableBody.innerHTML = '<tr><td colspan="4" class="text-center">Không có dữ liệu trong tháng này</td></tr>';
            } else {
                sortedBrands.forEach(brand => {
                    const data = brandStats[brand];
                    const percentage = totalRevenueAll > 0 ? ((data.revenue / totalRevenueAll) * 100).toFixed(1) : 0;
                    
                    const row = `
                        <tr>
                            <td><strong>${brand}</strong></td>
                            <td>${data.count}</td>
                            <td class="text-green font-bold">${data.revenue.toLocaleString('vi-VN')}</td>
                            <td>
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <div style="flex:1; background:#e5e7eb; height:8px; border-radius:4px; overflow:hidden;">
                                        <div style="width:${percentage}%; background:var(--primary-color); height:100%;"></div>
                                    </div>
                                    <span style="font-size:0.85rem; color:#6b7280; width:40px;">${percentage}%</span>
                                </div>
                            </td>
                        </tr>
                    `;
                    reportTableBody.innerHTML += row;
                });
            }

            // Render Chart
            renderChart(sortedBrands, brandStats);

        } catch (error) {
            console.error('Report generation error:', error);
            showToast('Lỗi khi tạo báo cáo', 'error');
        }
    }

    function renderChart(brands, stats) {
        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;

        const labels = brands;
        const data = brands.map(b => stats[b].revenue);

        // Destroy previous chart if exists
        if (revenueChartInstance) {
            revenueChartInstance.destroy();
        }

        revenueChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Doanh thu (VNĐ)',
                    data: data,
                    backgroundColor: 'rgba(79, 70, 229, 0.8)',
                    borderColor: 'rgba(79, 70, 229, 1)',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toLocaleString('vi-VN') + ' VNĐ';
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                if (value >= 1000000) {
                                    return (value / 1000000) + 'M';
                                } else if (value >= 1000) {
                                    return (value / 1000) + 'k';
                                }
                                return value;
                            }
                        }
                    }
                }
            }
        });
    }

    if (btnViewReport) {
        btnViewReport.addEventListener('click', fetchAndRenderReport);
    }

    // Auto-load report when tab is opened
    const tabBtns = document.querySelectorAll('.sidebar-menu a');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = e.currentTarget.getAttribute('data-tab');
            if (tabId === 'report-section') {
                // Slight delay to ensure DOM is visible for Chart to render properly
                setTimeout(fetchAndRenderReport, 100);
            }
        });
    });

    // Also trigger initial load if the section is somehow active initially
    if (document.getElementById('report-section')?.classList.contains('active')) {
        fetchAndRenderReport();
    }
});
