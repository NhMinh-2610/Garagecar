// Module: HR (Human Resources) - Mechanic Management

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    
    // Elements
    const mechanicsTable = document.querySelector('#mechanicsTable tbody');
    const btnAddMechanic = document.getElementById('btnAddMechanic');
    const hrModal = document.getElementById('hrModal');
    const closeHrModal = document.getElementById('closeHrModal');
    const hrForm = document.getElementById('hrForm');

    // Only run if we are on the page with these elements
    if (!mechanicsTable) return;

    // Open Modal
    if (btnAddMechanic) {
        btnAddMechanic.addEventListener('click', () => {
            hrForm.reset();
            hrModal.style.display = 'block';
        });
    }

    // Close Modal
    if (closeHrModal) {
        closeHrModal.addEventListener('click', () => {
            hrModal.style.display = 'none';
        });
    }

    if (hrForm) {
        hrForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const payload = {
                fullName: document.getElementById('mechName').value,
                phone: document.getElementById('mechPhone').value,
                specialty: document.getElementById('mechSpecialty').value
            };

            try {
                const response = await fetch('http://localhost:3000/api/mechanics', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                if (result.success) {
                    showToast('Đã thêm thợ mới!', 'success');
                    hrModal.style.display = 'none';
                    loadMechanics();
                    // Dispatch event to update other modules if needed
                } else {
                    showToast(result.message, 'error');
                }
            } catch (error) {
                console.error('Add mechanic error:', error);
                showToast('Lỗi kết nối', 'error');
            }
        });
    }

    // Load Mechanics
    async function loadMechanics() {
        try {
            const response = await fetch('http://localhost:3000/api/mechanics', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            
            if (result.success) {
                mechanicsTable.innerHTML = '';
                result.data.forEach(mech => {
                    mechanicsTable.innerHTML += `
                        <tr>
                            <td>${mech.fullName}</td>
                            <td>${mech.phone || '---'}</td>
                            <td>${mech.specialty}</td>
                            <td><span class="badge badge-working">Đang làm việc</span></td>
                            <td>
                                <button class="btn btn-danger btn-sm" onclick="deleteMechanic(${mech.id})"><i class="fa-solid fa-trash"></i></button>
                            </td>
                        </tr>
                    `;
                });
            }
        } catch (error) {
            console.error('Load mechanics error:', error);
        }
    }

    // Delete Mechanic
    window.deleteMechanic = async function(id) {
        if(!confirm('Bạn có chắc muốn xóa thợ này?')) return;
        
        try {
            const response = await fetch(`http://localhost:3000/api/mechanics/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if(result.success) {
                showToast('Đã xóa thành công', 'success');
                loadMechanics();
            }
        } catch (e) {
            showToast('Lỗi kết nối', 'error');
        }
    };

    // Initial Load
    loadMechanics();
});
