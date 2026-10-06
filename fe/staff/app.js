/* Separate staff portal: no account administration is exposed to HR/accountants. */
document.addEventListener("DOMContentLoaded", async () => {
  const user = await Garage.permissionsReady,
    names = { advisor: "Cố vấn dịch vụ", accountant: "Kế toán", hr: "Nhân sự" };
  if (!localStorage.getItem("token") || !names[user.role]) {
    location.replace("/login");
    return;
  }
  const expectedRole = document.body.dataset.staffRole;
  if (expectedRole && user.role !== expectedRole) {
    location.replace("/" + user.role);
    return;
  }
  const defaults = {
    advisor: ["reception", "workshop", "maintenance"],
    accountant: ["finance", "reports"],
    hr: ["hr"],
  };
  let allowed = defaults[user.role].filter(
    (p) => !(user.disabledPermissions || []).includes(p),
  );
  const esc = Garage.escape,
    money = (v) =>
      new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
      }).format(Number(v) || 0);
  for (const [id, p] of [
    ["serviceWorkspace", "workshop"],
    ["maintenanceWorkspace", "maintenance"],
  ])
    if (!allowed.includes(p)) document.getElementById(id)?.remove();
  function navigation() {
    document.querySelectorAll(".nav-item").forEach((n) => {
      n.hidden = !allowed.includes(n.dataset.permission);
    });
    Garage.initPortal(user.role);
    document
      .querySelectorAll(".nav-item[hidden]")
      .forEach((n) => (n.disabled = true));
    (
      document.querySelector(".nav-item.active:not([hidden])") ||
      document.querySelector(".nav-item:not([hidden])")
    )?.click();
    if (!allowed.length) {
      document.getElementById("staffError").hidden = false;
      document.getElementById("staffError").textContent =
        "Các chức năng của bạn đã bị khóa. Liên hệ quản trị viên.";
    }
  }
  document.querySelector(".user-info h4").textContent = user.fullName;
  document.getElementById("staffRole").textContent = names[user.role];
  document.getElementById("logoutBtn").onclick = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    location.replace("/login");
  };
  navigation();
  let vehicles = [],
    bookings = [],
    customers = [],
    catalog = { brands: [] },
    tickets = [],
    visits = [],
    employees = [];
  function dialog(title, body, save) {
    const d = document.createElement("dialog");
    d.className = "care-dialog";
    d.innerHTML = `<div class="card-heading"><h3>${esc(title)}</h3><button class="btn-icon" data-close aria-label="Đóng">×</button></div><form>${body}<p class="care-error text-red" role="alert"></p><button class="btn btn-primary" type="submit">Lưu</button></form>`;
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
      } catch (err) {
        d.querySelector(".care-error").textContent = err.message;
      } finally {
        btn.disabled = false;
      }
    };
    d.showModal();
    return d;
  }
  const field = (label, name, value = "", type = "text", extra = "") =>
    `<label class="form-group">${label}<input name="${name}" type="${type}" value="${esc(value ?? "")}" ${extra}></label>`;
  function reception() {
    const h = document.getElementById("staffReception");
    h.innerHTML = `<div class="section-heading"><div><p class="eyebrow">CỐ VẤN / TIẾP NHẬN</p><h1>Tiếp nhận & Lịch hẹn</h1><p class="section-description">Liên kết đúng tài khoản khách, kiểm tra đầu vào và điều phối vào xưởng.</p></div><button class="btn btn-primary" data-staff="intake">＋ Tiếp nhận xe</button></div><div class="card"><h3>Xe trong garage</h3><div class="table-responsive"><table><thead><tr><th>Biển số / Xe</th><th>Khách / Điện thoại</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${vehicles.map((v) => `<tr><td>${esc(v.licensePlate)}<small>${esc(v.carBrand)} ${esc(v.carModel)}</small></td><td>${esc(v.customerName)}<small>${esc(v.phone)}</small></td><td>${esc(v.status)}</td><td><button class="btn btn-sm" data-staff="edit" data-id="${v.id}">Thông tin / Liên kết</button><button class="btn btn-primary btn-sm" data-staff="service" data-id="${v.id}">Kiểm tra & Báo giá</button>${v.status === "completed" ? `<button class="btn btn-sm" data-staff="deliver" data-id="${v.id}">Giao xe</button>` : v.status === "delivered" ? `<button class="btn btn-sm" data-staff="return" data-id="${v.id}">Tiếp nhận lại</button>` : ""}</td></tr>`).join("") || '<tr><td colspan="4">Chưa có xe.</td></tr>'}</tbody></table></div></div><div class="card"><h3>Yêu cầu đặt lịch</h3><div class="table-responsive"><table><thead><tr><th>Khách / Điện thoại</th><th>Ngày / Dịch vụ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${bookings.map((b) => `<tr><td>${esc(b.customerName)}<small>${esc(b.phone)}</small></td><td>${esc(b.preferredDate)}<small>${esc(b.service)} · ${esc(b.note)}</small></td><td>${esc(b.status)}</td><td>${b.status === "pending" ? `<button class="btn btn-sm" data-staff="booking" data-id="${b.id}" data-status="confirmed">Xác nhận</button><button class="btn btn-sm" data-staff="booking" data-id="${b.id}" data-status="cancelled">Hủy</button>` : ""}</td></tr>`).join("") || '<tr><td colspan="4">Chưa có lịch hẹn.</td></tr>'}</tbody></table></div></div>`;
  }
  function vehicleForm(v = null) {
    const d = dialog(
      v ? "Thông tin xe · " + v.licensePlate : "Tiếp nhận xe",
      `<label class="form-group">Tài khoản khách<select name="customerId"><option value="">Khách vãng lai / chưa liên kết</option>${customers.map((c) => `<option value="${c.id}" ${v?.customerId === c.id ? "selected" : ""}>${esc(c.fullName)} · ${esc(c.email)}</option>`).join("")}</select></label><div class="form-grid">${field("Tên khách", "customerName", v?.customerName, "text", "required")}${field("Điện thoại", "phone", v?.phone, "tel", "required")}${field("Biển số", "licensePlate", v?.licensePlate, "text", "required")}${field("Hãng xe", "carBrand", v?.carBrand, "text", 'required list="staffBrands"')}${field("Dòng xe / tên khác", "carModel", v?.carModel, "text", 'list="staffModels"')}${field("Địa chỉ", "address", v?.address)}</div><datalist id="staffBrands">${catalog.brands.map((b) => `<option value="${esc(b.brand)}">`).join("")}</datalist><datalist id="staffModels"></datalist><p class="field-help">Chọn hãng để nhận gợi ý dòng xe; có thể điền dòng khác. Chỉ liên kết sau khi xác nhận đúng chủ xe.</p>`,
      (f) => {
        const body = Object.fromEntries(new FormData(f));
        body.customerId = Number(body.customerId) || null;
        return Garage.request("/vehicles" + (v ? "/" + v.id : ""), {
          method: v ? "PUT" : "POST",
          body,
        });
      },
    );
    d.querySelector("[name=carBrand]").oninput = (e) => {
      const brand = catalog.brands.find(
        (b) => b.brand.toLowerCase() === e.target.value.toLowerCase(),
      );
      d.querySelector("#staffModels").innerHTML = (brand?.models || [])
        .map((m) => `<option value="${esc(m)}">`)
        .join("");
    };
    d.querySelector("[name=customerId]").onchange = (e) => {
      const c = customers.find((c) => c.id === Number(e.target.value));
      if (c) d.querySelector("[name=customerName]").value = c.fullName;
    };
  }
  function finance() {
    const h = document.getElementById("staffFinance"),
      pending = tickets.filter((t) => t.status === "completed"),
      paid = tickets.filter((t) => t.status === "paid");
    h.innerHTML = `<div class="section-heading"><div><p class="eyebrow">KẾ TOÁN / THU TIỀN</p><h1>Thu tiền & Lịch sử thanh toán</h1><p class="section-description">Phiếu qua luồng báo giá phải được nghiệm thu trước khi thu tiền. Hệ thống ghi nhận thanh toán toàn bộ tại garage.</p></div></div><div class="care-summary"><div class="card"><strong>${pending.length}</strong><span>Phiếu chờ thu</span></div><div class="card"><strong>${money(pending.reduce((s, t) => s + t.totalAmount, 0))}</strong><span>Chưa thu</span></div><div class="card"><strong>${money(paid.reduce((s, t) => s + t.totalAmount, 0))}</strong><span>Đã thu</span></div></div><div class="card"><div class="table-responsive"><table><thead><tr><th>Phiếu / Xe</th><th>Tổng tiền</th><th>Nghiệm thu</th><th>Thanh toán</th><th>Thao tác</th></tr></thead><tbody>${
      [...pending, ...paid]
        .map((t) => {
          const v = visits.find((v) => v.id === t.serviceVisitId),
            ready = !t.serviceVisitId || t.qcAt || v?.qcAt;
          return `<tr><td>#${t.id} · ${esc(t.vehicle?.licensePlate)}</td><td>${money(t.totalAmount)}</td><td>${t.serviceVisitId ? (ready ? "Đã nghiệm thu" : "Chờ nghiệm thu") : "Phiếu cũ"}</td><td>${t.status === "paid" ? "Đã thu · " + esc(t.paidAt || "") : "Chưa thu"}</td><td>${t.status === "completed" ? `<button class="btn btn-primary btn-sm" data-staff="pay" data-id="${t.id}" ${ready ? "" : "disabled"}>Thu toàn bộ</button>` : ""}<button class="btn btn-sm" data-staff="receipt" data-id="${t.id}">Chi tiết</button></td></tr>`;
        })
        .join("") ||
      '<tr><td colspan="5">Không có phiếu cần thu tiền.</td></tr>'
    }</tbody></table></div></div>`;
  }
  function hr() {
    document.getElementById("staffHR").innerHTML =
      `<div class="section-heading"><div><p class="eyebrow">NHÂN SỰ / HỒ SƠ</p><h1>Hồ sơ nhân sự</h1><p class="section-description">Quản lý liên hệ, vị trí và ngày vào làm. Tài khoản và quyền truy cập do quản trị viên cấp.</p></div></div><div class="card"><div class="table-responsive"><table><thead><tr><th>Nhân viên</th><th>Vai trò / Bộ phận</th><th>Điện thoại</th><th>Ngày vào làm</th><th>Thao tác</th></tr></thead><tbody>${employees.map((u) => `<tr><td>${esc(u.fullName)}<small>${esc(u.email)} · ${u.isActive ? "Hoạt động" : "Đã khóa"}</small></td><td>${esc(names[u.role] || { mechanic: "Kỹ thuật viên", admin: "Quản trị viên" }[u.role] || u.role)}<small>${esc(u.profile?.department || "Chưa nhập")} · ${esc(u.profile?.jobTitle || "")}</small></td><td>${esc(u.profile?.phone || "—")}</td><td>${esc(u.profile?.startDate || "—")}</td><td><button class="btn btn-sm" data-staff="employee" data-id="${u.id}">Cập nhật hồ sơ</button></td></tr>`).join("") || '<tr><td colspan="5">Chưa có nhân viên.</td></tr>'}</tbody></table></div></div>`;
  }
  async function load(context = {}) {
    const guard = Garage.refreshGuard(context);
    try {
      if (allowed.includes("reception")) {
        const vals = await Promise.all([
          Garage.request("/vehicles"),
          Garage.request("/bookings"),
          Garage.request("/auth/customer-lookup"),
          Garage.request("/maintenance/catalog"),
        ]);
        if (guard()) {
          [vehicles, bookings, customers, catalog] = vals;
          reception();
        }
      }
      if (allowed.includes("finance")) {
        const vals = await Promise.all([
          Garage.request("/repairs"),
          Garage.request("/service/visits"),
        ]);
        if (guard()) {
          [tickets, visits] = vals;
          finance();
        }
      }
      if (allowed.includes("hr")) {
        const rows = await Garage.request("/service/employees");
        if (guard()) {
          employees = rows;
          hr();
        }
      }
    } catch (e) {
      if (!context.background) {
        document.getElementById("staffError").hidden = false;
        document.getElementById("staffError").textContent = e.message;
      }
    }
  }
  const report = document.getElementById("staffReport");
  if (allowed.includes("reports")) {
    report.innerHTML =
      '<div class="section-heading"><div><p class="eyebrow">KẾ TOÁN / BÁO CÁO</p><h1>Doanh thu đã thu</h1></div></div><div class="card"><form id="staffReportForm" class="toolbar"><label>Năm<input name="year" type="number" min="2000" max="2100" value="' +
      new Date().getFullYear() +
      '" required></label><label>Tháng / Quý<select name="period"><option value="year">Cả năm</option>' +
      [1, 2, 3, 4]
        .map((q) => '<option value="q' + q + '">Quý ' + q + "</option>")
        .join("") +
      Array.from(
        { length: 12 },
        (_, i) =>
          '<option value="' + (i + 1) + '">Tháng ' + (i + 1) + "</option>",
      ).join("") +
      '</select></label><button class="btn btn-primary" type="submit">Xem báo cáo</button></form><div id="staffRevenue"></div></div>';
    report.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target,
        btn = f.querySelector("button");
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        const year = Number(f.elements.year.value),
          period = f.elements.period.value,
          months =
            period === "year"
              ? Array.from({ length: 12 }, (_, i) => i + 1)
              : period.startsWith("q")
                ? [1, 2, 3].map((i) => (Number(period.slice(1)) - 1) * 3 + i)
                : [Number(period)];
        const rows = await Promise.all(
          months.map(async (m) => ({
            month: m,
            rows: await Garage.request(
              "/reports/revenue?month=" +
                year +
                "-" +
                String(m).padStart(2, "0"),
            ),
          })),
        );
        const totals = rows.map((r) => ({
            ...r,
            total: r.rows.reduce((s, v) => s + v.revenue, 0),
          })),
          max = Math.max(1, ...totals.map((r) => r.total));
        document.getElementById("staffRevenue").innerHTML =
          '<div class="care-list" role="img" aria-label="Doanh thu theo tháng">' +
          totals
            .map(
              (r) =>
                `<div><div class="summary-row"><span>Tháng ${r.month}</span><strong>${money(r.total)}</strong></div><div style="height:12px;background:#eef2ff;border-radius:6px"><div style="height:12px;width:${(r.total / max) * 100}%;background:#4f46e5;border-radius:6px"></div></div></div>`,
            )
            .join("") +
          "</div><p><strong>Tổng: " +
          money(totals.reduce((s, r) => s + r.total, 0)) +
          '</strong></p><p class="panel-note">Tính theo thời điểm thu tiền, múi giờ Việt Nam; không cộng phiếu chưa thanh toán.</p>';
      } catch (err) {
        Garage.toast(err.message, "error");
      } finally {
        btn.disabled = false;
      }
    };
    report
      .querySelector("form")
      .dispatchEvent(new Event("submit", { cancelable: true }));
  }
  document.querySelector("main").onclick = async (e) => {
    const btn = e.target.closest("[data-staff]");
    if (!btn) return;
    const a = btn.dataset.staff,
      id = Number(btn.dataset.id);
    if (a === "intake") return vehicleForm();
    if (a === "edit") return vehicleForm(vehicles.find((v) => v.id === id));
    if (a === "service") {
      document.querySelector('[data-target="service-section"]').click();
      return;
    }
    if (a === "employee") {
      const u = employees.find((u) => u.id === id),
        p = u.profile || {};
      return dialog(
        "Hồ sơ · " + u.fullName,
        `<div class="form-grid">${field("Điện thoại", "phone", p.phone, "tel")}${field("Bộ phận", "department", p.department, "text", "required")}${field("Vị trí", "jobTitle", p.jobTitle, "text", "required")}${field("Ngày vào làm", "startDate", p.startDate, "date", "required")}</div><label class="form-group">Ghi chú<textarea name="note" rows="3" maxlength="2000">${esc(p.note || "")}</textarea></label>`,
        (f) =>
          Garage.request("/service/employees/" + id, {
            method: "PUT",
            body: Object.fromEntries(new FormData(f)),
          }),
      );
    }
    if (a === "pay") {
      const ticket = tickets.find((t) => t.id === id);
      return dialog(
        "Thu đủ tiền · Phiếu #" + id,
        `<p>Tổng tiền: <strong>${money(ticket.totalAmount)}</strong></p><label class="form-group">Phương thức<select name="paymentMethod"><option value="cash">Tiền mặt</option><option value="bank">Chuyển khoản</option><option value="card">Thẻ</option></select></label><label class="form-group">Mã giao dịch (bắt buộc với ngân hàng/thẻ)<input name="paymentReference" maxlength="100"></label><p class="field-help">Chỉ xác nhận sau khi thực tế nhận đủ tiền. Phiếu thu lưu người nhận và thời điểm.</p>`,
        (f) =>
          Garage.request("/repairs/" + id, {
            method: "PUT",
            body: { status: "paid", ...Object.fromEntries(new FormData(f)) },
          }),
      );
    }
    if (a === "receipt") {
      const t = tickets.find((t) => t.id === id);
      return dialog(
        "Chi tiết phiếu #" + id,
        `<p>${esc(t.vehicle?.licensePlate)} · ${money(t.totalAmount)} · ${t.status === "paid" ? "Đã thu" : "Chưa thu"}</p><div class="table-responsive"><table><thead><tr><th>Công việc / Vật tư</th><th>SL</th><th>Vật tư</th><th>Tiền công</th><th>Tổng</th></tr></thead><tbody>${t.items.map((i) => `<tr><td>${esc(i.taskName)}<small>${esc(i.partName)}</small></td><td>${i.quantity}</td><td>${money(i.partPrice)}</td><td>${money(i.laborPrice)}</td><td>${money(i.totalPrice)}</td></tr>`).join("")}</tbody></table></div>`,
        () => Promise.resolve(),
      );
    }
    if (
      a === "pay" &&
      !confirm(
        "Đã nhận đủ " +
          money(tickets.find((t) => t.id === id).totalAmount) +
          " cho phiếu #" +
          id +
          "?",
      )
    )
      return;
    if (["pay", "deliver", "return", "booking"].includes(a)) {
      btn.disabled = true;
      try {
        await Garage.request(
          a === "pay"
            ? "/repairs/" + id
            : a === "booking"
              ? "/bookings/" + id
              : "/vehicles/" + id,
          {
            method: "PUT",
            body: {
              status:
                a === "pay"
                  ? "paid"
                  : a === "deliver"
                    ? "delivered"
                    : a === "return"
                      ? "waiting"
                      : btn.dataset.status,
            },
          },
        );
        await load();
      } catch (err) {
        Garage.toast(err.message, "error");
      } finally {
        btn.disabled = false;
      }
    }
  };
  document.getElementById("staffRefresh").onclick = () => {
    load();
    Garage.changed();
  };
  Garage.subscribe(load);
  Promise.resolve(user)
    .then((me) => {
      localStorage.setItem("user", JSON.stringify(me));
      allowed = defaults[me.role].filter(
        (p) => !(me.disabledPermissions || []).includes(p),
      );
      document.querySelectorAll(".nav-item").forEach((n) => {
        n.hidden = !allowed.includes(n.dataset.permission);
        n.disabled = n.hidden;
      });
      document.querySelector(".nav-item:not([hidden])")?.click();
      return load();
    })
    .catch((e) => {
      document.getElementById("staffError").hidden = false;
      document.getElementById("staffError").textContent = e.message;
    });
});
