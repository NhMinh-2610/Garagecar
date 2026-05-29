// Finance Module - Payment Processing
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const paymentSelect = document.querySelector('#finance-section select');
    const confirmBtn = document.querySelector('#finance-section .btn-success');

    // Load completed repairs
    async function loadCompletedRepairs() {
        try {
            const response = await fetch('http://localhost:3000/api/repairs', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const result = await response.json();
            if (result.success && paymentSelect) {
                paymentSelect.innerHTML = '<option value="">-- Chọn phiếu sửa --</option>';
                
                result.data.forEach(repair => {
                    if (repair.status === 'completed' && repair.vehicle) {
                        const option = document.createElement('option');
                        option.value = repair.id;
                        option.textContent = `${repair.vehicle.licensePlate} - ${repair.vehicle.customerName} (${repair.totalAmount.toLocaleString('vi-VN')}đ)`;
                        option.setAttribute('data-customer', repair.vehicle.customerName);
                        option.setAttribute('data-plate', repair.vehicle.licensePlate);
                        option.setAttribute('data-amount', repair.totalAmount);
                        paymentSelect.appendChild(option);
                    }
                });
            }
        } catch (error) {
            console.error('Load repairs error:', error);
        }
    }

    loadCompletedRepairs();

    // Handle selection change
    if (paymentSelect) {
        paymentSelect.addEventListener('change', (e) => {
            const selected = e.target.selectedOptions[0];
            if (!selected || !selected.value) return;

            const customer = selected.getAttribute('data-customer');
            const plate = selected.getAttribute('data-plate');
            const amount = selected.getAttribute('data-amount');
            const today = new Date().toLocaleDateString('vi-VN');

            // Update invoice preview
            const invoiceBox = document.querySelector('.invoice-box .invoice-details');
            if (invoiceBox) {
                invoiceBox.innerHTML = `
                    <p><strong>Khách hàng:</strong> ${customer}</p>
                    <p><strong>Biển số:</strong> ${plate}</p>
                    <p><strong>Ngày:</strong> ${today}</p>
                    <p><strong>Tổng tiền:</strong> ${parseInt(amount).toLocaleString('vi-VN')} VNĐ</p>
                `;
            }
        });
    }

    // Handle confirm payment
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            const repairId = paymentSelect?.value;
            if (!repairId) {
                alert('Vui lòng chọn phiếu sửa chữa!');
                return;
            }

            if (!confirm('Xác nhận đã thu tiền?')) return;

            try {
                // Update repair status to paid
                const response = await fetch(`http://localhost:3000/api/repairs/${repairId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ status: 'paid' })
                });

                const result = await response.json();
                if (result.success) {
                    alert('Đã xác nhận thanh toán!');
                    
                    // Print invoice
                    window.print();
                    
                    // Reload list
                    loadCompletedRepairs();
                } else {
                    alert('Lỗi: ' + result.message);
                }
            } catch (error) {
                console.error('Payment error:', error);
                alert('Không thể xác nhận thanh toán');
            }
        });
    }
});
