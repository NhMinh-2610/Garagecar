/* Maintenance workspace shared by admin, service advisors, customers and mechanics. */
document.addEventListener("DOMContentLoaded", async () => {
  if (Garage.whenAllowed && !(await Garage.whenAllowed("maintenance"))) return;
  const host = document.getElementById("maintenanceWorkspace");
  if (!host) return;
  const esc = Garage.escape,
    user = JSON.parse(localStorage.getItem("user") || "{}"),
    staff = ["admin", "advisor"].includes(user.role);
  const actionNames = {
    inspect: "Kiểm tra",
    replace: "Thay thế",
    clean: "Vệ sinh",
    rotate: "Đảo lốp",
    lubricate: "Bôi trơn",
  };
  const states = {
    due: "Đến / quá hạn",
    soon: "Sắp đến hạn",
    ok: "Trong hạn",
    needs_review: "Cần xác minh mốc lặp",
    needs_odometer: "Cần cập nhật ODO",
  };
  let catalog = { components: [], brands: [], presets: [] },
    vehicles = [],
    profiles = [],
    reminders = [],
    selected = "",
    data = null;
  const componentName = (code) => catalog.components.find((c) => c.code === code)?.name || code;
  const options = (rows, key = "id", label = "title") =>
    rows.map((r) => `<option value="${esc(r[key])}">${esc(r[label])}</option>`).join("");
  const safeLink = (url) => {
    try {
      const u = new URL(url);
      return ["https:", "http:"].includes(u.protocol) ? esc(u.href) : "#";
    } catch {
      return "#";
    }
  };
  function modal(title, body, onSubmit) {
    const dialog = document.createElement("dialog");
    dialog.className = "care-dialog";
    dialog.innerHTML = `<div class="card-heading"><h3>${esc(title)}</h3><button class="btn-icon" data-close aria-label="Đóng">×</button></div><form>${body}<p class="care-error text-red" role="alert"></p><div class="form-actions"><button class="btn btn-primary" type="submit">Lưu</button></div></form>`;
    document.body.append(dialog);
    dialog.querySelector("[data-close]").onclick = () => dialog.close();
    dialog.onclose = () => dialog.remove();
    dialog.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("[type=submit]");
      if (btn.disabled || !e.target.reportValidity()) return;
      btn.disabled = true;
      try {
        await onSubmit(e.target, dialog);
        dialog.close();
        await load();
      } catch (error) {
        dialog.querySelector(".care-error").textContent = error.message;
      } finally {
        btn.disabled = false;
      }
    };
    dialog.showModal();
    return dialog;
  }
  const field = (label, name, value = "", type = "text", extra = "") =>
    `<label class="form-group">${label}<input name="${name}" type="${type}" value="${esc(value ?? "")}" ${extra}></label>`;
  const careView = {
    active: "reminders",
    brand: "",
    model: "",
    query: "",
    reminderQuery: "",
    reminderStatus: "all",
    page: 0,
    libraryPage: 0,
    libraryFilter: "",
    historyOpen: false,
  };
  let vehicleRequest = 0;
  function activateCareTab(key, focus = false) {
    careView.active = key;
    host.querySelectorAll("[data-care-tab]").forEach((tab) => {
      const selected = tab.dataset.careTab === key;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    host.querySelectorAll("[data-care-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.carePanel !== key;
    });
  }
  function compactCareWorkspace() {
    const definitions = [
      ["reminders", "Nhắc việc"],
      ["vehicle", "Hồ sơ xe"],
      ...(staff ? [["profiles", "Lịch hãng"]] : []),
      ["library", "Tra cứu bộ phận"],
    ];
    const cards = [...host.children].filter((node) => node.classList.contains("card"));
    const tabs = document.createElement("div");
    tabs.className = "care-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Bảo dưỡng xe");
    host.querySelector(".care-summary").after(tabs);
    definitions.forEach(([key, title], index) => {
      const card = cards[index];
      card.dataset.carePanel = key;
      card.id = `care-${key}-panel`;
      card.setAttribute("role", "tabpanel");
      card.setAttribute("aria-labelledby", `care-${key}-tab`);
      const tab = document.createElement("button");
      tab.type = "button";
      tab.id = `care-${key}-tab`;
      tab.dataset.careTab = key;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", card.id);
      tab.textContent = title;
      tab.onclick = () => activateCareTab(key);
      tabs.append(tab);
    });
    tabs.onkeydown = (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const index = definitions.findIndex(([key]) => key === careView.active);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? definitions.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : -1) + definitions.length) %
              definitions.length;
      activateCareTab(definitions[next][0], true);
    };
    activateCareTab(careView.active);
    const reminderCard = cards[0];
    const toolbar = document.createElement("div");
    toolbar.className = "care-toolbar";
    toolbar.innerHTML = `<label>Tìm nhắc việc<input id="careReminderSearch" type="search" placeholder="Biển số, bộ phận…" value="${esc(careView.reminderQuery)}"></label><label>Thông báo<select id="careReminderStatus"><option value="all">Tất cả thông báo</option><option value="pending">Chờ cố vấn kiểm tra</option><option value="published">Đã gửi cho khách</option></select></label><p class="panel-note" id="careReminderCount" aria-live="polite"></p>`;
    reminderCard.querySelector(".care-list").before(toolbar);
    toolbar.querySelector("select").value = careView.reminderStatus;
    toolbar.querySelector("input").oninput = (event) => {
      careView.reminderQuery = event.target.value;
      careView.page = 0;
      filterReminders();
    };
    toolbar.querySelector("select").onchange = (event) => {
      careView.reminderStatus = event.target.value;
      careView.page = 0;
      filterReminders();
    };
    const pager = document.createElement("div");
    pager.id = "careReminderPagination";
    pager.className = "care-pagination";
    pager.innerHTML =
      '<button type="button" class="btn btn-sm" data-care-page="previous">Trước</button><span aria-live="polite"></span><button type="button" class="btn btn-sm" data-care-page="next">Sau</button>';
    reminderCard.append(pager);
    pager.onclick = (event) => {
      const button = event.target.closest("[data-care-page]");
      if (!button || button.disabled) return;
      careView.page += button.dataset.carePage === "next" ? 1 : -1;
      filterReminders();
    };
    filterReminders();
  }
  function filterReminders() {
    const rows = [...host.querySelectorAll("[data-care-reminder]")];
    const query = careView.reminderQuery.trim().toLocaleLowerCase("vi-VN");
    const matching = rows.filter(
      (row) =>
        (careView.reminderStatus === "all" || row.dataset.status === careView.reminderStatus) &&
        row.textContent.toLocaleLowerCase("vi-VN").includes(query),
    );
    const pages = Math.max(1, Math.ceil(matching.length / 8));
    careView.page = Math.min(careView.page, pages - 1);
    rows.forEach((row) => {
      row.hidden = true;
    });
    matching.slice(careView.page * 8, (careView.page + 1) * 8).forEach((row) => {
      row.hidden = false;
    });
    host.querySelector("#careReminderCount").textContent = matching.length
      ? `${matching.length} thông báo`
      : "Không có thông báo phù hợp.";
    const pager = host.querySelector("#careReminderPagination");
    pager.hidden = matching.length <= 8;
    pager.querySelector("span").textContent = `Trang ${careView.page + 1} / ${pages}`;
    pager.querySelector('[data-care-page="previous"]').disabled = careView.page === 0;
    pager.querySelector('[data-care-page="next"]').disabled = careView.page >= pages - 1;
  }
  function render() {
    if (host.querySelector("#careSearch")) {
      careView.query = host.querySelector("#careSearch").value;
      careView.brand = host.querySelector("#careBrand").value;
      careView.model = host.querySelector("#careModel")?.value || "";
    }
    host.innerHTML = `<div class="section-heading"><div><p class="eyebrow">CHĂM SÓC XE THEO TÀI LIỆU HÃNG</p><h1>Bảo dưỡng & Nhắc hạn</h1><p class="section-description">Kiểm tra đúng cấu hình xe; hạn theo km hoặc tháng, điều kiện nào đến trước.</p></div>${staff ? '<button class="btn btn-primary" data-care="scan">Kiểm tra nhắc hạn</button>' : ""}</div>
        <div class="care-summary"><div class="card"><strong>${reminders.length}</strong><span>Nhắc hạn đang mở</span></div><div class="card"><strong>${vehicles.length}</strong><span>Xe được phép truy cập</span></div><div class="card"><strong>${catalog.components.length}</strong><span>Bộ phận trong danh mục</span></div></div>
        <div class="card"><div class="card-heading"><h3>${staff ? "Hàng đợi thông báo" : "Thông báo bảo dưỡng"}</h3></div><div class="care-list">${reminders.map((r) => `<article class="care-reminder" data-care-reminder="${r.id}" data-status="${esc(r.status)}"><div><strong>${esc(r.summary.licensePlate)} · ${esc(componentName(r.summary.component))}</strong><p>${esc(actionNames[r.summary.action])} · ${esc(states[r.summary.status])} · ${r.summary.dueKm ?? "—"} km / ${esc(r.summary.dueDate || "—")}</p><small>${esc(r.summary.note || "")} ${r.summary.odometerStale ? "· ODO đã cũ, cần kiểm tra lại." : ""}</small><details class="care-source"><summary>Căn cứ từ tài liệu hãng</summary><p><a href="${safeLink(r.summary.sourceUrl)}" target="_blank" rel="noopener">Tài liệu hãng</a> · ${esc(r.summary.sourcePage)}</p></details></div><div>${staff && r.status === "pending" ? `<button class="btn btn-primary btn-sm" data-care="publish" data-id="${r.id}">Gửi vào app khách</button>` : `<span class="badge">${r.status === "published" ? "Đã gửi" : "Chờ cố vấn kiểm tra"}</span>`}</div></article>`).join("") || '<p class="empty-state">Chưa có thông báo. Lịch chưa xác minh sẽ không tự gửi nhắc hạn.</p>'}</div></div>
        <div class="card"><div class="card-heading"><h3>Hồ sơ & Lịch bảo dưỡng</h3><select id="careVehicle" aria-label="Chọn xe"><option value="">Chọn xe</option>${vehicles.map((v) => `<option value="${v.id}" ${String(v.id) === selected ? "selected" : ""}>${esc(v.licensePlate)} · ${esc(v.carBrand)} ${esc(v.carModel)}</option>`).join("")}</select></div><div id="careVehiclePanel">${vehiclePanel()}</div></div>
        ${staff ? `<div class="card"><div class="card-heading"><h3>Lịch hãng đã nhập</h3><button class="btn btn-primary" data-care="profile">＋ Lập lịch từ tài liệu</button></div><p class="panel-note">Lịch được cố vấn nhập và quản trị xác minh; mỗi lịch khóa theo dòng, năm, động cơ, hộp số và thị trường.</p><div class="care-list">${profiles.map((p) => `<div class="summary-row"><div><strong>${esc(p.title)}</strong><small>${esc(p.scope.brand)} ${esc(p.scope.model)} · ${p.scope.yearFrom}–${p.scope.yearTo} · ${esc(p.scope.engine)} / ${esc(p.scope.gearbox)} · ${esc(p.scope.market)} · ${esc(p.version)}</small></div>${p.status === "draft" && user.role === "admin" ? `<button class="btn btn-sm" data-care="approve" data-id="${p.id}">Xác minh & Kích hoạt</button>` : `<span class="badge">${p.status === "approved" ? "Đã xác minh" : "Bản nháp"}</span>`}</div>`).join("") || "<p>Chưa nhập lịch.</p>"}</div></div>` : ""}
        <div class="card"><div class="card-heading"><h3>Tra cứu bộ phận phổ biến</h3><input id="careSearch" type="search" placeholder="Tìm dầu, bugi, phanh…" aria-label="Tìm bộ phận"></div><label>Hãng xe<select id="careBrand"><option value="">Tất cả hãng</option>${catalog.brands.map((b) => `<option>${esc(b.brand)}</option>`).join("")}</select></label><div id="brandGuidance"></div><div class="component-grid" id="componentLibrary"></div><p class="panel-note">${esc(catalog.policy)}</p></div>`;
    compactCareWorkspace();
    host.querySelector("#careSearch").value = careView.query;
    host.querySelector("#careBrand").value = careView.brand;
    const selectedModel = careView.model;
    const libraryPage = careView.libraryPage;
    library();
    host.querySelector("#careModel").value = selectedModel;
    library();
    careView.libraryPage = libraryPage;
    paginateLibrary();
    host.querySelector("#careVehicle").onchange = async (e) => {
      selected = e.target.value;
      careView.historyOpen = false;
      activateCareTab("vehicle");
      await loadVehicle();
    };
    host.querySelector("#careSearch").oninput = library;
    host.querySelector("#careBrand").onchange = library;
    trackHistory();
  }
  function vehiclePanel() {
    if (!selected) return '<p class="empty-state">Chọn xe để xem lịch và lịch sử.</p>';
    if (!data) return "<p>Đang tải hồ sơ…</p>";
    const care = data.care,
      p = data.profile;
    const message = {
      missing_vehicle_details: "Chưa có năm xe, động cơ, hộp số và ODO để đối chiếu.",
      unverified_profile: "Chưa có lịch đã xác minh khớp cấu hình. Liên hệ cố vấn để bổ sung.",
      ready: "Đã khớp lịch xác minh. Chọn công việc theo hạn và tình trạng thực tế.",
    }[data.state];
    return `<p class="notice">${esc(message)}</p>${care ? `<div class="care-facts"><span>ODO: <strong>${care.odometer.toLocaleString("vi-VN")} km</strong> · ${esc(care.observedOn)}</span><span>${care.modelYear} · ${esc(care.engine)} · ${esc(care.gearbox)} · ${esc(care.market)}</span></div>` : ""}${p ? `<p><a href="${safeLink(p.sourceUrl)}" target="_blank" rel="noopener">${esc(p.title)}</a> · ${esc(p.sourcePage)} · ${esc(p.version)}</p>` : ""}
        ${staff ? '<div class="form-actions"><button class="btn btn-sm" data-care="edit">Cập nhật hồ sơ / ODO</button><button class="btn btn-sm" data-care="record">Ghi công việc đã thực hiện</button></div>' : ""}
        <div class="table-responsive"><table><thead><tr><th>Bộ phận / Thao tác</th><th>Hạn km</th><th>Hạn thời gian</th><th>Trạng thái</th></tr></thead><tbody>${data.rules.map((r) => `<tr><td><strong>${esc(componentName(r.component))}</strong><small>${esc(actionNames[r.action])} · ${esc(r.note)}</small></td><td>${r.dueKm ?? "Chưa xác định"}</td><td>${esc(r.dueDate || "Chưa xác định")}</td><td><span class="badge ${r.status === "due" ? "badge-working" : ""}">${esc(states[r.status])}</span>${r.odometerStale ? "<small>ODO quá 90 ngày</small>" : ""}</td></tr>`).join("") || '<tr><td colspan="4">Chưa có lịch áp dụng.</td></tr>'}</tbody></table></div>
        <details class="care-history" ${careView.historyOpen ? "open" : ""}><summary>Lịch sử thực hiện (${(data.records || []).length})</summary><div class="table-responsive"><table><thead><tr><th>Ngày / ODO</th><th>Công việc</th><th>Phiếu / Ghi chú</th></tr></thead><tbody>${(data.records || []).map((r) => `<tr><td>${esc(r.performedOn)} · ${r.odometer} km</td><td>${esc(componentName(r.component))} · ${esc(actionNames[r.action])}</td><td>${r.ticketId ? "#" + r.ticketId : "Lịch sử xác nhận"} · ${esc(r.note)}</td></tr>`).join("") || '<tr><td colspan="3">Chưa ghi nhận công việc.</td></tr>'}</tbody></table></div></details>`;
  }
  function library() {
    const query = host.querySelector("#careSearch").value.toLocaleLowerCase("vi-VN"),
      brand = host.querySelector("#careBrand").value,
      b = catalog.brands.find((b) => b.brand === brand);
    let modelSelect = host.querySelector("#careModel");
    if (!modelSelect) {
      const label = document.createElement("label");
      label.textContent = "Dòng xe / Hệ truyền động";
      modelSelect = document.createElement("select");
      modelSelect.id = "careModel";
      label.append(modelSelect);
      host.querySelector("#careBrand").parentElement.after(label);
      modelSelect.onchange = library;
    }
    if (modelSelect.dataset.brand !== brand) {
      modelSelect.dataset.brand = brand;
      modelSelect.innerHTML =
        '<option value="">Tất cả dòng / biến thể</option>' +
        (b?.modelProfiles || [])
          .map(
            (p) =>
              `<option value="${esc(p.model)}">${esc(p.model)} · ${p.powertrain === "ev" ? "Thuần điện" : p.powertrain === "hybrid" ? "Hybrid" : "Có động cơ đốt trong"}</option>`,
          )
          .join("");
    }
    const modelProfile = b?.modelProfiles?.find((p) => p.model === modelSelect.value);
    const filter = [brand, modelSelect.value, query].join("\n");
    if (filter !== careView.libraryFilter) careView.libraryPage = 0;
    careView.libraryFilter = filter;
    careView.brand = brand;
    careView.model = modelSelect.value;
    careView.query = host.querySelector("#careSearch").value;
    host.querySelector("#brandGuidance").innerHTML = b
      ? `<details class="care-brand-notes notice"><summary>Lưu ý cho ${esc(b.brand)}${modelProfile ? " · " + esc(modelProfile.model) : ""}</summary><p>${esc(b.models.join(", "))}</p><p>${esc(b.notes)}${modelProfile ? "<br>" + esc(modelProfile.note || catalog.modelPolicy) : ""} <a href="${safeLink(b.sourceUrl)}" target="_blank" rel="noopener">Xem nguồn hãng</a></p></details>`
      : '<p class="panel-note">Chọn hãng để xem lưu ý theo dòng xe. Khả năng tương thích vật tư cần đối chiếu VIN.</p>';
    host.querySelector("#componentLibrary").innerHTML =
      catalog.components
        .filter(
          (c) =>
            !modelProfile ||
            (
              modelProfile.componentCodes ||
              catalog.powertrainComponents?.[modelProfile.powertrain] ||
              []
            ).includes(c.code),
        )
        .filter((c) =>
          [c.name, c.group, c.inspection].join(" ").toLocaleLowerCase("vi-VN").includes(query),
        )
        .map(
          (c) =>
            `<article class="component-card"><span class="eyebrow">${esc(c.group)}</span><h4>${esc(c.name)}</h4><p>${esc(c.applicability)}</p><details><summary>Kiểm tra, vật tư & Lưu ý</summary><p>${esc(c.inspection)}</p><p><strong>Vật tư:</strong> ${esc(c.materials)}</p><p class="panel-note">${esc(c.caution)}</p></details></article>`,
        )
        .join("") || "<p>Không tìm thấy bộ phận.</p>";
    paginateLibrary();
  }
  function paginateLibrary() {
    const cards = [...host.querySelectorAll("#componentLibrary .component-card")];
    const pages = Math.max(1, Math.ceil(cards.length / 12));
    careView.libraryPage = Math.min(careView.libraryPage, pages - 1);
    cards.forEach((card, index) => {
      card.hidden = Math.floor(index / 12) !== careView.libraryPage;
    });
    let pager = host.querySelector("#careLibraryPagination");
    if (!pager) {
      pager = document.createElement("div");
      pager.id = "careLibraryPagination";
      pager.className = "care-pagination";
      pager.innerHTML =
        '<button type="button" class="btn btn-sm" data-library-page="previous">Trước</button><span aria-live="polite"></span><button type="button" class="btn btn-sm" data-library-page="next">Sau</button>';
      host.querySelector("#componentLibrary").after(pager);
      pager.onclick = (event) => {
        const button = event.target.closest("[data-library-page]");
        if (!button || button.disabled) return;
        careView.libraryPage += button.dataset.libraryPage === "next" ? 1 : -1;
        paginateLibrary();
      };
    }
    pager.hidden = cards.length <= 12;
    pager.querySelector("span").textContent =
      `${cards.length} bộ phận · Trang ${careView.libraryPage + 1} / ${pages}`;
    pager.querySelector('[data-library-page="previous"]').disabled = careView.libraryPage === 0;
    pager.querySelector('[data-library-page="next"]').disabled = careView.libraryPage >= pages - 1;
  }
  function trackHistory() {
    const history = host.querySelector(".care-history");
    if (history)
      history.ontoggle = () => {
        careView.historyOpen = history.open;
      };
  }
  async function loadVehicle() {
    const requestId = ++vehicleRequest,
      vehicleId = selected;
    host.querySelector("#careVehiclePanel").textContent = vehicleId
      ? "Đang tải hồ sơ…"
      : "Chọn xe để xem lịch và lịch sử.";
    try {
      const result = vehicleId ? await Garage.request("/maintenance/vehicles/" + vehicleId) : null;
      if (requestId !== vehicleRequest || selected !== vehicleId) return;
      data = result;
      host.querySelector("#careVehiclePanel").innerHTML = vehiclePanel();
      trackHistory();
    } catch (error) {
      if (requestId !== vehicleRequest) return;
      host.querySelector("#careVehiclePanel").textContent = error.message;
    }
  }
  async function load(context = {}) {
    const canRender = Garage.refreshGuard(context);
    try {
      const values = await Promise.all([
        Garage.request("/maintenance/catalog"),
        Garage.request("/maintenance/vehicles"),
        Garage.request("/maintenance/reminders"),
        staff ? Garage.request("/maintenance/profiles") : Promise.resolve([]),
      ]);
      if (!canRender()) return;
      if (!values[0]?.components) return;
      [catalog, vehicles, reminders, profiles] = values;
      if (selected && !vehicles.some((v) => String(v.id) === selected)) selected = "";
      data = selected ? await Garage.request("/maintenance/vehicles/" + selected) : null;
      if (canRender()) render();
    } catch (e) {
      if (!context.background)
        host.innerHTML = `<p class="inline-message error">${esc(e.message)}</p><button class="btn" data-care="retry">Thử lại</button>`;
    }
  }
  function careEditor() {
    const c = data?.care || {},
      v = vehicles.find((v) => String(v.id) === selected);
    const compatible = profiles.filter(
      (p) =>
        p.status === "approved" &&
        p.scope.brand.toLowerCase() === v.carBrand.toLowerCase() &&
        p.scope.model.toLowerCase() === (v.carModel || "").toLowerCase(),
    );
    modal(
      "Hồ sơ kỹ thuật · " + v.licensePlate,
      `<div class="form-grid">${field("VIN (nếu có)", "vin", c.vin, "text", 'pattern="[A-HJ-NPR-Z0-9]{17}" maxlength="17"')}${field("Năm model", "modelYear", c.modelYear, "number", 'required min="1980" max="2100"')}${field("Động cơ / mã cấu hình", "engine", c.engine, "text", "required")}${field("Hộp số / mã cấu hình", "gearbox", c.gearbox, "text", "required")}${field("Thị trường", "market", c.market || "VN", "text", "required")}${field("Ngày sử dụng lần đầu", "firstUseDate", c.firstUseDate, "date", "required")}${field("ODO hiện tại (km)", "odometer", c.odometer, "number", 'required min="0" max="2000000"')}${field("Ngày ghi nhận ODO", "observedOn", c.observedOn || new Date().toLocaleDateString("en-CA"), "date", "required")}<label class="form-group">Điều kiện sử dụng<select name="usage"><option value="normal">Thông thường</option><option value="severe" ${c.usage === "severe" ? "selected" : ""}>Khắc nghiệt</option></select></label><label class="form-group">Lịch đã xác minh<select name="profileId"><option value="">Chưa áp dụng</option>${compatible.map((p) => `<option value="${p.id}" ${p.id === c.profileId ? "selected" : ""}>${esc(p.title)} · ${esc(p.scope.engine)} / ${esc(p.scope.gearbox)} · ${esc(p.scope.market)}</option>`).join("")}</select></label></div><p class="field-help">Nhập đúng cấu hình trong sách; hệ thống sẽ kiểm tra độ khớp trước khi áp dụng lịch.</p>`,
      async (form) => {
        const body = Object.fromEntries(new FormData(form));
        body.profileId = Number(body.profileId) || null;
        body.vin = body.vin || null;
        body.modelYear = Number(body.modelYear);
        body.odometer = Number(body.odometer);
        await Garage.request("/maintenance/vehicles/" + selected, {
          method: "PUT",
          body,
        });
      },
    );
  }
  function recordEditor() {
    modal(
      "Ghi công việc đã thực hiện",
      `<div class="form-grid"><label class="form-group">Bộ phận<select name="component">${options(catalog.components, "code", "name")}</select></label><label class="form-group">Thao tác<select name="action">${Object.entries(
        actionNames,
      )
        .map(([a, n]) => `<option value="${a}">${n}</option>`)
        .join(
          "",
        )}</select></label>${field("Ngày thực hiện", "performedOn", "", "date", "required")}${field("ODO khi thực hiện", "odometer", data?.care?.odometer, "number", 'required min="0"')}${field("Mã phiếu đã hoàn thành (nếu có)", "ticketId", "", "number", 'min="1"')}</div><label class="form-group">Nội dung / căn cứ xác nhận<textarea name="note" required minlength="3" maxlength="2000" rows="3"></textarea></label><p class="field-help">Kiểm tra chỉ reset lịch kiểm tra; thay thế chỉ reset lịch thay thế. Lịch sử không có phiếu cần có căn cứ xác nhận.</p>`,
      async (form) => {
        const body = Object.fromEntries(new FormData(form));
        body.odometer = Number(body.odometer);
        body.ticketId = Number(body.ticketId) || null;
        await Garage.request("/maintenance/vehicles/" + selected + "/records", {
          method: "POST",
          body,
        });
      },
    );
  }
  function profileEditor() {
    const dialog = modal(
      "Lập lịch bảo dưỡng từ sách hãng",
      `<label class="form-group">Mẫu tham khảo<select id="carePreset"><option value="">Nhập lịch mới</option>${catalog.presets.map((p, i) => `<option value="${i}">${esc(p.title)}</option>`).join("")}</select></label><p class="notice">Đối chiếu bản gốc và mọi chú thích. Mẫu Malaysia chỉ dùng cho thị trường Malaysia. Điền chính xác động cơ, hộp số trước khi xác minh.</p><div class="form-grid">${field("Tên lịch", "title", "", "text", "required")}${field("Hãng", "brand", "", "text", "required")}${field("Dòng xe", "model", "", "text", "required")}${field("Từ năm model", "yearFrom", "", "number", 'required min="1980" max="2100"')}${field("Đến năm model", "yearTo", "", "number", 'required min="1980" max="2100"')}${field("Động cơ", "engine", "", "text", "required")}${field("Hộp số", "gearbox", "", "text", "required")}${field("Thị trường", "market", "VN", "text", "required")}<label class="form-group">Điều kiện<select name="usage"><option value="normal">Thông thường</option><option value="severe">Khắc nghiệt</option></select></label>${field("Link tài liệu hãng", "sourceUrl", "", "url", "required")}${field("Trang / bảng / chú thích", "sourcePage", "", "text", "required")}${field("Phiên bản tài liệu", "version", "", "text", "required")}</div><h4>Hạng mục và chu kỳ</h4><p class="field-help">Để trống mốc chưa biết. Tháng là thời gian lịch; không quy đổi ra 30 ngày.</p><div id="careRules"></div><button type="button" class="btn btn-sm" id="addCareRule">＋ Hạng mục</button>`,
      async (form) => {
        const vals = Object.fromEntries(new FormData(form)),
          scope = {};
        for (const key of [
          "brand",
          "model",
          "engine",
          "gearbox",
          "market",
          "usage",
          "yearFrom",
          "yearTo",
        ]) {
          scope[key] = key.startsWith("year") ? Number(vals[key]) : vals[key];
          delete vals[key];
        }
        const rules = [...form.querySelectorAll(".care-rule")].map((row) =>
          Object.fromEntries(
            [...row.querySelectorAll("[data-key]")].map((input) => [
              input.dataset.key,
              ["firstKm", "firstMonths", "repeatKm", "repeatMonths"].includes(input.dataset.key)
                ? input.value
                  ? Number(input.value)
                  : null
                : input.value,
            ]),
          ),
        );
        await Garage.request("/maintenance/profiles", {
          method: "POST",
          body: { ...vals, scope, rules },
        });
      },
    );
    const add = (r = {}) => {
      const row = document.createElement("div");
      row.className = "care-rule";
      row.innerHTML = `<label>Bộ phận<select data-key="component">${options(catalog.components, "code", "name")}</select></label><label>Thao tác<select data-key="action">${Object.entries(
        actionNames,
      )
        .map(([a, n]) => `<option value="${a}">${n}</option>`)
        .join("")}</select></label>${[
        ["firstKm", "Km đầu"],
        ["firstMonths", "Tháng đầu"],
        ["repeatKm", "Km lặp"],
        ["repeatMonths", "Tháng lặp"],
      ]
        .map(
          ([k, n]) =>
            `<label>${n}<input data-key="${k}" type="number" min="1" max="${k.includes("Km") ? "2000000" : "600"}" value="${r[k] ?? ""}"></label>`,
        )
        .join(
          "",
        )}<label>Chú thích<input data-key="note" value="${esc(r.note || "")}" maxlength="2000"></label><button type="button" class="btn-icon" aria-label="Xóa hạng mục">×</button>`;
      for (const k of ["component", "action"])
        if (r[k]) row.querySelector('[data-key="' + k + '"]').value = r[k];
      row.querySelector("button").onclick = () => row.remove();
      dialog.querySelector("#careRules").append(row);
    };
    dialog.querySelector("#addCareRule").onclick = () => add();
    add();
    dialog.querySelector("#carePreset").onchange = (e) => {
      const p = catalog.presets[Number(e.target.value)];
      if (e.target.value === "" || !p) return;
      const f = dialog.querySelector("form");
      for (const [k, v] of Object.entries({ ...p, ...p.scope }))
        if (f.elements[k]) f.elements[k].value = v;
      dialog.querySelector("#careRules").replaceChildren();
      p.rules.forEach(add);
    };
  }
  host.onclick = async (event) => {
    const btn = event.target.closest("[data-care]");
    if (!btn) return;
    const action = btn.dataset.care;
    if (action === "edit") return careEditor();
    if (action === "record") return recordEditor();
    if (action === "profile") return profileEditor();
    if (action === "retry") return load();
    if (
      action === "approve" &&
      !confirm(
        "Bạn đã đối chiếu nguồn, trang/chú thích và đúng cấu hình xe? Lịch đã xác minh sẽ giữ nguyên để bảo toàn lịch sử.",
      )
    )
      return;
    btn.disabled = true;
    try {
      await Garage.request(
        action === "scan"
          ? "/maintenance/scan"
          : action === "publish"
            ? "/maintenance/reminders/" + btn.dataset.id + "/publish"
            : "/maintenance/profiles/" + btn.dataset.id + "/approve",
        { method: "POST" },
      );
      await load();
    } catch (e) {
      Garage.toast(e.message, "error");
    } finally {
      btn.disabled = false;
    }
  };
  Garage.subscribe(load);
  load();
});
