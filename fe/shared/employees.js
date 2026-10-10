document.addEventListener("DOMContentLoaded", async () => {
  if (Garage.whenAllowed && !(await Garage.whenAllowed("hr"))) return;
  const host = document.getElementById("employeeWorkspace");
  if (!host) return;
  const esc = Garage.escape;
  let users = [];
  async function load(context = {}) {
    const guard = Garage.refreshGuard(context);
    try {
      const data = await Garage.request("/service/employees");
      if (!guard() || !Array.isArray(data)) return;
      users = data;
      host.innerHTML = `<div class="card"><div class="card-heading"><h3>Hồ sơ các vị trí trong garage</h3></div><p class="panel-note">Thông tin nhân sự cho cố vấn, thợ, kế toán, nhân sự và quản trị. Vai trò, khóa tài khoản và quyền truy cập được quản lý tại bảng tài khoản.</p><div class="table-responsive"><table data-page-size="8"><thead><tr><th>Nhân viên</th><th>Vị trí / Bộ phận</th><th>Điện thoại</th><th>Ngày vào làm</th><th>Thao tác</th></tr></thead><tbody>${users.map((u) => `<tr><td>${esc(u.fullName)}<small>${esc(u.email)}</small></td><td>${esc(u.profile?.jobTitle || u.role)}<small>${esc(u.profile?.department || "Chưa có hồ sơ")}</small></td><td>${esc(u.profile?.phone || "—")}</td><td>${esc(u.profile?.startDate || "—")}</td><td><button class="btn btn-sm" data-employee="${u.id}">Cập nhật hồ sơ</button></td></tr>`).join("") || '<tr><td colspan="5">Chưa có nhân viên.</td></tr>'}</tbody></table></div></div>`;
    } catch (e) {
      if (!context.background) Garage.toast(e.message, "error");
    }
  }
  host.onclick = (e) => {
    const btn = e.target.closest("[data-employee]");
    if (!btn) return;
    const u = users.find((u) => u.id === Number(btn.dataset.employee)),
      p = u.profile || {};
    const d = document.createElement("dialog");
    d.className = "care-dialog";
    d.innerHTML = `<div class="card-heading"><h3>Hồ sơ · ${esc(u.fullName)}</h3><button data-close class="btn-icon" aria-label="Đóng">×</button></div><form><div class="form-grid">${[
      ["phone", "Điện thoại", "tel"],
      ["department", "Bộ phận", "text"],
      ["jobTitle", "Vị trí", "text"],
      ["startDate", "Ngày vào làm", "date"],
    ]
      .map(
        ([k, n, t]) =>
          `<label class="form-group">${n}<input name="${k}" type="${t}" value="${esc(p[k] || "")}" ${k === "phone" ? "" : "required"}></label>`,
      )
      .join(
        "",
      )}</div><label class="form-group">Ghi chú<textarea name="note" maxlength="2000" rows="3">${esc(p.note || "")}</textarea></label><p class="care-error text-red" role="alert"></p><button type="submit" class="btn btn-primary">Lưu hồ sơ</button></form>`;
    document.body.append(d);
    d.querySelector("[data-close]").onclick = () => d.close();
    d.onclose = () => d.remove();
    d.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const b = e.target.querySelector("button");
      if (b.disabled || !e.target.reportValidity()) return;
      b.disabled = true;
      try {
        await Garage.request("/service/employees/" + u.id, {
          method: "PUT",
          body: Object.fromEntries(new FormData(e.target)),
        });
        d.close();
        await load();
      } catch (err) {
        d.querySelector(".care-error").textContent = err.message;
      } finally {
        b.disabled = false;
      }
    };
    d.showModal();
  };
  Garage.subscribe(load);
  load();
});
