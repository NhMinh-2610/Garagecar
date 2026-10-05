/* Job operations: each API owns its permissions and transaction rules. */
document.addEventListener("DOMContentLoaded", async () => {
  const user = await Garage.permissionsReady;
  if (!user.role || user.role === "customer") return;
  const e = Garage.escape,
    money = formatCurrency;
  const names = {
    admin: "Quản trị",
    advisor: "Cố vấn",
    accountant: "Kế toán",
    hr: "Nhân sự",
    mechanic: "Kỹ thuật viên",
  };
  const labels = {
    submitted: "Chờ duyệt",
    approved: "Đã duyệt",
    paid: "Đã chi",
    cancelled: "Đã hủy",
    pending: "Chờ duyệt",
    rejected: "Từ chối",
    scheduled: "Đã phân ca",
    revoked: "Đã thu hồi",
    cash: "Tiền mặt",
    bank: "Chuyển khoản",
    card: "Thẻ",
    satisfied: "Hài lòng",
    no_answer: "Chưa liên hệ được",
    needs_rework: "Cần kiểm tra lại",
    ev_safety: "An toàn EV / cao áp",
    diagnostics: "Chẩn đoán",
    air_conditioning: "Điều hòa",
    bodywork: "Thân vỏ",
    other: "Khác",
  };
  const allowed = (p) => user.permissions.includes(p);
  const hosts = {};
  function mount(key, title, permission) {
    if (permission && !allowed(permission)) return;
    let host = document.getElementById(key + "Workspace");
    if (!host) {
      const section = document.createElement("section");
      section.id = key + "-section";
      host = document.createElement("div");
      host.id = key + "Workspace";
      section.append(host);
      document.querySelector("main").append(section);
      const nav = document.createElement("button");
      nav.className = "nav-item";
      nav.dataset.target = section.id;
      nav.textContent = title;
      if (permission) nav.dataset.permission = permission;
      document.querySelector("nav").append(nav);
      nav.onclick = () => {
        document
          .querySelectorAll(".nav-item")
          .forEach((n) => n.classList.toggle("active", n === nav));
        document
          .querySelectorAll("main section")
          .forEach((s) => s.classList.toggle("active-section", s === section));
        document.getElementById("pageTitle").textContent = title;
        document.getElementById("sidebar")?.classList.remove("active");
        localStorage.setItem(`garage:${user.role}:section`, section.id);
      };
    }
    host.classList.add("professional-workspace");
    hosts[key] = host;
  }
  mount("advisorOps", "Chăm sóc sau sửa", "reception");
  mount("financeOps", "Đề nghị chi & Sổ thu", "finance");
  mount("hrOps", "Phân ca & Chứng chỉ", "hr");
  mount(
    "myWork",
    "Lịch làm & Nghỉ phép",
    {
      advisor: "reception",
      accountant: "finance",
      hr: "hr",
      mechanic: "workshop",
    }[user.role],
  );
  let expenses = [],
    receipts = [],
    employees = [],
    visits = [],
    followups = [],
    operations = { shifts: [], certificates: [], leave: [] };
  let busy = false;
  const field = (label, name, type = "text", extra = "required") =>
    `<label class="form-group">${label}<input name="${name}" type="${type}" ${extra}></label>`;
  const select = (label, name, rows) =>
    `<label class="form-group">${label}<select name="${name}" required>${rows.map(([value, title]) => `<option value="${e(value)}">${e(title)}</option>`).join("")}</select></label>`;
  const note = (name = "note", label = "Ghi chú / căn cứ") =>
    `<label class="form-group">${label}<textarea name="${name}" rows="3" required minlength="3" maxlength="2000"></textarea></label>`;
  const staffOptions = () =>
    employees
      .filter((u) => u.isActive)
      .map((u) => [u.id, `${u.fullName} · ${names[u.role] || u.role}`]);
  const employeeName = (id) =>
    employees.find((u) => u.id === id)?.fullName ||
    (id === user.id ? user.fullName : `Nhân viên #${id}`);
  const button = (action, title, id = "", extra = "") =>
    `<button class="btn btn-sm" data-ops="${action}" data-id="${id}" ${extra}>${title}</button>`;
  const table = (heads, rows) =>
    `<div class="table-responsive"><table><thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("") || `<tr><td colspan="${heads.length}">Chưa có dữ liệu.</td></tr>`}</tbody></table></div>`;
  const heading = (title, text) =>
    `<div class="section-heading"><div><p class="eyebrow">${e(names[user.role])} · CÔNG VIỆC</p><h1>${title}</h1><p class="section-description">${text}</p></div></div>`;
  function render() {
    if (hosts.financeOps)
      hosts.financeOps.innerHTML =
        heading(
          "Đề nghị chi & Sổ thu",
          "Tách người lập và người duyệt. Ghi nhận phương thức, người thu/chi và mã giao dịch.",
        ) +
        `<div class="operations-actions">${button("expense", "＋ Lập đề nghị chi")}</div><div class="care-summary"><div class="card"><strong>${expenses.filter((x) => x.status === "submitted").length}</strong><span>Đề nghị chờ duyệt</span></div><div class="card"><strong>${money(expenses.filter((x) => x.status === "paid").reduce((s, x) => s + Number(x.amount), 0))}</strong><span>Đã chi trong danh sách</span></div></div><div class="card"><h3>Đề nghị chi</h3>${table(
          ["Chứng từ / Người nhận", "Số tiền", "Trạng thái", "Thao tác"],
          expenses.map(
            (x) =>
              `<tr><td>${e(x.documentNumber)}<small>${e(x.payee)} · ${e(x.note)}</small></td><td>${money(x.amount)}</td><td>${e(labels[x.status])}<small>Người lập #${x.createdBy}${x.approvedBy ? " · Duyệt #" + x.approvedBy : ""}</small></td><td>${x.status === "submitted" ? (user.role === "admin" && x.createdBy !== user.id ? button("approveExpense", "Duyệt chi", x.id) : "") + (x.createdBy === user.id || user.role === "admin" ? button("cancelExpense", "Hủy đề nghị", x.id) : "") : x.status === "approved" ? button("payExpense", "Ghi chi tiền", x.id) : ""}</td></tr>`,
          ),
        )}</div><div class="card"><h3>Sổ phiếu thu có người nhận</h3><p class="panel-note">Thu đủ tiền tại mục Thu tiền. Phiếu đã thu trước nâng cấp giữ lịch sử cũ, không tự tạo thông tin người nhận hay phương thức. Danh sách tối đa 1.000 bản ghi gần nhất.</p>${table(
          [
            "Phiếu thu / Phiếu sửa",
            "Số tiền",
            "Phương thức / Giao dịch",
            "Người thu / Thời điểm",
          ],
          receipts.map(
            (x) =>
              `<tr><td>PT-${x.id} / #${x.ticketId}</td><td>${money(x.amount)}</td><td>${e(labels[x.method])}<small>${e(x.reference || "—")}</small></td><td>#${x.receivedBy}<small>${e(formatDate(x.createdAt))}</small></td></tr>`,
          ),
        )}</div>`;
    if (hosts.hrOps)
      hosts.hrOps.innerHTML =
        heading(
          "Phân ca & Năng lực kỹ thuật",
          "Ca làm không trùng lịch nghỉ được duyệt. Hồ sơ đào tạo có đơn vị cấp, số chứng chỉ và thời hạn.",
        ) +
        `<div class="operations-actions">${button("shift", "＋ Phân ca")}${button("certificate", "＋ Xác minh chứng chỉ")}</div><div class="card"><h3>Lịch phân ca</h3>${shiftTable(operations.shifts)}</div><div class="card"><h3>Chứng chỉ đã xác minh</h3><p class="panel-note">Hồ sơ an toàn EV còn hiệu lực là một điều kiện kiểm soát công việc cao áp; garage vẫn phải xác minh năng lực và quy trình an toàn thực tế.</p>${table(
          ["Nhân viên", "Năng lực / Đơn vị cấp", "Số chứng chỉ", "Thời hạn"],
          operations.certificates.map(
            (x) =>
              `<tr><td>${e(employeeName(x.userId))}</td><td>${e(labels[x.kind])}<small>${e(x.issuer)}</small></td><td>${e(x.certificateNumber)}</td><td>${e(x.validFrom)} → ${e(x.validUntil)}${x.status === "revoked" ? "<small>Đã thu hồi · " + e(x.revokeReason) + "</small>" : button("revokeCertificate", "Thu hồi", x.id)}<small>${x.validUntil < new Date().toLocaleDateString("en-CA") ? "Cần kiểm tra hết hạn" : "Theo thời hạn hồ sơ"}</small></td></tr>`,
          ),
        )}</div><div class="card"><h3>Yêu cầu nghỉ phép</h3>${leaveTable(operations.leave)}</div>`;
    if (hosts.myWork)
      hosts.myWork.innerHTML =
        heading(
          "Lịch làm & Nghỉ phép của tôi",
          "Xem lịch đã phân công và theo dõi yêu cầu nghỉ của chính bạn.",
        ) +
        `<div class="operations-actions">${button("leave", "＋ Gửi yêu cầu nghỉ")}</div><div class="card"><h3>Ca của tôi</h3>${shiftTable(
          operations.shifts.filter((x) => x.userId === user.id),
          false,
        )}</div><div class="card"><h3>Yêu cầu của tôi</h3>${leaveTable(
          operations.leave.filter((x) => x.userId === user.id),
          false,
        )}</div>`;
    if (hosts.advisorOps)
      hosts.advisorOps.innerHTML =
        heading(
          "Chăm sóc sau bàn giao",
          "Theo dõi phản hồi, hẹn gọi lại và ghi nhận yêu cầu kiểm tra lại sau sửa.",
        ) +
        `<div class="card"><h3>Xe đã bàn giao qua lượt dịch vụ</h3>${table(
          ["Lượt / Biển số", "Nghiệm thu", "Phản hồi gần nhất", "Thao tác"],
          visits
            .filter(
              (v) =>
                v.vehicleStatus === "delivered" && v.ticketStatus === "paid",
            )
            .map((v) => {
              const last = followups.find((x) => x.visitId === v.id);
              return `<tr><td>#${v.id} · ${e(v.licensePlate)}</td><td>${e(formatDate(v.qcAt))}</td><td>${last ? e(labels[last.outcome]) + "<small>" + e(last.note) + (last.nextContactOn ? " · Gọi lại " + e(last.nextContactOn) : "") + "</small>" : "Chưa ghi nhận"}</td><td>${button("followup", "Ghi phản hồi", v.id)}${v.ticketId ? button("gallery", "Xem bằng chứng", v.ticketId) : ""}</td></tr>`;
            }),
        )}</div>`;
  }
  function shiftTable(rows, manage = true) {
    return table(
      ["Nhân viên / Vị trí", "Bắt đầu – Kết thúc", "Trạng thái", "Thao tác"],
      rows.map(
        (x) =>
          `<tr><td>${e(employeeName(x.userId))}<small>${e(x.bay)} · ${e(x.note)}</small></td><td>${e(Garage.date(x.startsAt)?.toLocaleString("vi-VN"))}<small>${e(Garage.date(x.endsAt)?.toLocaleString("vi-VN"))}</small></td><td>${e(labels[x.status])}</td><td>${manage && allowed("hr") && x.status === "scheduled" ? button("cancelShift", "Hủy phân ca", x.id) : "—"}</td></tr>`,
      ),
    );
  }
  function leaveTable(rows, manage = true) {
    return table(
      [
        "Nhân viên",
        "Khoảng nghỉ",
        "Lý do / Quyết định",
        "Trạng thái / Thao tác",
      ],
      rows.map(
        (x) =>
          `<tr><td>${e(employeeName(x.userId))}</td><td>${e(x.fromDate)} → ${e(x.toDate)}</td><td>${e(x.reason)}<small>${e(x.decisionNote || "")}</small></td><td>${e(labels[x.status])}${manage && allowed("hr") && x.userId !== user.id && x.status === "pending" ? button("approveLeave", "Duyệt", x.id) + button("rejectLeave", "Từ chối", x.id) : ""}</td></tr>`,
      ),
    );
  }
  async function load(context = {}) {
    const guard = Garage.refreshGuard(context);
    if (busy) return;
    busy = true;
    try {
      const requests = [Garage.request("/hr/operations")];
      if (hosts.financeOps)
        requests.push(
          Garage.request("/finance/expenses"),
          Garage.request("/finance/receipts"),
        );
      if (hosts.hrOps) requests.push(Garage.request("/service/employees"));
      if (hosts.advisorOps)
        requests.push(
          Garage.request("/service/visits"),
          Garage.request("/advisor/followups"),
        );
      const values = await Promise.all(requests);
      if (!guard()) return;
      operations = values.shift();
      if (hosts.financeOps)
        [expenses, receipts] = [values.shift(), values.shift()];
      if (hosts.hrOps) employees = values.shift();
      if (hosts.advisorOps)
        [visits, followups] = [values.shift(), values.shift()];
      render();
    } catch (err) {
      if (!context.background)
        Object.values(hosts).forEach((h) => {
          h.innerHTML = `<p class="inline-message error" role="alert">${e(err.message)}</p>`;
        });
    } finally {
      busy = false;
    }
  }
  function dialog(title, body, save) {
    const d = document.createElement("dialog");
    d.className = "care-dialog";
    d.innerHTML = `<div class="card-heading"><h3>${title}</h3><button class="btn-icon" data-close aria-label="Đóng">×</button></div><form>${body}<p class="care-error text-red" role="alert"></p><button class="btn btn-primary" type="submit">Xác nhận</button></form>`;
    document.body.append(d);
    d.querySelector("[data-close]").onclick = () => d.close();
    d.onclose = () => d.remove();
    d.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      const btn = event.target.querySelector("[type=submit]");
      if (btn.disabled || !event.target.reportValidity()) return;
      btn.disabled = true;
      try {
        await save(Object.fromEntries(new FormData(event.target)));
        d.close();
        await load();
      } catch (err) {
        d.querySelector(".care-error").textContent = err.message;
      } finally {
        btn.disabled = false;
      }
    };
    d.showModal();
  }
  document.addEventListener("click", async (event) => {
    const b = event.target.closest("[data-ops]");
    if (!b) return;
    const action = b.dataset.ops,
      id = b.dataset.id;
    const post = (url, body) => Garage.request(url, { method: "POST", body });
    if (action === "gallery") return Garage.openEvidence(Number(id));
    if (action === "expense")
      return dialog(
        "Lập đề nghị chi",
        select("Nhóm chi", "category", [
          ["parts", "Phụ tùng"],
          ["tools", "Dụng cụ"],
          ["rent", "Thuê mặt bằng"],
          ["utilities", "Điện / nước"],
          ["other", "Khác"],
        ]) +
          field("Người nhận / Nhà cung cấp", "payee") +
          field("Số chứng từ / hóa đơn", "documentNumber") +
          field(
            "Số tiền (đ)",
            "amount",
            "number",
            'required min="1" step="0.01"',
          ) +
          note(),
        (f) => post("/finance/expenses", { ...f, amount: Number(f.amount) }),
      );
    if (action === "payExpense")
      return dialog(
        "Ghi nhận chi tiền",
        select("Phương thức", "method", [
          ["cash", "Tiền mặt"],
          ["bank", "Chuyển khoản"],
          ["card", "Thẻ"],
        ]) +
          field(
            "Mã giao dịch (bắt buộc với ngân hàng/thẻ)",
            "reference",
            "text",
            'maxlength="100"',
          ),
        (f) => post(`/finance/expenses/${id}/pay`, f),
      );
    if (action === "shift")
      return dialog(
        "Phân ca nhân viên",
        select("Nhân viên", "userId", staffOptions()) +
          field("Bắt đầu (giờ Việt Nam)", "startsAt", "datetime-local") +
          field("Kết thúc (giờ Việt Nam)", "endsAt", "datetime-local") +
          field("Vị trí / Khu vực / Khoang", "bay") +
          note(),
        (f) =>
          post("/hr/shifts", {
            ...f,
            userId: Number(f.userId),
            startsAt: f.startsAt + ":00+07:00",
            endsAt: f.endsAt + ":00+07:00",
          }),
      );
    if (action === "certificate")
      return dialog(
        "Xác minh hồ sơ đào tạo",
        select(
          "Nhân viên",
          "userId",
          staffOptions().filter(([uid]) => uid !== user.id),
        ) +
          select(
            "Năng lực",
            "kind",
            Object.keys(labels)
              .filter((k) =>
                [
                  "ev_safety",
                  "diagnostics",
                  "air_conditioning",
                  "bodywork",
                  "other",
                ].includes(k),
              )
              .map((k) => [k, labels[k]]),
          ) +
          field("Đơn vị cấp", "issuer") +
          field("Số chứng chỉ / hồ sơ", "certificateNumber") +
          field("Hiệu lực từ", "validFrom", "date") +
          field("Hiệu lực đến", "validUntil", "date"),
        (f) => post("/hr/certificates", { ...f, userId: Number(f.userId) }),
      );
    if (action === "leave")
      return dialog(
        "Yêu cầu nghỉ phép",
        field("Từ ngày", "fromDate", "date") +
          field("Đến ngày", "toDate", "date") +
          note("reason", "Lý do nghỉ"),
        (f) => post("/hr/leave", f),
      );
    if (action === "revokeCertificate")
      return dialog("Thu hồi chứng chỉ", note(), (f) =>
        post(`/hr/certificates/${id}/revoke`, { ...f, approved: false }),
      );
    if (action === "approveLeave" || action === "rejectLeave")
      return dialog("Xử lý yêu cầu nghỉ", note(), (f) =>
        post(`/hr/leave/${id}/decide`, {
          ...f,
          approved: action === "approveLeave",
        }),
      );
    if (action === "followup")
      return dialog(
        "Ghi nhận phản hồi sau sửa",
        select("Kết quả liên hệ", "outcome", [
          ["satisfied", "Hài lòng"],
          ["no_answer", "Chưa liên hệ được"],
          ["needs_rework", "Cần kiểm tra lại"],
        ]) +
          field(
            "Đánh giá 1–5 (nếu có)",
            "rating",
            "number",
            'min="1" max="5"',
          ) +
          field("Ngày liên hệ tiếp theo", "nextContactOn", "date", "") +
          note(),
        (f) =>
          post(`/advisor/visits/${id}/followup`, {
            ...f,
            rating: Number(f.rating) || null,
            nextContactOn: f.nextContactOn || null,
          }),
      );
    const paths = {
      approveExpense: `/finance/expenses/${id}/approve`,
      cancelExpense: `/finance/expenses/${id}/cancel`,
      cancelShift: `/hr/shifts/${id}/cancel`,
    };
    if (paths[action] && confirm("Xác nhận thao tác này?")) {
      b.disabled = true;
      try {
        await post(paths[action]);
        await load();
      } catch (err) {
        Garage.toast(err.message, "error");
      } finally {
        b.disabled = false;
      }
    }
  });
  Garage.subscribe(load);
  load();
});
