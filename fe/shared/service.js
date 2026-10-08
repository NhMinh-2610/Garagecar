/* Approved quotation workflow; prices come from the backend. */
document.addEventListener("DOMContentLoaded", async () => {
  if (
    Garage.whenAllowed &&
    JSON.parse(localStorage.getItem("user") || "{}").role !== "customer" &&
    !(await Garage.whenAllowed("workshop"))
  )
    return;
  const host = document.getElementById("serviceWorkspace");
  if (!host) return;
  const user = JSON.parse(localStorage.getItem("user") || "{}"),
    esc = Garage.escape,
    advisor = ["admin", "advisor"].includes(user.role);
  const statuses = {
    intake: "Kiểm tra đầu vào",
    diagnosis: "Kiểm tra kỹ",
    awaiting_approval: "Chờ duyệt chính thức",
    ready: "Sẵn sàng vào xưởng",
    in_workshop: "Đang trong xưởng",
    qc_passed: "Đã nghiệm thu",
    closed: "Đã kết thúc",
  };
  let visits = [],
    vehicles = [],
    mechanics = [],
    stock = [],
    parts = [];
  const money = (v) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(v) || 0);
  function dialog(title, body, save) {
    const d = document.createElement("dialog");
    d.className = "care-dialog";
    d.innerHTML = `<div class="card-heading"><h3>${esc(title)}</h3><button class="btn-icon" data-close aria-label="Đóng">×</button></div><form>${body}<p class="care-error text-red" role="alert"></p><div class="form-actions"><button type="submit" class="btn btn-primary">Lưu</button></div></form>`;
    document.body.append(d);
    d.querySelector("[data-close]").onclick = () => d.close();
    d.onclose = () => d.remove();
    d.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("[type=submit]");
      if (btn.disabled || !e.target.reportValidity()) return;
      btn.disabled = true;
      try {
        await save(e.target);
        d.close();
        await load();
      } catch (error) {
        d.querySelector(".care-error").textContent = error.message;
      } finally {
        btn.disabled = false;
      }
    };
    d.showModal();
    return d;
  }
  const mechanicOptions = () =>
    mechanics
      .map((m) => `<option value="${m.id}">${esc(m.fullName)}</option>`)
      .join("");
  function render() {
    host.innerHTML = `<div class="section-heading"><div><p class="eyebrow">TIẾP NHẬN → XƯỞNG → NGHIỆM THU</p><h1>${advisor ? "Cố vấn & Báo giá" : user.role === "mechanic" ? "Kiểm tra kỹ được giao" : "Báo giá & Xác nhận"}</h1><p class="section-description">Báo giá sơ bộ trước khi kiểm tra kỹ; duyệt bản chính thức trước khi xuất vật tư.</p></div>${advisor ? '<button class="btn btn-primary" data-service="intake">＋ Kiểm tra đầu vào</button>' : ""}</div><div class="visit-grid">${
      visits
        .map((v) => {
          const latest = [...v.quotes]
            .reverse()
            .find((q) =>
              ["pending", "approved", "converted"].includes(q.status),
            );
          return `<article class="visit-card"><div class="card-heading"><h3>#${v.id} · ${esc(v.licensePlate)}</h3><span class="badge">${esc(statuses[v.status] || v.status)}</span></div><p><strong>Nhu cầu:</strong> ${esc(v.concern)}</p><details><summary>Kiểm tra & Chẩn đoán</summary><p><strong>Đầu vào:</strong> ${esc(v.initialInspection)}</p><p><strong>Kiểm tra kỹ:</strong> ${esc(v.diagnosis || "Chưa ghi nhận")}</p>${v.qcAt ? `<p>Đã nghiệm thu · ${esc(v.qc.roadTestOrReason)} · ${esc(v.qc.note)}</p>` : ""}</details>
            ${latest ? `<div class="notice"><strong>${latest.stage === "final" ? "Chính thức" : "Sơ bộ"} · phiên bản ${latest.revision}</strong><p>${money(latest.totalAmount)} · ${esc({ pending: "Chờ xác nhận", approved: "Đã duyệt", converted: "Đã chuyển phiếu" }[latest.status])}</p><details><summary>Chi tiết công việc và chi phí</summary>${quoteTable(latest)}<p>${esc(latest.decisionNote || "")}</p></details></div>` : '<p class="panel-note">Chưa có báo giá.</p>'}
            <div class="form-actions">
            ${advisor && !["in_workshop", "qc_passed", "closed"].includes(v.status) ? `<button class="btn btn-sm" data-service="assignment" data-id="${v.id}">Phân công kiểm tra kỹ</button>` : ""}
            ${advisor && v.status === "intake" ? `<button class="btn btn-sm" data-service="quote" data-stage="preliminary" data-id="${v.id}">Lập báo giá sơ bộ</button>` : ""}
            ${(advisor || user.role === "mechanic") && ["diagnosis", "awaiting_approval", "ready"].includes(v.status) ? `<button class="btn btn-sm" data-service="diagnosis" data-id="${v.id}">Ghi kiểm tra kỹ</button>` : ""}
            ${advisor && v.diagnosis && ["diagnosis", "awaiting_approval", "ready"].includes(v.status) ? `<button class="btn btn-sm" data-service="quote" data-stage="final" data-id="${v.id}">Lập báo giá chính thức</button>` : ""}
            ${(advisor || user.role === "customer") && latest?.status === "pending" ? `<button class="btn btn-primary btn-sm" data-service="decision" data-approved="true" data-id="${latest.id}">Xác nhận ${money(latest.totalAmount)}</button><button class="btn btn-sm" data-service="decision" data-approved="false" data-id="${latest.id}">Yêu cầu điều chỉnh</button>` : ""}
            ${advisor && latest?.status === "approved" && latest.stage === "final" ? `<button class="btn btn-primary btn-sm" data-service="convert" data-id="${latest.id}">Phân công & Chuyển vào xưởng</button>` : ""}
            ${advisor && v.ticketStatus === "completed" && !v.qcAt ? `<button class="btn btn-primary btn-sm" data-service="qc" data-id="${v.id}">Nghiệm thu</button>` : ""}
            ${v.ticketId && user.role !== "accountant" ? `<button class="btn btn-sm" data-evidence-ticket="${v.ticketId}">Xem ảnh công việc</button>` : ""}
            ${v.ticketId ? `<a class="btn btn-sm" href="${user.role === "mechanic" ? "/mechanic" : user.role === "customer" ? "/customer" : user.role === "admin" ? "/admin" : "/advisor"}">Phiếu #${v.ticketId}</a>` : ""}
            ${advisor && v.qcAt && v.ticketStatus === "completed" ? '<button class="btn btn-sm" data-service="finance">Đến Thu tiền</button>' : ""}
            ${advisor && !v.ticketId && v.status !== "closed" ? `<button class="btn btn-sm" data-service="cancel" data-id="${v.id}">Kết thúc lượt chưa sửa</button>` : ""}</div>
            <details><summary>Lịch sử ${v.quotes.length} phiên bản báo giá</summary>${v.quotes.map((q) => `<p>Phiên bản ${q.revision} · ${q.stage === "final" ? "Chính thức" : "Sơ bộ"} · ${money(q.totalAmount)} · ${esc(q.status)}</p>${quoteTable(q)}`).join("")}</details></article>`;
        })
        .join("") ||
      '<div class="card empty-state">Chưa có lượt dịch vụ phù hợp.</div>'
    }</div>`;
  }
  function quoteTable(q) {
    return `<div class="table-responsive"><table><thead><tr><th>Công việc / Vật tư</th><th>SL</th><th>Đơn giá</th><th>Tiền công</th><th>Thành tiền</th></tr></thead><tbody>${q.items.map((r) => `<tr><td>${esc(r.taskName)}<small>${esc(r.partName)}</small></td><td>${r.quantity}</td><td>${money(r.partPrice)}</td><td>${money(r.laborPrice)}</td><td>${money(r.totalPrice)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  async function load(context = {}) {
    const guard = Garage.refreshGuard(context);
    try {
      const values = await Promise.all([
        Garage.request("/service/visits"),
        advisor ? Garage.request("/service/resources") : Promise.resolve({}),
        advisor
          ? Garage.request("/maintenance/catalog")
          : Promise.resolve(null),
      ]);
      if (!guard()) return;
      visits = values[0];
      vehicles = values[1]?.vehicles || [];
      mechanics = values[1]?.mechanics || [];
      stock = values[1]?.inventory || [];
      parts = values[2]?.components || [];
      render();
    } catch (e) {
      if (!context.background)
        host.innerHTML = `<p class="inline-message error">${esc(e.message)}</p><button class="btn" data-service="retry">Thử lại</button>`;
    }
  }
  function quoteEditor(v, stage) {
    let lines = [];
    const d = dialog(
      "Báo giá " +
        (stage === "final" ? "chính thức" : "sơ bộ") +
        " · " +
        v.licensePlate,
      `<p class="notice">Kiểm tra mã phụ tùng theo VIN trước khi chọn. Vật tư chưa được xuất kho; giá được lấy từ dữ liệu kho khi lưu. Tiền công tính một lần cho mỗi dòng.</p><div class="form-grid"><label class="form-group">Bộ phận để gợi ý công việc<select id="quoteComponent"><option value="">Chọn bộ phận</option>${parts.map((p) => `<option value="${p.code}">${esc(p.name)}</option>`).join("")}</select></label><label class="form-group">Công việc<input id="quoteTask" maxlength="255"></label><label class="form-group">Vật tư đã xác nhận tương thích<select id="quotePart"><option value="">Không dùng vật tư</option>${stock.map((p) => `<option value="${p.id}">${esc(p.name)} · ${money(p.unitPrice)} · còn ${p.quantity}</option>`).join("")}</select></label><label class="form-group">Số lượng<input id="quoteQuantity" type="number" min="1" max="100000" value="1"></label><label class="form-group">Tiền công / dòng<input id="quoteLabor" type="number" min="0" max="999999999999" step="0.01" value="0"></label></div><p id="quoteComponentHelp" class="field-help"></p><button type="button" class="btn btn-sm" id="quoteAdd">＋ Thêm dòng</button><div id="quoteLines"></div>`,
      async () => {
        if (!lines.length) throw Error("Thêm ít nhất một công việc.");
        await Garage.request("/service/visits/" + v.id + "/quotes", {
          method: "POST",
          body: {
            stage,
            items: lines.map(
              ({ taskName, inventoryId, quantity, laborPrice }) => ({
                taskName,
                inventoryId,
                quantity,
                laborPrice,
              }),
            ),
          },
        });
      },
    );
    d.querySelector("#quoteComponent").onchange = (e) => {
      const part = parts.find((p) => p.code === e.target.value);
      d.querySelector("#quoteTask").value = part ? "Kiểm tra " + part.name : "";
      d.querySelector("#quoteComponentHelp").textContent = part
        ? "Vật tư liên quan: " + part.materials + " · " + part.caution
        : "";
    };
    const renderLines = () => {
      d.querySelector("#quoteLines").innerHTML =
        `<div class="table-responsive"><table><thead><tr><th>Công việc / Vật tư</th><th>SL</th><th>Công</th><th>Dự tính</th><th></th></tr></thead><tbody>${lines.map((r, i) => `<tr><td>${esc(r.taskName)}<small>${esc(r.partName)}</small></td><td>${r.quantity}</td><td>${money(r.laborPrice)}</td><td>${money(r.partPrice * r.quantity + r.laborPrice)}</td><td><button type="button" class="btn-icon" data-remove="${i}" aria-label="Xóa dòng">×</button></td></tr>`).join("")}</tbody></table></div>`;
    };
    d.querySelector("#quoteAdd").onclick = () => {
      const task = d.querySelector("#quoteTask").value.trim(),
        quantity = Number(d.querySelector("#quoteQuantity").value),
        labor = Number(d.querySelector("#quoteLabor").value),
        part = stock.find(
          (p) => p.id === Number(d.querySelector("#quotePart").value),
        );
      if (
        !task ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 100000 ||
        !Number.isFinite(labor) ||
        labor < 0
      ) {
        d.querySelector(".care-error").textContent =
          "Kiểm tra công việc, số lượng và tiền công.";
        return;
      }
      lines.push({
        taskName: task,
        inventoryId: part?.id || null,
        quantity,
        laborPrice: labor,
        partName: part?.name || "Không dùng vật tư",
        partPrice: Number(part?.unitPrice) || 0,
      });
      d.querySelector(".care-error").textContent = "";
      renderLines();
    };
    d.onclick = (e) => {
      const b = e.target.closest("[data-remove]");
      if (b) {
        lines.splice(Number(b.dataset.remove), 1);
        renderLines();
      }
    };
    renderLines();
  }
  host.onclick = async (e) => {
    const btn = e.target.closest("[data-service]");
    if (!btn) return;
    const action = btn.dataset.service,
      v = visits.find((v) => v.id === Number(btn.dataset.id));
    if (action === "retry") return load();
    if (action === "intake")
      return dialog(
        "Kiểm tra đầu vào",
        `<div class="form-grid"><label class="form-group">Xe đã tiếp nhận<select name="vehicleId" required>${vehicles
          .filter((v) => v.status !== "delivered")
          .map(
            (v) =>
              `<option value="${v.id}">${esc(v.licensePlate)} · ${esc(v.customerName)}</option>`,
          )
          .join(
            "",
          )}</select></label><label class="form-group">Thợ kiểm tra kỹ<select name="mechanicId"><option value="">Chưa phân công</option>${mechanicOptions()}</select></label></div><label class="form-group">Nhu cầu của khách<textarea name="concern" required minlength="3" maxlength="2000" rows="3"></textarea></label><label class="form-group">Kiểm tra ban đầu (ngoại thất, đèn báo, phanh, tình trạng… )<textarea name="initialInspection" required minlength="3" maxlength="4000" rows="4"></textarea></label>`,
        async (f) => {
          const body = Object.fromEntries(new FormData(f));
          body.vehicleId = Number(body.vehicleId);
          body.mechanicId = Number(body.mechanicId) || null;
          await Garage.request("/service/visits", { method: "POST", body });
        },
      );
    if (action === "assignment")
      return dialog(
        "Phân công kiểm tra kỹ",
        `<label class="form-group">Kỹ thuật viên<select name="mechanicId" required>${mechanicOptions()}</select></label>`,
        (f) =>
          Garage.request("/service/visits/" + v.id + "/assignment", {
            method: "PUT",
            body: { mechanicId: Number(f.elements.mechanicId.value) },
          }),
      );
    if (action === "diagnosis")
      return dialog(
        "Kết quả kiểm tra kỹ",
        `<p class="field-help">Thay chẩn đoán sẽ yêu cầu lập và duyệt lại báo giá chính thức chưa chuyển phiếu.</p><label class="form-group">Chẩn đoán / số đo / công việc đề nghị<textarea name="diagnosis" required minlength="3" maxlength="4000" rows="6">${esc(v.diagnosis || "")}</textarea></label>`,
        (f) =>
          Garage.request("/service/visits/" + v.id + "/diagnosis", {
            method: "PUT",
            body: { diagnosis: f.elements.diagnosis.value },
          }),
      );
    if (action === "quote") return quoteEditor(v, btn.dataset.stage);
    if (action === "decision")
      return dialog(
        btn.dataset.approved === "true"
          ? "Xác nhận báo giá"
          : "Yêu cầu điều chỉnh",
        `<p class="notice">Xác nhận chỉ áp dụng đúng phiên bản đang xem, gồm công việc, vật tư và tổng tiền.</p><label class="form-group">${advisor ? "Cách liên hệ & nội dung khách đã xác nhận" : "Ghi chú cho garage"}<textarea name="note" rows="4" maxlength="2000" ${advisor ? 'required minlength="10"' : ""}></textarea></label>`,
        (f) =>
          Garage.request("/service/quotes/" + btn.dataset.id + "/decision", {
            method: "POST",
            body: {
              approved: btn.dataset.approved === "true",
              note: f.elements.note.value,
            },
          }),
      );
    if (action === "convert")
      return dialog(
        "Phân công & Chuyển vào xưởng",
        `<label class="form-group">Kỹ thuật viên<select name="mechanicId" required>${mechanicOptions()}</select></label><p class="field-help">Xuất kho theo báo giá đã duyệt. Thiếu tồn hoặc đổi giá sẽ yêu cầu xử lý trước.</p>`,
        (f) =>
          Garage.request("/service/quotes/" + btn.dataset.id + "/convert", {
            method: "POST",
            body: { mechanicId: Number(f.elements.mechanicId.value) },
          }),
      );
    if (action === "qc")
      return dialog(
        "Nghiệm thu sau sửa chữa",
        `<label><input name="workVerified" type="checkbox" required> Đã kiểm tra các công việc đã thực hiện</label><p><label><input name="safetyChecked" type="checkbox" required> Đã kiểm tra an toàn</label></p><label class="form-group">Kết quả chạy thử hoặc lý do không chạy thử<textarea name="roadTestOrReason" required minlength="3" maxlength="2000" rows="3"></textarea></label><label class="form-group">Ghi chú<textarea name="note" maxlength="2000"></textarea></label>`,
        (f) =>
          Garage.request("/service/visits/" + v.id + "/qc", {
            method: "POST",
            body: {
              workVerified: f.elements.workVerified.checked,
              safetyChecked: f.elements.safetyChecked.checked,
              roadTestOrReason: f.elements.roadTestOrReason.value,
              note: f.elements.note.value,
            },
          }),
      );
    if (action === "finance") {
      const nav = document.querySelector('[data-target="finance-section"]');
      if (nav) nav.click();
      else Garage.toast("Chuyển bộ phận kế toán để thu tiền.");
      return;
    }
    if (
      action === "cancel" &&
      confirm("Kết thúc lượt chưa có phiếu sửa chữa?")
    ) {
      try {
        await Garage.request("/service/visits/" + v.id + "/cancel", {
          method: "POST",
        });
        await load();
      } catch (err) {
        Garage.toast(err.message, "error");
      }
    }
  };
  Garage.subscribe(load);
  load();
});
