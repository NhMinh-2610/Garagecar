// Inventory Module - Full Functionality
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Inventory Import
    const importForm = document.getElementById('importForm');
    if(importForm) {
        importForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(importForm);
            const inventoryData = {
                name: formData.get('name') || importForm.querySelector('input[type="text"]').value,
                quantity: parseInt(formData.get('quantity')) || parseInt(importForm.querySelectorAll('input[type="number"]')[0].value),
                unitPrice: parseFloat(formData.get('unitPrice')) || parseFloat(importForm.querySelectorAll('input[type="number"]')[1].value)
            };

            try {
                const response = await fetch('http://localhost:3000/api/inventory', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(inventoryData)
                });

                const result = await response.json();
                if (result.success) {
                    alert('Đã nhập kho thành công!');
                    importForm.reset();
                    loadInventoryList();
                } else {
                    alert('Lỗi: ' + result.message);
                }
            } catch (error) {
                console.error('Import error:', error);
                alert('Không thể nhập kho');
            }
        });
    }

    // Load inventory list
    async function loadInventoryList() {
        try {
            const response = await fetch('http://localhost:3000/api/inventory', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const result = await response.json();
            if (result.success) {
                const table = document.querySelector('#inv-import table tbody');
                if (table) {
                    table.innerHTML = '';
                    result.data.forEach(item => {
                        const row = `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.quantity}</td>
                                <td>${new Date(item.createdAt).toLocaleDateString('vi-VN')}</td>
                            </tr>
                        `;
                        table.innerHTML += row;
                    });
                }
            }
        } catch (error) {
            console.error('Load inventory error:', error);
        }
    }

    loadInventoryList();

    // Settings (Brands/Labor) - Delete handlers (Mock)
    document.querySelectorAll('.list-group .text-red').forEach(btn => {
        btn.addEventListener('click', function() {
           if(confirm('Xóa mục này?')) {
               this.parentElement.remove();
           } 
        });
    });
});
