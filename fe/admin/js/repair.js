/* Repair editor and workflow; prices and transitions are validated by the API. */
document.addEventListener("DOMContentLoaded", async () => {
  if (!(await Garage.whenAllowed("workshop"))) return;
  const byId = (id) => document.getElementById(id);
  const modal = byId("repairModal");
  let items = [],
    inventory = [],
    tickets = [],
    editingId = null;
  const money = formatCurrency;
  const esc = Garage.escape;

  async function load(context = {}) {
    const canRender = Garage.refreshGuard(context);
    try {
      const data = await Garage.request("/repairs");
      if (!canRender()) return;
      tickets = data;
      for (const [id, status] of [
        ["repairWaiting", "draft"],
        ["repairWorking", "working"],
        ["repairCompleted", "completed"],
        ["repairPaid", "paid"],
      ]) {
        byId(id).textContent = tickets.filter((t) => t.status === status).length;
      }
      const search = (byId("globalRepairSearch").value || "").toLowerCase();
      const mechanic = byId("filterMechanic").value;
      const filtered = tickets.filter(
        (t) =>
          (!mechanic || String(t.mechanicId) === mechanic) &&
          [t.vehicle?.licensePlate, t.vehicle?.customerName, t.mechanicName]
            .join(" ")
            .toLowerCase()
            .includes(search),
      );
      for (const [table, statuses] of [
        ["waitingTable", ["draft"]],
        ["workingTable", ["working"]],
        ["completedTable", ["completed", "paid"]],
      ]) {
        const rows = filtered.filter((t) => statuses.includes(t.status));
        byId(table).querySelector("tbody").innerHTML =
          rows
            .map((t) => {
              const v = t.vehicle || {};
              const done = t.items.filter((i) => i.isCompleted).length;
              const names = t.items.map((i) => i.taskName).join(", ");
              if (t.status === "working") {
                return `<tr><td><button class="btn btn-sm" data-action="expand" data-id="${t.id}" aria-label="Xem hạng mục">☰</button></td>
                            <td>${esc(v.licensePlate)}</td><td>${esc(v.carBrand)}</td><td>${esc(t.mechanicName)}</td>
                            <td>${done}/${t.items.length} hạng mục</td><td>
                            <button class="btn btn-success btn-sm" data-action="complete" data-id="${t.id}" ${done !== t.items.length || !done ? "disabled" : ""}>Hoàn thành</button>
                            <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${t.id}">Phân công</button></td></tr>
                            <tr id="details-${t.id}" hidden><td colspan="6"><ul class="task-list">${t.items
                              .map(
                                (i) => `
                            <li class="task-item"><label><input type="checkbox" data-ticket="${t.id}" data-item="${i.id}" ${i.isCompleted ? "checked" : ""}>
                            ${esc(i.taskName)} — ${esc(i.partName)} × ${i.quantity}</label><span>${money(i.totalPrice)}</span></li>`,
                              )
                              .join("")}</ul></td></tr>`;
              }
              const actions =
                t.status === "draft"
                  ? `<button class="btn btn-success btn-sm" data-action="start" data-id="${t.id}" ${!t.mechanicId ? "disabled" : ""}>Bắt đầu</button>
                           <button class="btn btn-primary btn-sm" data-action="edit" data-id="${t.id}">Sửa</button>
                           <button class="btn btn-danger btn-sm" data-action="delete" data-id="${t.id}">Xóa</button>`
                  : `${!t.mechanicId ? `<button class="btn btn-secondary btn-sm" data-action="edit" data-id="${t.id}">Liên kết thợ</button>` : ""}<button class="btn btn-secondary btn-sm" data-action="view" data-id="${t.id}">Chi tiết</button><button class="btn btn-sm" data-evidence-ticket="${t.id}">Ảnh</button>${
                      t.status === "completed"
                        ? `<button class="btn btn-success btn-sm" data-action="pay" data-id="${t.id}">Thu tiền</button>`
                        : ""
                    }`;
              return `<tr><td>${esc(v.licensePlate)}</td><td>${esc(v.carBrand)}</td><td>${esc(names)}</td><td>${esc(t.mechanicName)}</td>
                        ${t.status !== "draft" ? `<td>${money(t.totalAmount)}</td>` : ""}
                        <td><span class="badge ${t.status === "paid" ? "badge-done" : "badge-pending"}">${{ draft: "Chờ sửa", completed: "Chờ thanh toán", paid: "Đã thanh toán" }[t.status]}</span></td><td>${actions}</td></tr>`;
            })
            .join("") ||
          `<tr><td colspan="${table === "completedTable" ? 7 : 6}" class="empty-state">Không có phiếu phù hợp</td></tr>`;
      }
    } catch (error) {
      showToast(error.message, "error");
    }
  }
  async function loadMechanics() {
    const mechanics = await Garage.request("/mechanics");
    const select = byId("filterMechanic");
    const value = select.value;
    select.replaceChildren(
      new Option("Tất cả thợ", ""),
      ...mechanics.map((m) => new Option(m.fullName, m.id)),
    );
    select.value = value;
    return mechanics;
  }
  function renderItems() {
    byId("repairItemsTable").querySelector("tbody").innerHTML = items
      .map(
        (i, index) => `<tr>
            <td>${esc(i.taskName)}</td><td>${esc(i.partName || "---")} × ${i.quantity}</td>
            <td>${money(i.quantity * i.partPrice + Number(i.laborPrice))}</td>
            <td><button class="btn btn-sm" data-remove="${index}" ${byId("btnAddItem").disabled ? "disabled" : ""}>Bỏ</button></td></tr>`,
      )
      .join("");
    byId("totalAmount").textContent = money(
      items.reduce((s, i) => s + i.quantity * i.partPrice + Number(i.laborPrice), 0),
    );
  }
  async function open(vehicleId = null, ticket = null) {
    try {
      const [vehicles, mechanics, parts, wages] = await Promise.all([
        Garage.request("/vehicles"),
        loadMechanics(),
        Garage.request("/inventory"),
        Garage.request("/settings/wages"),
      ]);
      editingId = ticket?.id || null;
      inventory = parts;
      items = ticket ? ticket.items.map((i) => ({ ...i })) : [];
      const selectable = vehicles.filter(
        (v) =>
          v.id === ticket?.vehicleId ||
          (v.status !== "delivered" && !v.repairTickets.some((t) => t.status !== "paid")),
      );
      byId("repairVehicleSelect").replaceChildren(
        new Option("-- Chọn xe --", ""),
        ...selectable.map((v) => new Option(v.licensePlate + " — " + v.customerName, v.id)),
      );
      byId("repairVehicleSelect").value = ticket?.vehicleId || vehicleId || "";
      byId("repairVehicleSelect").disabled = Boolean(ticket);
      byId("mechanicSelect").replaceChildren(
        new Option("-- Chưa phân công --", ""),
        ...mechanics.map((m) => new Option(m.fullName, m.id)),
      );
      byId("mechanicSelect").value = ticket?.mechanicId || "";
      byId("partSelect").replaceChildren(
        new Option("-- Không dùng vật tư --", ""),
        ...parts.map((p) => new Option(p.name + " (Tồn: " + p.quantity + ")", p.id)),
      );
      byId("taskSelect").replaceChildren(
        new Option("-- Chọn công việc --", ""),
        ...wages.map((w) => {
          const option = new Option(w.name, w.name);
          option.dataset.labor = w.price;
          return option;
        }),
        new Option("Khác", "Khác"),
      );
      byId("laborPrice").value = 0;
      byId("partPrice").value = 0;
      byId("partQuantity").value = 1;
      byId("customTask").value = "";
      byId("customTask").style.display = "none";
      byId("btnAddItem").disabled =
        Boolean(ticket && ticket.status !== "draft") ||
        Boolean(ticket?.items.some((i) => !i.inventoryId && i.partPrice > 0));
      document.querySelector("#repairModal .editor-panel").hidden = byId("btnAddItem").disabled;
      byId("btnSaveTicket").textContent = byId("btnAddItem").disabled
        ? "Lưu phân công"
        : ticket
          ? "Lưu thay đổi"
          : "Tạo phiếu";
      byId("btnSaveTicket").disabled = false;
      renderItems();
      modal.style.display = "block";
    } catch (error) {
      showToast(error.message, "error");
    }
  }
  window.openRepairModalWithVehicle = (vehicleId) => {
    document.querySelector('.nav-item[data-target="repair-section"]')?.click();
    return open(Number(vehicleId));
  };
  byId("btnNewRepair").onclick = () => open();
  byId("closeRepairModal").onclick = () => {
    modal.style.display = "none";
  };
  byId("taskSelect").onchange = (event) => {
    byId("customTask").style.display = event.target.value === "Khác" ? "block" : "none";
    byId("laborPrice").readOnly = event.target.value !== "Khác";
    byId("laborPrice").value = event.target.selectedOptions[0]?.dataset.labor || 0;
  };
  byId("partSelect").onchange = (event) => {
    byId("partPrice").value =
      inventory.find((p) => p.id === Number(event.target.value))?.unitPrice || 0;
  };
  byId("btnAddItem").onclick = () => {
    const taskName =
      byId("taskSelect").value === "Khác"
        ? byId("customTask").value.trim()
        : byId("taskSelect").value;
    const part = inventory.find((p) => p.id === Number(byId("partSelect").value));
    const quantity = Number(byId("partQuantity").value);
    const laborPrice = Number(byId("laborPrice").value);
    if (
      !taskName ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      !Number.isFinite(laborPrice) ||
      laborPrice < 0
    ) {
      showToast("Nhập công việc, số lượng nguyên dương và tiền công hợp lệ.", "warning");
      return;
    }
    items.push({
      taskName,
      inventoryId: part?.id || null,
      partName: part?.name || "---",
      partPrice: Number(part?.unitPrice || 0),
      laborPrice,
      quantity,
    });
    renderItems();
  };
  byId("repairItemsTable").onclick = (event) => {
    const button = event.target.closest("[data-remove]");
    if (button) {
      items.splice(Number(button.dataset.remove), 1);
      renderItems();
    }
  };
  byId("btnSaveTicket").onclick = async () => {
    const button = byId("btnSaveTicket");
    if (!byId("repairVehicleSelect").value || !items.length) {
      showToast("Chọn xe và thêm ít nhất một hạng mục.", "warning");
      return;
    }
    button.disabled = true;
    const payload = { mechanicId: Number(byId("mechanicSelect").value) || null };
    if (!editingId) payload.vehicleId = Number(byId("repairVehicleSelect").value);
    if (!byId("btnAddItem").disabled)
      payload.items = items.map(({ taskName, inventoryId, quantity, laborPrice }) => ({
        taskName,
        inventoryId,
        quantity,
        laborPrice,
      }));
    try {
      await Garage.request("/repairs" + (editingId ? "/" + editingId : ""), {
        method: editingId ? "PUT" : "POST",
        body: payload,
      });
      modal.style.display = "none";
      showToast("Đã lưu phiếu và cập nhật tồn kho.", "success");
      await load();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      button.disabled = false;
    }
  };
  byId("repair-section").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const ticket = tickets.find((t) => t.id === Number(button.dataset.id));
    if (!ticket) return;
    const action = button.dataset.action;
    if (action === "expand") {
      const detail = byId("details-" + ticket.id);
      detail.hidden = !detail.hidden;
      return;
    }
    if (action === "edit") {
      await open(ticket.vehicleId, ticket);
      return;
    }
    if (action === "pay") {
      await window.openPaymentForTicket(ticket.id);
      return;
    }
    if (action === "view") {
      const detail = await Garage.request("/repairs/" + ticket.id);
      let dialog = byId("ticketDetailDialog");
      if (!dialog) {
        dialog = document.createElement("dialog");
        dialog.id = "ticketDetailDialog";
        document.body.append(dialog);
      }
      dialog.innerHTML = `<h3>Phiếu sửa #${detail.id} · ${esc(detail.vehicle.licensePlate)}</h3>
                <p class="muted">${esc(detail.vehicle.customerName)} · ${esc(detail.mechanicName)}</p>
                <div class="table-responsive"><table><thead><tr><th>Hạng mục</th><th>Vật tư</th><th>Số lượng</th><th>Tiền công</th><th>Thành tiền</th></tr></thead>
                <tbody>${detail.items.map((i) => `<tr><td>${esc(i.taskName)}</td><td>${esc(i.partName)}</td><td>${i.quantity}</td><td>${money(i.laborPrice)}</td><td>${money(i.totalPrice)}</td></tr>`).join("")}</tbody></table></div>
                <div class="summary-row">Tổng tiền<strong>${money(detail.totalAmount)}</strong></div><form method="dialog"><button class="btn btn-secondary">Đóng</button></form>`;
      dialog.showModal();
      return;
    }
    const prompts = {
      start: "Bắt đầu sửa chữa?",
      complete: "Xác nhận hoàn thành tất cả hạng mục?",
      delete: "Xóa phiếu chờ sửa và hoàn vật tư về kho?",
    };
    if (!confirm(prompts[action])) return;
    button.disabled = true;
    try {
      await Garage.request(
        "/repairs/" + ticket.id,
        action === "delete"
          ? { method: "DELETE" }
          : {
              method: "PUT",
              body: { status: { start: "working", complete: "completed" }[action] },
            },
      );
      showToast("Đã cập nhật phiếu.", "success");
      await load();
    } catch (error) {
      showToast(error.message, "error");
      button.disabled = false;
    }
  });
  byId("repair-section").addEventListener("change", async (event) => {
    const input = event.target.closest("[data-item]");
    if (!input) return;
    if (input.checked) {
      input.checked = false;
      const ticket = tickets.find((t) => t.id === Number(input.dataset.ticket));
      return Garage.openEvidence(
        ticket.id,
        ticket.items.find((i) => i.id === Number(input.dataset.item)),
        true,
        load,
      );
    }
    input.disabled = true;
    try {
      await Garage.request(`/repairs/${input.dataset.ticket}/items/${input.dataset.item}/toggle`, {
        method: "PUT",
        body: { isCompleted: input.checked },
      });
      await load();
    } catch (error) {
      input.checked = !input.checked;
      showToast(error.message, "error");
    } finally {
      input.disabled = false;
    }
  });
  window.switchRepairTab = (name) => {
    document
      .querySelectorAll(".repair-tab")
      .forEach((b) =>
        b.classList.toggle("active", b.getAttribute("onclick")?.includes("'" + name + "'")),
      );
    for (const tab of ["waiting", "working", "completed"]) {
      const el = byId("tab" + tab[0].toUpperCase() + tab.slice(1));
      el.style.display = tab === name ? "block" : "none";
      el.classList.toggle("active", tab === name);
    }
  };
  byId("globalRepairSearch").oninput = load;
  byId("filterMechanic").onchange = load;
  Garage.subscribe(load);
  loadMechanics().catch((error) => showToast(error.message, "error"));
  load();
});
