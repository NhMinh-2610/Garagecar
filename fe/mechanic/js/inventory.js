(() => {
  let inventory = [];
  const $ = (id) => document.getElementById(id);
  async function load(context = {}) {
    const canRender = Garage.refreshGuard(context);
    try {
      const data = await Garage.request("/inventory");
      if (!canRender()) return;
      inventory = data;
      render();
    } catch (error) {
      $("stockSummary").textContent = `${error.message}. Nhấn Làm mới để thử lại.`;
      if (!inventory.length)
        document.querySelector("#inventoryTable tbody").innerHTML =
          '<tr><td colspan="4" class="empty-state">Chưa tải được dữ liệu.</td></tr>';
    }
  }
  function render() {
    const query = $("inventorySearch").value.trim().toLocaleLowerCase("vi"),
      filter = $("stockFilter").value;
    const items = inventory.filter(
      (i) =>
        i.name.toLocaleLowerCase("vi").includes(query) &&
        (!filter ||
          (filter === "available"
            ? i.quantity > 0
            : filter === "low"
              ? i.quantity > 0 && i.quantity <= 5
              : i.quantity === 0)),
    );
    $("stockSummary").textContent =
      `${items.length} / ${inventory.length} mã vật tư · ${inventory.filter((i) => i.quantity === 0).length} hết hàng · ${inventory.filter((i) => i.quantity > 0 && i.quantity <= 5).length} sắp hết`;
    document.querySelector("#inventoryTable tbody").innerHTML =
      items
        .map(
          (i) =>
            `<tr><td><strong>${Garage.escape(i.name)}</strong></td><td>${i.quantity}</td><td>${formatCurrency(i.unitPrice)}</td><td><span class="badge badge-${i.quantity === 0 ? "inactive" : i.quantity <= 5 ? "warning" : "done"}">${i.quantity === 0 ? "Hết hàng" : i.quantity <= 5 ? "Sắp hết" : "Còn hàng"}</span></td></tr>`,
        )
        .join("") || '<tr><td colspan="4" class="empty-state">Không có vật tư phù hợp.</td></tr>';
  }
  document.addEventListener("DOMContentLoaded", async () => {
    if (!(await Garage.whenAllowed("workshop"))) return;
    ["inventorySearch", "stockFilter"].forEach((id) => $(id).addEventListener("input", render));
    $("refreshTasks").addEventListener("click", load);
    load();
    Garage.subscribe(load);
  });
})();
