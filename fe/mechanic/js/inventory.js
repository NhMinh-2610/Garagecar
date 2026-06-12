// Mechanic Portal - Inventory Module (Read-only)
document.addEventListener('DOMContentLoaded', () => {
    loadInventory();

    // Search functionality
    const searchInput = document.getElementById('inventorySearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterInventory(e.target.value.trim().toLowerCase());
        });
    }
});

let inventoryData = [];

async function loadInventory() {
    try {
        const response = await fetch(`${API_URL}/inventory`, { headers: getAuthHeaders() });
        const result = await response.json();

        const tbody = document.querySelector('#inventoryTable tbody');

        if (!result.success || !result.data || result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Kho trống</td></tr>';
            return;
        }

        inventoryData = result.data;
        renderInventory(inventoryData);

    } catch (error) {
        console.error('Error loading inventory:', error);
        showToast('Lỗi tải kho vật tư', 'error');
    }
}

function renderInventory(items) {
    const tbody = document.querySelector('#inventoryTable tbody');

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Không tìm thấy vật tư</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(item => {
        const qtyClass = item.quantity <= 5 ? 'color: #ef4444; font-weight: 700;' : '';
        return `
            <tr>
                <td><strong>${item.name}</strong></td>
                <td style="${qtyClass}">${item.quantity} ${item.quantity <= 5 ? '⚠️' : ''}</td>
                <td>${formatCurrency(item.unitPrice)}</td>
            </tr>
        `;
    }).join('');
}

function filterInventory(query) {
    if (!query) {
        renderInventory(inventoryData);
        return;
    }
    const filtered = inventoryData.filter(item => item.name.toLowerCase().includes(query));
    renderInventory(filtered);
}
