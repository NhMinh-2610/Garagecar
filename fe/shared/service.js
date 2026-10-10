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
  const user = Garage.permissionsReady
      ? await Garage.permissionsReady
      : JSON.parse(localStorage.getItem("user") || "{}"),
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
    parts = [],
    wages = [];
  const money = (v) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(v) || 0);
  function dialog(title, body, save, options = {}) {
    const d = document.createElement("dialog");
    d.className = "care-dialog workflow-dialog";
    d.setAttribute("aria-labelledby", "serviceDialogTitle");
    d.innerHTML = `<div class="card-heading"><h3 id="serviceDialogTitle">${esc(title)}</h3><button type="button" class="btn-icon" data-close aria-label="Đóng">×</button></div><form>${body}<p class="care-error text-red" role="alert" tabindex="-1"></p><div class="workflow-dialog-footer"><button type="button" class="btn btn-secondary" data-close>Để sau</button><button type="submit" class="btn btn-primary">${esc(options.submitLabel || "Lưu kết quả")}</button></div></form>`;
    document.body.append(d);
    d.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => d.close()));
    d.onclose = () => d.remove();
    d.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("[type=submit]");
      if (btn.disabled || !e.target.reportValidity()) return;
      btn.disabled = true;
      try {
        const result = await save(e.target);
        d.close();
        await load();
        const visitId = options.visitId || result?.visitId || result?.id;
        if (visitId && visits.some((v) => v.id === visitId)) focusVisit(visitId);
        const feedback = host.querySelector("#serviceFeedback");
        if (feedback) {
          feedback.hidden = false;
          feedback.textContent =
            options.success || "Đã lưu. Bước tiếp theo đã được cập nhật bên dưới.";
        }
        if (options.nextQuote && visitId) {
          const visit = visits.find((v) => v.id === visitId);
          if (visit) quoteEditor(visit, "preliminary");
        }
      } catch (error) {
        d.querySelector(".care-error").textContent = error.message;
        d.querySelector(".care-error").focus();
      } finally {
        btn.disabled = false;
      }
    };
    d.showModal();
    return d;
  }
  const mechanicOptions = (selected = null) => {
    // Chi tu chon khi da phan cong hoac chi co mot tho hop le.
    const chosen = selected || (mechanics.length === 1 ? mechanics[0].id : null);
    return `<option value="">Chọn kỹ thuật viên</option>${mechanics.map((m) => `<option value="${m.id}" ${m.id === chosen ? "selected" : ""}>${esc(m.fullName)}${m.openTickets != null ? ` · ${m.openTickets} phiếu đang làm` : ""}</option>`).join("")}`;
  };
  const serviceView = {
    query: "",
    status: "all",
    page: 0,
    expanded: new Set(),
    visitId: null,
  };
  function focusVisit(visitId) {
    const visit = visits.find((v) => v.id === Number(visitId));
    if (!visit) return;
    serviceView.visitId = visit.id;
    serviceView.query = visit.licensePlate;
    serviceView.status = "all";
    serviceView.page = 0;
    render();
    host.querySelector("#serviceSearch").value = serviceView.query;
    host.querySelector("#serviceStatus").value = "all";
    const card = host.querySelector(`[data-visit-id="${visit.id}"]`);
    card.tabIndex = -1;
    card.focus();
    card.scrollIntoView?.({ block: "nearest" });
  }
  // Mo dung luot dich vu tu man hinh tao phieu, ke ca khi dang loc hoac phan trang.
  Garage.openServiceVisit = async (visitId, vehicleId = null) => {
    if (!(await load({}, vehicleId))) throw Error("Không tải được lượt dịch vụ. Hãy thử lại.");
    const visit = visits.find((v) => v.id === Number(visitId));
    if (!visit) throw Error("Lượt dịch vụ không còn trong danh sách. Hãy tải lại dữ liệu xe.");
    serviceView.expanded.add(String(visit.id));
    Garage.navigate("service-section");
    focusVisit(visit.id);
  };
  // Cung mot diem vao tu tiep nhan, xuong va man hinh co van.
  Garage.startService = async (vehicleId = null) => {
    if (!advisor) return;
    if (!(await load())) throw Error("Không tải được dữ liệu tiếp nhận. Hãy thử lại.");
    const visit = visits.find((v) => v.vehicleId === Number(vehicleId) && v.status !== "closed");
    if (visit) return Garage.openServiceVisit(visit.id, visit.vehicleId);
    const vehicle = vehicles.find((v) => v.id === Number(vehicleId));
    if (vehicle?.activeVisitId) return Garage.openServiceVisit(vehicle.activeVisitId, vehicle.id);
    Garage.navigate?.("service-section");
    if (vehicle?.ticketId && Garage.openRepairTicket)
      return Garage.openRepairTicket(vehicle.ticketId);
    if (vehicleId) return intakeEditor(vehicleId);
    const candidates = vehicles.filter((v) => v.status !== "delivered");
    if (candidates.length === 1 && candidates[0].availableForIntake)
      return intakeEditor(candidates[0].id);
    startPicker(candidates);
  };
  function startPicker(candidates) {
    const d = document.createElement("dialog");
    d.className = "care-dialog workflow-dialog workflow-picker";
    d.setAttribute("aria-labelledby", "servicePickerTitle");
    d.innerHTML =
      '<div class="card-heading"><h3 id="servicePickerTitle">Tạo phiếu · Chọn xe để tiếp tục</h3><button type="button" class="btn-icon" data-picker-close aria-label="Đóng">×</button></div><p class="workflow-intro">Xe có báo giá sẽ tiếp tục đúng bước đang chờ. Xe mới bắt đầu bằng tiếp nhận dịch vụ.</p><label class="form-group">Tìm xe hoặc khách hàng<input type="search" id="servicePickerSearch" placeholder="Biển số, tên khách, dòng xe…"></label><p class="field-help" id="servicePickerCount" role="status"></p><div id="servicePickerList" class="workflow-picker-list"></div>';
    document.body.append(d);
    d.onclose = () => d.remove();
    d.querySelector("[data-picker-close]").onclick = () => d.close();
    const search = d.querySelector("#servicePickerSearch");
    const draw = () => {
      const query = search.value.trim().toLocaleLowerCase("vi-VN");
      const matches = candidates.filter((v) =>
        [v.licensePlate, v.customerName, v.carBrand, v.carModel]
          .join(" ")
          .toLocaleLowerCase("vi-VN")
          .includes(query),
      );
      d.querySelector("#servicePickerCount").textContent =
        `${matches.length} xe · Hiển thị tối đa 12 kết quả, nhập biển số để tìm nhanh.`;
      d.querySelector("#servicePickerList").innerHTML =
        matches
          .slice(0, 12)
          .map((vehicle) => {
            const visit = visits.find((v) => v.vehicleId === vehicle.id && v.status !== "closed");
            const quote = visit && latestQuote(visit);
            const existing = vehicle.activeVisitId || visit?.id;
            const title =
              quote?.stage === "final" && quote.status === "approved" && !visit.ticketId
                ? "Tạo phiếu & Giao thợ"
                : existing
                  ? "Tiếp tục hồ sơ"
                  : vehicle.ticketId
                    ? "Xem phiếu sửa"
                    : "Tiếp nhận & Báo giá";
            return `<div class="workflow-picker-row"><div><strong>${esc(vehicle.licensePlate)}</strong><span>${esc(vehicle.customerName)} · ${esc(vehicle.carBrand || "")} ${esc(vehicle.carModel || "")}</span><small>${visit ? esc(nextHint(visit, quote)) : vehicle.ticketId ? `Đã có phiếu #${vehicle.ticketId}. Tiếp tục phiếu hiện tại.` : existing ? `Tiếp tục lượt dịch vụ #${existing}.` : "Chưa có hồ sơ đang mở · Ghi nhu cầu và lập báo giá sơ bộ."}</small></div><button type="button" class="btn btn-primary btn-sm" data-picker-vehicle="${vehicle.id}" ${vehicle.ticketId && !existing && !Garage.openRepairTicket ? "disabled" : ""}>${title}</button></div>`;
          })
          .join("") ||
        '<p class="quote-empty">Không có xe phù hợp. Tiếp nhận xe tại mục Tiếp nhận & Lịch hẹn trước khi tạo hồ sơ dịch vụ.</p>';
    };
    search.oninput = draw;
    d.querySelector("#servicePickerList").onclick = async (e) => {
      const b = e.target.closest("[data-picker-vehicle]");
      if (!b || b.disabled) return;
      const vehicle = candidates.find((v) => v.id === Number(b.dataset.pickerVehicle));
      const visit = visits.find((v) => v.vehicleId === vehicle.id && v.status !== "closed");
      b.disabled = true;
      try {
        const visitId = vehicle.activeVisitId || visit?.id;
        if (visitId) {
          await Garage.openServiceVisit(visitId, vehicle.id);
          d.close();
          focusVisit(visitId);
          host
            .querySelector(`[data-visit-id="${visitId}"] .visit-next-action [data-service]`)
            ?.click();
        } else if (vehicle.ticketId && Garage.openRepairTicket) {
          await Garage.openRepairTicket(vehicle.ticketId);
          d.close();
          document.querySelector(`[data-ticket-row="${vehicle.ticketId}"]`)?.focus();
        } else {
          d.close();
          intakeEditor(vehicle.id);
        }
      } catch (error) {
        d.querySelector("#servicePickerCount").textContent = error.message;
        b.disabled = false;
      }
    };
    draw();
    d.showModal();
    search.focus();
  }
  const latestQuote = (visit) =>
    [...(visit.quotes || [])]
      .reverse()
      .find((quote) => ["pending", "approved", "converted"].includes(quote.status));
  const requiresAction = (visit) => {
    const quote = latestQuote(visit);
    if (user.role === "customer") return quote?.status === "pending";
    if (user.role === "mechanic") return visit.status === "diagnosis" && !visit.diagnosis;
    if (visit.ticketStatus === "completed")
      return !visit.qcAt || user.permissions?.includes("finance");
    return !["in_workshop", "closed"].includes(visit.status) && visit.ticketStatus !== "paid";
  };
  const serviceButton = (action, title, id, extra = "") =>
    `<button type="button" class="btn btn-sm" data-service="${action}" data-id="${id}" ${extra}>${title}</button>`;
  const steps = [
    "Báo giá sơ bộ",
    "Kiểm tra kỹ",
    "Báo giá chính thức",
    "Tạo phiếu",
    "Sửa chữa",
    "Nghiệm thu",
    "Thanh toán",
  ];
  function workflowStep(v) {
    if (v.status === "closed" || v.qcAt || v.ticketStatus === "paid") return 6;
    if (v.ticketStatus === "completed") return 5;
    return (
      { intake: 0, diagnosis: v.diagnosis ? 2 : 1, awaiting_approval: 2, ready: 3, in_workshop: 4 }[
        v.status
      ] ?? 0
    );
  }
  function nextHint(v, quote) {
    if (v.status === "closed")
      return "Lượt dịch vụ đã kết thúc. Bạn có thể xem lại báo giá và lịch sử.";
    if (v.ticketStatus === "paid")
      return "Đã thanh toán. Bộ phận tiếp nhận có thể bàn giao xe cho khách.";
    if (v.qcAt) return "Đã nghiệm thu. Chuyển kế toán thu tiền trước khi giao xe.";
    if (v.ticketStatus === "completed")
      return "Các hạng mục đã hoàn tất. Cố vấn kiểm tra chất lượng và ghi kết quả chạy thử.";
    if (v.ticketId)
      return `Phiếu #${v.ticketId} đã được tạo. ${v.ticketStatus === "draft" ? "Kỹ thuật viên bắt đầu công việc tại mục Công việc của tôi." : "Kỹ thuật viên thực hiện công việc và gửi ảnh xác nhận."}`;
    if (quote?.status === "pending")
      return `${quote.stage === "final" ? "Báo giá chính thức" : "Báo giá sơ bộ"} đang chờ khách đồng ý. ${advisor ? "Xem chi tiết và ghi nhận xác nhận trước khi tiếp tục." : user.role === "customer" ? "Xem hạng mục và tổng tiền để đồng ý hoặc yêu cầu điều chỉnh." : "Cố vấn sẽ tiếp tục sau khi có xác nhận của khách."}`;
    if (v.status === "ready")
      return advisor
        ? "Báo giá chính thức đã duyệt. Giữ nguyên hạng mục, chọn thợ phụ trách và tạo phiếu."
        : "Báo giá chính thức đã duyệt. Garage đang chuẩn bị phiếu và giao thợ thực hiện.";
    if (v.status === "intake")
      return advisor
        ? "Lập báo giá sơ bộ từ danh mục công việc để khách xác nhận phạm vi kiểm tra."
        : "Garage đang lập báo giá sơ bộ. Khách hàng sẽ xác nhận phạm vi trước khi kiểm tra kỹ.";
    if (!advisor && user.role === "customer")
      return "Garage đang kiểm tra xe và chuẩn bị báo giá chính thức để bạn xác nhận.";
    if (!advisor && v.diagnosis)
      return "Đã ghi kết quả kiểm tra. Chờ cố vấn lập và gửi báo giá chính thức cho khách.";
    if (!v.diagnosis)
      return v.mechanicId
        ? "Đã giao kiểm tra. Kỹ thuật viên hoặc cố vấn ghi kết quả để lập báo giá chính thức."
        : "Giao kỹ thuật viên kiểm tra hoặc ghi kết quả kiểm tra kỹ, rồi lập báo giá chính thức.";
    return "Đã có kết quả kiểm tra. Dùng lại hạng mục sơ bộ và điều chỉnh trước khi gửi báo giá chính thức.";
  }
  function visitCard(v) {
    const latest = latestQuote(v),
      actions = [];
    const add = (action, title, id = v.id, extra = "", priority = 0) =>
      actions.push({
        action,
        priority,
        html: serviceButton(action, title, id, extra),
      });
    if (advisor && !["in_workshop", "qc_passed", "closed"].includes(v.status))
      add("assignment", "Phân công kiểm tra", v.id, "", 10);
    if (advisor && v.status === "intake")
      add("quote", "Lập báo giá sơ bộ", v.id, 'data-stage="preliminary"', latest ? 10 : 60);
    if (
      (advisor || user.role === "mechanic") &&
      ["diagnosis", "awaiting_approval", "ready"].includes(v.status)
    )
      add("diagnosis", "Ghi kiểm tra kỹ", v.id, "", v.diagnosis ? 20 : 65);
    if (advisor && v.diagnosis && ["diagnosis", "awaiting_approval", "ready"].includes(v.status))
      add("quote", "Lập báo giá chính thức", v.id, 'data-stage="final"', 70);
    if ((advisor || user.role === "customer") && latest?.status === "pending") {
      add("decision", "Xem & Xác nhận", latest.id, 'data-approved="true"', 100);
      add("decision", "Yêu cầu điều chỉnh", latest.id, 'data-approved="false"', 95);
    }
    if (
      advisor &&
      v.status === "ready" &&
      latest?.status === "approved" &&
      latest.stage === "final"
    )
      add("convert", "Tạo phiếu & Giao thợ", latest.id, "", 110);
    if (advisor && v.ticketStatus === "completed" && !v.qcAt)
      add("qc", "Nghiệm thu", v.id, "", 120);
    if (
      advisor &&
      user.permissions?.includes("finance") &&
      v.qcAt &&
      v.ticketStatus === "completed"
    )
      add("finance", "Đến Thu tiền", v.id, "", 130);
    if (advisor && !v.ticketId && v.status !== "closed") add("cancel", "Kết thúc lượt chưa sửa");
    actions.sort((a, b) => b.priority - a.priority);
    const primary = actions.find((action) => action.priority >= 50);
    const secondaryDecision =
      primary?.action === "decision"
        ? actions.find((a) => a !== primary && a.action === "decision")
        : null;
    const secondary = actions.filter((a) => a !== primary && a !== secondaryDecision);
    const ticketControl = !v.ticketId
      ? ""
      : ["admin", "customer", "mechanic"].includes(user.role)
        ? serviceButton("ticket", `Phiếu #${v.ticketId}`, v.ticketId)
        : `<span class="badge">Phiếu #${v.ticketId}</span>`;
    const quotation = latest
      ? `${latest.stage === "final" ? "Báo giá chính thức" : "Báo giá sơ bộ"} · ${money(latest.totalAmount)}`
      : "Chưa lập báo giá";
    const step = workflowStep(v);
    return `<article class="visit-card visit-row" data-visit-id="${v.id}">
      <div class="visit-row-summary"><div class="visit-identity"><h3>#${v.id} · ${esc(v.licensePlate)}</h3><p class="visit-concern">${esc(v.concern)}</p><div class="visit-meta"><span class="badge">${esc(statuses[v.status] || v.status)}</span><span>${esc(quotation)}</span></div></div>
        <div class="visit-next-action">${primary ? primary.html.replace('class="btn btn-sm"', 'class="btn btn-primary btn-sm"') : ticketControl || '<span class="panel-note">Theo dõi tiến độ</span>'}${secondaryDecision?.html || ""}</div></div>
      <ol class="workflow-steps" aria-label="Tiến trình dịch vụ">${steps.map((label, i) => `<li class="${i < step ? "is-done" : i === step ? "is-current" : ""}" ${i === step ? 'aria-current="step"' : ""}><span aria-hidden="true">${i < step ? "✓" : i + 1}</span>${label}</li>`).join("")}</ol>
      <div class="workflow-next"><span class="workflow-kicker">${v.status === "closed" ? "ĐÃ KẾT THÚC" : "BƯỚC TIẾP THEO"}</span><p>${esc(nextHint(v, latest))}</p>${advisor && !v.mechanicId && ["diagnosis", "awaiting_approval", "ready"].includes(v.status) ? serviceButton("assignment", "Giao thợ kiểm tra", v.id) : ""}</div>
      <details class="visit-details" data-visit-detail="${v.id}" ${serviceView.expanded.has(String(v.id)) ? "open" : ""}><summary>Thông tin, chi phí và thao tác khác</summary><div class="visit-details-body">
        <div class="visit-inspection"><h4>Kiểm tra & Chẩn đoán</h4><p><strong>Nhu cầu:</strong> ${esc(v.concern)}</p><p><strong>Đầu vào:</strong> ${esc(v.initialInspection)}</p><p><strong>Kiểm tra kỹ:</strong> ${esc(v.diagnosis || "Chưa ghi nhận")}</p>${v.qcAt ? `<p><strong>Nghiệm thu:</strong> ${esc(v.qc?.roadTestOrReason)} · ${esc(v.qc?.note)}</p>` : ""}</div>
        ${latest ? `<div class="visit-quotation"><div class="card-heading"><h4>${latest.stage === "final" ? "Báo giá chính thức" : "Báo giá sơ bộ"} · phiên bản ${latest.revision}</h4><span class="badge">${esc({ pending: "Chờ xác nhận", approved: "Đã duyệt", converted: "Đã chuyển phiếu" }[latest.status])}</span></div>${quoteTable(latest)}${latest.decisionNote ? `<p>${esc(latest.decisionNote)}</p>` : ""}</div>` : '<p class="panel-note">Cố vấn sẽ bổ sung báo giá sau kiểm tra.</p>'}
        <div class="form-actions">${secondary.map((action) => action.html).join("")}${v.ticketId && user.role !== "accountant" ? `<button type="button" class="btn btn-sm" data-evidence-ticket="${v.ticketId}">Xem ảnh công việc</button>` : ""}${ticketControl}</div>
        <details><summary>Lịch sử ${(v.quotes || []).length} phiên bản báo giá</summary>${(v.quotes || []).map((q) => `<p>Phiên bản ${q.revision} · ${q.stage === "final" ? "Chính thức" : "Sơ bộ"} · ${money(q.totalAmount)} · ${esc(q.status)}</p>${quoteTable(q)}`).join("") || '<p class="panel-note">Chưa có phiên bản báo giá.</p>'}</details>
      </div></details></article>`;
  }
  function renderVisits() {
    const query = serviceView.query.trim().toLocaleLowerCase("vi-VN");
    const visible = visits.filter((visit) => {
      const statusMatch =
        serviceView.status === "all" ||
        (serviceView.status === "attention"
          ? requiresAction(visit)
          : serviceView.status === "active"
            ? visit.status !== "closed"
            : visit.status === serviceView.status);
      return (
        (!serviceView.visitId || visit.id === serviceView.visitId) &&
        statusMatch &&
        [visit.id, visit.licensePlate, visit.concern, visit.diagnosis]
          .join(" ")
          .toLocaleLowerCase("vi-VN")
          .includes(query)
      );
    });
    const pages = Math.max(1, Math.ceil(visible.length / 12));
    serviceView.page = Math.min(serviceView.page, pages - 1);
    host.querySelector("#serviceVisitCount").textContent =
      `${visible.length} / ${visits.length} lượt dịch vụ`;
    host.querySelector("#serviceShowAll").hidden = !serviceView.visitId;
    host.querySelector("#serviceActionCount").textContent = visits.filter(requiresAction).length;
    host.querySelector("#serviceActiveCount").textContent = visits.filter(
      (v) => v.status !== "closed",
    ).length;
    host.querySelector("#serviceClosedCount").textContent = visits.filter(
      (v) => v.status === "closed",
    ).length;
    host
      .querySelectorAll("[data-service-filter]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(!serviceView.visitId && serviceView.status === b.dataset.serviceFilter),
        ),
      );
    host.querySelector("#serviceVisitList").innerHTML =
      visible
        .slice(serviceView.page * 12, (serviceView.page + 1) * 12)
        .map(visitCard)
        .join("") ||
      '<div class="card empty-state">Không có lượt dịch vụ phù hợp. Thử đổi bộ lọc hoặc từ khóa.</div>';
    const pager = host.querySelector("#servicePagination");
    pager.hidden = visible.length <= 12;
    pager.querySelector("span").textContent = `Trang ${serviceView.page + 1} / ${pages}`;
    pager.querySelector('[data-service-page="previous"]').disabled = serviceView.page === 0;
    pager.querySelector('[data-service-page="next"]').disabled = serviceView.page >= pages - 1;
    host.querySelectorAll("[data-visit-detail]").forEach((detail) => {
      detail.ontoggle = () =>
        detail.open
          ? serviceView.expanded.add(detail.dataset.visitDetail)
          : serviceView.expanded.delete(detail.dataset.visitDetail);
    });
  }
  function render() {
    // Keep the toolbar mounted so polling never replaces a focused search field.
    if (!host.querySelector("#serviceVisitList")) {
      host.innerHTML = `<div class="section-heading"><div><p class="eyebrow">HỒ SƠ DỊCH VỤ</p><h1>${advisor ? "Cố vấn & Báo giá" : user.role === "mechanic" ? "Kiểm tra kỹ được giao" : "Báo giá & Xác nhận"}</h1><p class="section-description">Mỗi xe một hồ sơ, mỗi bước một thao tác chính. Chọn xe để tiếp tục đúng công việc đang chờ.</p></div>${advisor ? '<button type="button" class="btn btn-primary" data-service="intake">＋ Tiếp nhận dịch vụ</button>' : ""}</div>
        <div class="workflow-overview" aria-label="Lọc nhanh lượt dịch vụ"><button type="button" data-service-filter="attention" aria-pressed="false"><span>Cần xử lý</span><strong id="serviceActionCount">0</strong><small>Ưu tiên công việc đang chờ</small></button><button type="button" data-service-filter="active" aria-pressed="false"><span>Đang thực hiện</span><strong id="serviceActiveCount">0</strong><small>Theo dõi từ tiếp nhận đến giao xe</small></button><button type="button" data-service-filter="closed" aria-pressed="false"><span>Đã kết thúc</span><strong id="serviceClosedCount">0</strong><small>Tra cứu hồ sơ trước đây</small></button></div>
        <p id="serviceFeedback" class="workflow-feedback" role="status" hidden></p>
        <div class="care-toolbar"><label>Tìm lượt dịch vụ<input id="serviceSearch" type="search" placeholder="Biển số, nhu cầu, chẩn đoán…"></label><label>Trạng thái<select id="serviceStatus"><option value="all">Tất cả lượt</option><option value="attention">Cần xử lý</option><option value="active">Đang thực hiện</option>${Object.entries(
          statuses,
        )
          .map(([value, label]) => `<option value="${value}">${esc(label)}</option>`)
          .join(
            "",
          )}</select></label><p id="serviceVisitCount" class="panel-note" aria-live="polite"></p><button type="button" class="btn btn-sm" id="serviceShowAll" hidden>Xem tất cả lượt</button></div>
        <div class="visit-grid visit-list" id="serviceVisitList"></div><div class="care-pagination" id="servicePagination"><button type="button" class="btn btn-sm" data-service-page="previous">Trước</button><span aria-live="polite"></span><button type="button" class="btn btn-sm" data-service-page="next">Sau</button></div>`;
      host.querySelector("#serviceSearch").value = serviceView.query;
      host.querySelector("#serviceStatus").value = serviceView.status;
      host.querySelector("#serviceSearch").oninput = (event) => {
        serviceView.visitId = null;
        serviceView.query = event.target.value;
        serviceView.page = 0;
        renderVisits();
      };
      host.querySelector("#serviceStatus").onchange = (event) => {
        serviceView.visitId = null;
        serviceView.status = event.target.value;
        serviceView.page = 0;
        renderVisits();
      };
      host.querySelector("#serviceShowAll").onclick = () => {
        serviceView.visitId = null;
        serviceView.query = "";
        serviceView.status = "all";
        serviceView.page = 0;
        host.querySelector("#serviceSearch").value = "";
        host.querySelector("#serviceStatus").value = "all";
        renderVisits();
      };
      host.querySelectorAll("[data-service-filter]").forEach((button) => {
        button.onclick = () => {
          serviceView.visitId = null;
          serviceView.status = button.dataset.serviceFilter;
          serviceView.query = "";
          serviceView.page = 0;
          host.querySelector("#serviceSearch").value = "";
          host.querySelector("#serviceStatus").value = serviceView.status;
          renderVisits();
        };
      });
      host.querySelector("#servicePagination").onclick = (event) => {
        const button = event.target.closest("[data-service-page]");
        if (!button || button.disabled) return;
        serviceView.page += button.dataset.servicePage === "next" ? 1 : -1;
        renderVisits();
      };
    }
    renderVisits();
  }
  function quoteTable(q) {
    return `<div class="table-responsive"><table><thead><tr><th>Công việc / Vật tư</th><th>SL</th><th>Đơn giá</th><th>Tiền công</th><th>Thành tiền</th></tr></thead><tbody>${q.items.map((r) => `<tr><td>${esc(r.taskName)}<small>${esc(r.partName)}</small></td><td>${r.quantity}</td><td>${money(r.partPrice)}</td><td>${money(r.laborPrice)}</td><td>${money(r.totalPrice)}</td></tr>`).join("")}</tbody></table></div><div class="workflow-total"><span>Tổng báo giá</span><strong>${money(q.totalAmount)}</strong></div>`;
  }
  async function load(context = {}, vehicleId = null) {
    const guard = Garage.refreshGuard(context);
    try {
      const values = await Promise.all([
        Garage.request(
          "/service/visits" + (vehicleId ? `?active=true&vehicleId=${vehicleId}` : ""),
        ),
        advisor ? Garage.request("/service/resources") : Promise.resolve({}),
        advisor ? Garage.request("/maintenance/catalog") : Promise.resolve(null),
      ]);
      if (!guard()) return;
      visits = values[0];
      vehicles = values[1]?.vehicles || [];
      mechanics = values[1]?.mechanics || [];
      stock = values[1]?.inventory || [];
      parts = values[2]?.components || [];
      wages = values[1]?.wages || [];
      render();
      return true;
    } catch (e) {
      if (!context.background)
        host.innerHTML = `<p class="inline-message error">${esc(e.message)}</p><button class="btn" data-service="retry">Thử lại</button>`;
    }
  }
  function intakeEditor(vehicleId = null) {
    const available = vehicles.filter(
      (v) =>
        v.availableForIntake ??
        (v.status !== "delivered" &&
          !v.ticketId &&
          !visits.some((visit) => visit.vehicleId === v.id && visit.status !== "closed")),
    );
    const d = dialog(
      "Tiếp nhận dịch vụ",
      `<p class="workflow-intro">Ghi nhu cầu và tình trạng xe một lần. Sau khi lưu, hồ sơ sẽ hướng dẫn bạn lập báo giá và chuyển vào xưởng.</p><label class="form-group">Xe cần làm dịch vụ<select name="vehicleId" required><option value="">Chọn biển số · tìm bằng bàn phím</option>${available.map((v) => `<option value="${v.id}" ${v.id === Number(vehicleId) ? "selected" : ""}>${esc(v.licensePlate)} · ${esc(v.customerName)} · ${esc(v.carBrand || "")} ${esc(v.carModel || "")}</option>`).join("")}</select></label><p class="field-help">${available.length ? "Chỉ hiển thị xe đã tiếp nhận, chưa có lượt dịch vụ hoặc phiếu đang mở." : "Chưa có xe phù hợp. Tiếp nhận xe tại mục Tiếp nhận & Lịch hẹn, hoặc tiếp tục hồ sơ đang có trong danh sách."}</p><label class="form-group">Khách cần kiểm tra / sửa gì?<textarea name="concern" required minlength="3" maxlength="2000" rows="3" placeholder="Ví dụ: Bảo dưỡng định kỳ, phanh có tiếng kêu khi giảm tốc…"></textarea></label><label class="form-group">Tình trạng ghi nhận khi nhận xe<textarea name="initialInspection" required minlength="3" maxlength="4000" rows="3" placeholder="Ghi đèn báo, ngoại thất, mức nhiên liệu và dấu hiệu bất thường đã kiểm tra."></textarea></label><details class="workflow-optional"><summary>Phân công kiểm tra ngay (tùy chọn)</summary><label class="form-group">Kỹ thuật viên<select name="mechanicId"><option value="">Phân công sau</option>${mechanics.map((m) => `<option value="${m.id}">${esc(m.fullName)}</option>`).join("")}</select></label></details>`,
      async (f) => {
        const body = Object.fromEntries(new FormData(f));
        body.vehicleId = Number(body.vehicleId);
        body.mechanicId = Number(body.mechanicId) || null;
        return Garage.request("/service/visits", { method: "POST", body });
      },
      {
        submitLabel: "Lưu & Lập báo giá sơ bộ",
        success: "Đã tiếp nhận. Thêm công việc từ danh mục để lập báo giá sơ bộ.",
        nextQuote: true,
      },
    );
    const select = d.querySelector('[name="vehicleId"]');
    select.value = vehicleId || (available.length === 1 ? available[0].id : "");
    if (!vehicleId && available.length > 1) {
      const label = document.createElement("label");
      label.className = "form-group";
      label.innerHTML =
        'Tìm xe<input type="search" id="intakeVehicleSearch" placeholder="Biển số, tên khách, dòng xe…">';
      select.closest("label").before(label);
      label.querySelector("input").oninput = (e) => {
        const selected = select.value;
        const query = e.target.value.trim().toLocaleLowerCase("vi-VN");
        const matches = available.filter(
          (v) =>
            String(v.id) === selected ||
            [v.licensePlate, v.customerName, v.carBrand, v.carModel]
              .join(" ")
              .toLocaleLowerCase("vi-VN")
              .includes(query),
        );
        select.innerHTML =
          '<option value="">Chọn biển số</option>' +
          matches
            .map(
              (v) =>
                `<option value="${v.id}">${esc(v.licensePlate)} · ${esc(v.customerName)} · ${esc(v.carBrand || "")} ${esc(v.carModel || "")}</option>`,
            )
            .join("");
        select.value = selected || (matches.length === 1 ? matches[0].id : "");
      };
    }
    d.querySelector('[type="submit"]').disabled = !available.length;
    if (vehicleId) d.querySelector('[name="concern"]').focus();
    return d;
  }
  function quoteEditor(v, stage) {
    let lines = [];
    const previous = [...(v.quotes || [])]
      .reverse()
      .find((q) => q.items?.length && ["approved", "pending"].includes(q.status));
    const d = dialog(
      "Báo giá " + (stage === "final" ? "chính thức" : "sơ bộ") + " · " + v.licensePlate,
      `<p class="workflow-intro">${stage === "final" ? "Dựa trên kết quả kiểm tra để chốt công việc và gửi khách duyệt." : "Chọn công việc cần kiểm tra hoặc sửa. Tiền công lấy từ bảng giá của garage."}</p>${v.diagnosis ? `<div class="workflow-context"><strong>Kết quả kiểm tra</strong><p>${esc(v.diagnosis)}</p></div>` : ""}
      ${previous ? `<div class="workflow-reuse"><span>Đã có ${previous.items.length} hạng mục ở báo giá ${previous.stage === "final" ? "chính thức" : "sơ bộ"}.</span><button type="button" class="btn btn-sm" id="quoteReuse">Dùng lại hạng mục</button></div>` : ""}
      <div class="quote-composer"><div class="quote-entry"><h4><span class="workflow-number">1</span> Chọn công việc & Vật tư</h4><label class="form-group">Công việc trong bảng giá<select id="quoteJobSelect"><option value="">Chọn công việc có sẵn</option>${wages.map((w) => `<option value="${w.id}">${esc(w.name)} · ${money(w.price)}</option>`).join("")}<option value="custom">Công việc khác</option></select></label><label class="form-group">Nội dung công việc<input id="quoteTask" maxlength="255" placeholder="Chọn ở trên hoặc nhập công việc khác"></label>
      <label class="form-group">Tìm vật tư theo tên hoặc mã<input type="search" id="quotePartSearch" placeholder="Ví dụ: lọc dầu, SKU…"></label><label class="form-group">Vật tư<select id="quotePart"><option value="">Không dùng vật tư</option></select></label><p id="quotePartHelp" class="field-help" role="status"></p>
      <div class="form-grid"><label class="form-group">Số lượng<input id="quoteQuantity" type="number" min="1" max="100000" value="1"></label><label class="form-group">Tiền công / hạng mục (đ)<input id="quoteLabor" type="number" min="0" max="999999999999" step="0.01" value="0"></label></div><button type="button" class="btn btn-secondary" id="quoteAdd">＋ Thêm vào báo giá</button>
      <details class="workflow-optional"><summary>Tra bộ phận & Lưu ý kỹ thuật</summary><label class="form-group">Bộ phận<select id="quoteComponent"><option value="">Chọn bộ phận</option>${parts.map((p) => `<option value="${p.code}">${esc(p.name)}</option>`).join("")}</select></label><p id="quoteComponentHelp" class="field-help"></p></details></div>
      <aside class="quote-review" aria-label="Xem lại báo giá"><h4><span class="workflow-number">2</span> Kiểm tra trước khi gửi</h4><div id="quoteLines"></div><div class="workflow-total"><span>Tổng dự tính</span><strong id="quoteTotal" aria-live="polite">0 ₫</strong></div><p class="field-help">Tiền công tính một lần cho mỗi hạng mục. Chưa xuất kho; mã phụ tùng cần được đối chiếu theo VIN.</p><p id="quoteStockNotice" class="field-help" role="status"></p></aside></div>`,
      async () => {
        if (!lines.length) throw Error("Thêm ít nhất một công việc.");
        if (d.querySelector("#quoteTask").value.trim())
          throw Error(
            "Công việc đang nhập chưa được thêm. Chọn Thêm vào báo giá hoặc xóa nội dung đang nhập trước khi gửi.",
          );
        if (lines.some((r) => r.missing))
          throw Error("Có vật tư không còn trong kho. Xóa hạng mục đó và chọn lại đúng mã.");
        if (
          lines.some(
            (r) =>
              r.inventoryId && fitment(stock.find((p) => p.id === r.inventoryId)) === "mismatch",
          )
        )
          throw Error(
            "Có vật tư không khớp cấu hình hồ sơ xe. Xóa hạng mục đó và chọn lại đúng mã.",
          );
        await Garage.request("/service/visits/" + v.id + "/quotes", {
          method: "POST",
          body: {
            stage,
            items: lines.map(({ taskName, inventoryId, quantity, laborPrice }) => ({
              taskName,
              inventoryId,
              quantity,
              laborPrice,
            })),
          },
        });
      },
      {
        submitLabel: stage === "final" ? "Gửi báo giá chính thức" : "Gửi báo giá sơ bộ",
        visitId: v.id,
        success: "Đã gửi báo giá. Bước tiếp theo: xem báo giá và ghi nhận xác nhận của khách.",
      },
    );
    const field = (id) => d.querySelector("#" + id);
    const normalize = (text) =>
      String(text || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[đĐ]/g, "d")
        .toLowerCase();
    const vehicle = vehicles.find((vehicle) => vehicle.id === v.vehicleId);
    const same = (a, b) =>
      String(a || "")
        .trim()
        .toLocaleLowerCase() ===
      String(b || "")
        .trim()
        .toLocaleLowerCase();
    const fitment = (p) => {
      if (!p.fitments?.length) return "unknown";
      if (!vehicle?.modelYear || !vehicle.engine) return "unknown";
      return p.fitments.some(
        (f) =>
          same(f.brand, vehicle.carBrand) &&
          same(f.model, vehicle.carModel) &&
          vehicle.modelYear >= f.yearFrom &&
          vehicle.modelYear <= f.yearTo &&
          same(f.engine, vehicle.engine),
      )
        ? "match"
        : "mismatch";
    };
    function renderParts() {
      const selected = field("quotePart").value;
      const query = normalize(field("quotePartSearch").value).trim();
      const words = normalize(field("quoteTask").value)
        .split(/\s+/)
        .filter(
          (word) =>
            word.length > 2 &&
            !["thay", "kiem", "tra", "dinh", "ky", "change", "check", "replace"].includes(word),
        );
      const ranked = stock
        .filter((p) => normalize(p.name + " " + p.sku).includes(query))
        .map((p) => ({ p, score: words.filter((w) => normalize(p.name).includes(w)).length }))
        .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name, "vi"));
      field("quotePart").innerHTML =
        '<option value="">Không dùng vật tư</option>' +
        ranked
          .map(
            ({ p, score }) =>
              `<option value="${p.id}" ${fitment(p) === "mismatch" ? "disabled" : ""}>${score ? "Gợi ý · " : ""}${esc(p.name)}${p.sku ? ` [${esc(p.sku)}]` : ""} · ${money(p.unitPrice)} · tồn ${p.quantity}${fitment(p) === "mismatch" ? " · không khớp hồ sơ xe" : ""}</option>`,
          )
          .join("");
      // Giu ma da chon khi doi tu khoa; khong tu dong doi vat tu cua nguoi dung.
      if (selected && !ranked.some(({ p }) => String(p.id) === selected)) {
        const p = stock.find((p) => String(p.id) === selected);
        if (p) field("quotePart").add(new Option(p.name + " · đang chọn", p.id));
      }
      field("quotePart").value = selected;
      updatePartHelp();
    }
    function updatePartHelp() {
      const p = stock.find((p) => p.id === Number(field("quotePart").value));
      field("quotePartHelp").textContent = p
        ? `${p.sku || "Chưa có mã SKU"} · Tồn kho ${p.quantity}. ${fitment(p) === "match" ? "Khớp cấu hình hồ sơ; đối chiếu VIN trước khi chốt." : "Chưa xác nhận tương thích theo VIN; cần kiểm tra trước khi chốt."}`
        : "Có thể để Không dùng vật tư cho công việc kiểm tra. Danh sách ưu tiên tên liên quan, cần chọn đúng mã thực tế.";
    }
    field("quoteJobSelect").onchange = () => {
      const job = wages.find((w) => w.id === Number(field("quoteJobSelect").value));
      field("quoteTask").value = job?.name || "";
      field("quoteLabor").value = job?.price || 0;
      renderParts();
      if (!job) field("quoteTask").focus();
    };
    field("quotePartSearch").oninput = renderParts;
    field("quoteTask").onchange = renderParts;
    field("quotePart").onchange = updatePartHelp;
    d.querySelector("#quoteComponent").onchange = (e) => {
      const part = parts.find((p) => p.code === e.target.value);
      d.querySelector("#quoteTask").value = part ? "Kiểm tra " + part.name : "";
      d.querySelector("#quoteComponentHelp").textContent = part
        ? "Vật tư liên quan: " + part.materials + " · " + part.caution
        : "";
      renderParts();
    };
    const renderLines = () => {
      d.querySelector("#quoteLines").innerHTML = lines.length
        ? `<ol class="quote-line-list">${lines.map((r, i) => `<li><div class="quote-line-heading"><strong>${esc(r.taskName)}</strong><button type="button" class="btn-icon" data-remove="${i}" aria-label="Xóa hạng mục ${esc(r.taskName)}">×</button></div><small>${esc(r.partName)}${r.missing ? " · không còn trong kho" : ""}</small><div class="quote-line-fields"><label>SL<input data-line-quantity="${i}" aria-label="Số lượng ${esc(r.taskName)}" type="number" min="1" max="100000" value="${r.quantity}" required></label><label>Tiền công (đ)<input data-line-labor="${i}" aria-label="Tiền công ${esc(r.taskName)}" type="number" min="0" max="999999999999" step="0.01" value="${r.laborPrice}" required></label><strong>${money(r.partPrice * r.quantity + r.laborPrice)}</strong></div></li>`).join("")}</ol>`
        : '<div class="quote-empty">Chưa có hạng mục.<br>Chọn công việc bên cạnh rồi thêm vào báo giá.</div>';
      updateTotals();
    };
    const updateTotals = () => {
      field("quoteTotal").textContent = money(
        lines.reduce((sum, r) => sum + r.partPrice * r.quantity + r.laborPrice, 0),
      );
      const needed = new Map();
      lines.forEach(
        (r) =>
          r.inventoryId && needed.set(r.inventoryId, (needed.get(r.inventoryId) || 0) + r.quantity),
      );
      const shortages = stock.filter((p) => (needed.get(p.id) || 0) > p.quantity);
      field("quoteStockNotice").textContent = shortages.length
        ? "Cần bổ sung kho trước khi tạo phiếu: " + shortages.map((p) => p.name).join(", ")
        : "";
      d.querySelector('[type="submit"]').disabled = !lines.length;
    };
    d.querySelector("#quoteAdd").onclick = () => {
      const task = d.querySelector("#quoteTask").value.trim(),
        quantity = Number(d.querySelector("#quoteQuantity").value),
        labor = Number(d.querySelector("#quoteLabor").value),
        part = stock.find((p) => p.id === Number(d.querySelector("#quotePart").value));
      if (
        !task ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 100000 ||
        !Number.isFinite(labor) ||
        labor < 0 ||
        labor > 999999999999
      ) {
        d.querySelector(".care-error").textContent = "Kiểm tra công việc, số lượng và tiền công.";
        return;
      }
      if (part && fitment(part) === "mismatch") {
        d.querySelector(".care-error").textContent =
          "Mã vật tư không khớp cấu hình hồ sơ xe. Chọn mã phù hợp.";
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
      field("quoteTask").value = "";
      field("quoteJobSelect").value = "";
      field("quotePart").value = "";
      field("quoteQuantity").value = 1;
      field("quoteLabor").value = 0;
      field("quotePartSearch").value = "";
      renderParts();
      renderLines();
      field("quoteJobSelect").focus();
    };
    d.addEventListener("click", (e) => {
      const b = e.target.closest("[data-remove]");
      if (b) {
        lines.splice(Number(b.dataset.remove), 1);
        renderLines();
        field("quoteJobSelect").focus();
      }
    });
    const updateLine = (e) => {
      const quantity = e.target.dataset.lineQuantity;
      const labor = e.target.dataset.lineLabor;
      const value = Number(e.target.value);
      if (quantity == null && labor == null) return;
      if (!e.target.checkValidity() || !Number.isFinite(value)) return;
      if (quantity != null && Number.isInteger(value)) lines[Number(quantity)].quantity = value;
      else if (labor != null) lines[Number(labor)].laborPrice = value;
      const row = lines[Number(quantity ?? labor)];
      e.target.closest(".quote-line-fields").querySelector("strong").textContent = money(
        row.partPrice * row.quantity + row.laborPrice,
      );
      updateTotals();
    };
    field("quoteLines").oninput = updateLine;
    field("quoteLines").onchange = updateLine;
    if (previous)
      field("quoteReuse").onclick = () => {
        if (lines.length) {
          d.querySelector(".care-error").textContent =
            "Đã có hạng mục đang soạn. Xóa hết trước khi dùng lại để tránh trùng công việc.";
          return;
        }
        lines = previous.items.map((r) => {
          const p = stock.find((p) => p.id === r.inventoryId);
          return {
            taskName: r.taskName,
            inventoryId: r.inventoryId,
            quantity: r.quantity,
            laborPrice: Number(r.laborPrice),
            partName: p?.name || r.partName || "Không dùng vật tư",
            partPrice: p ? Number(p.unitPrice) : 0,
            missing: Boolean(r.inventoryId && !p),
          };
        });
        renderLines();
        d.querySelector(".care-error").textContent = "";
      };
    renderParts();
    renderLines();
  }
  host.onclick = async (e) => {
    const btn = e.target.closest("[data-service]");
    if (!btn) return;
    const action = btn.dataset.service,
      v = visits.find((v) => v.id === Number(btn.dataset.id));
    if (action === "retry") return load();
    if (action === "ticket") {
      if (Garage.openRepairTicket) {
        try {
          await Garage.openRepairTicket(Number(btn.dataset.id));
        } catch (error) {
          Garage.toast(error.message, "error");
        }
        return;
      }
      const target =
        user.role === "mechanic"
          ? "tasks-section"
          : user.role === "customer"
            ? "repairs-section"
            : user.role === "admin"
              ? "repair-section"
              : "staffReception-section";
      const nav = document.querySelector(`[data-target="${target}"]`);
      if (Garage.navigate) Garage.navigate(target);
      else nav?.click();
      return;
    }
    if (action === "intake") return intakeEditor();
    if (action === "assignment")
      return dialog(
        "Phân công kiểm tra kỹ",
        `<p class="workflow-intro">${esc(v.licensePlate)} · ${esc(v.concern)}</p><label class="form-group">Kỹ thuật viên<select name="mechanicId" required>${mechanicOptions(v.mechanicId)}</select></label><p class="field-help">Chỉ hiển thị thợ đang làm việc có tài khoản hoạt động. Số phiếu giúp bạn cân đối phân công.</p>`,
        (f) =>
          Garage.request("/service/visits/" + v.id + "/assignment", {
            method: "PUT",
            body: { mechanicId: Number(f.elements.mechanicId.value) },
          }),
        { visitId: v.id, submitLabel: "Giao kiểm tra" },
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
        {
          visitId: v.id,
          submitLabel: "Lưu kết quả kiểm tra",
          success: "Đã ghi kết quả kiểm tra. Cố vấn có thể lập báo giá chính thức.",
        },
      );
    if (action === "quote") return quoteEditor(v, btn.dataset.stage);
    const quoteVisit = ["decision", "convert"].includes(action)
      ? visits.find((visit) => visit.quotes?.some((q) => q.id === Number(btn.dataset.id)))
      : null;
    const quote = quoteVisit?.quotes.find((q) => q.id === Number(btn.dataset.id));
    if (action === "decision" && quote)
      return dialog(
        btn.dataset.approved === "true" ? "Xác nhận báo giá" : "Yêu cầu điều chỉnh",
        `<div class="workflow-context"><strong>${esc(quoteVisit.licensePlate)} · Báo giá ${quote.stage === "final" ? "chính thức" : "sơ bộ"} · phiên bản ${quote.revision}</strong><p>${quote.stage === "final" ? "Đồng ý báo giá này cho phép garage tạo phiếu sửa theo đúng hạng mục bên dưới." : "Đồng ý phạm vi sơ bộ để tiếp tục kiểm tra kỹ. Báo giá chính thức sẽ được gửi xác nhận riêng."}</p></div>${quoteTable(quote)}<label class="form-group">${advisor ? "Cách liên hệ & nội dung khách đã xác nhận" : "Ghi chú cho garage"}<textarea name="note" rows="3" maxlength="2000" placeholder="${advisor ? "Ví dụ: Khách xác nhận qua điện thoại lúc…; đồng ý các hạng mục và tổng tiền trên." : "Nội dung cần trao đổi thêm (tùy chọn)"}" ${advisor ? 'required minlength="10"' : ""}></textarea></label>`,
        (f) =>
          Garage.request("/service/quotes/" + btn.dataset.id + "/decision", {
            method: "POST",
            body: {
              approved: btn.dataset.approved === "true",
              note: f.elements.note.value,
            },
          }),
        {
          visitId: quoteVisit.id,
          submitLabel:
            btn.dataset.approved === "true"
              ? advisor
                ? "Ghi nhận khách đồng ý"
                : "Đồng ý báo giá"
              : "Gửi yêu cầu điều chỉnh",
        },
      );
    if (action === "convert" && quote)
      return dialog(
        "Tạo phiếu & Giao thợ · " + quoteVisit.licensePlate,
        `<p class="workflow-intro">Báo giá chính thức phiên bản ${quote.revision} đã được khách duyệt. Bạn chỉ cần kiểm tra lại và giao thợ; không phải nhập lại hạng mục.</p>${quoteTable(quote)}<label class="form-group">Kỹ thuật viên phụ trách<select name="mechanicId" required>${mechanicOptions(quoteVisit.mechanicId)}</select></label><p class="field-help">${mechanics.length ? "Ưu tiên thợ đã kiểm tra xe. Tạo phiếu sẽ xuất kho theo báo giá; hệ thống kiểm tra lại tồn kho, giá và cấu hình xe trước khi lưu." : "Chưa có thợ đủ điều kiện. Cấp tài khoản hoạt động cho kỹ thuật viên trước khi giao việc."}</p>`,
        (f) =>
          Garage.request("/service/quotes/" + btn.dataset.id + "/convert", {
            method: "POST",
            body: { mechanicId: Number(f.elements.mechanicId.value) },
          }),
        {
          visitId: quoteVisit.id,
          submitLabel: "Tạo phiếu sửa chữa",
          success:
            "Đã tạo phiếu và giao thợ. Kỹ thuật viên tiếp tục tại mục Công việc của tôi; quản trị viên theo dõi tại Sửa chữa & Dịch vụ.",
        },
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
        { visitId: v.id, submitLabel: "Xác nhận nghiệm thu" },
      );
    if (action === "finance") {
      const nav = document.querySelector('[data-target="finance-section"]');
      if (Garage.navigate) Garage.navigate("finance-section");
      else if (nav) nav.click();
      else Garage.toast("Chuyển bộ phận kế toán để thu tiền.");
      return;
    }
    if (action === "cancel" && confirm("Kết thúc lượt chưa có phiếu sửa chữa?")) {
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
