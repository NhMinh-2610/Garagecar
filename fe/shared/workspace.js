/* Shared navigation keeps related work together without replacing forms or drafts. */
(() => {
  const names = {
    admin: "Quản trị viên",
    advisor: "Cố vấn dịch vụ",
    mechanic: "Kỹ thuật viên",
    accountant: "Kế toán",
    hr: "Nhân sự",
    customer: "Khách hàng",
  };
  const groups = {
    workshop: {
      title: "Vận hành xưởng",
      mark: "01",
      text: "Tiếp nhận, báo giá, sửa chữa và vật tư.",
    },
    care: {
      title: "Chăm sóc khách",
      mark: "02",
      text: "Bảo dưỡng, trao đổi và chăm sóc sau sửa.",
    },
    finance: {
      title: "Tài chính",
      mark: "03",
      text: "Thu tiền, kiểm soát chi và báo cáo.",
    },
    people: {
      title: "Nhân sự",
      mark: "04",
      text: "Hồ sơ, phân ca và năng lực kỹ thuật.",
    },
    personal: {
      title: "Công việc cá nhân",
      mark: "05",
      text: "Lịch làm và yêu cầu nghỉ phép của bạn.",
    },
    vehicles: {
      title: "Xe & Dịch vụ",
      mark: "01",
      text: "Xe, lịch hẹn, báo giá và tiến độ sửa chữa.",
    },
    support: {
      title: "Chăm sóc & Hỗ trợ",
      mark: "02",
      text: "Theo dõi bảo dưỡng và trao đổi với garage.",
    },
  };
  const order = {
    admin: ["workshop", "care", "finance", "people"],
    advisor: ["workshop", "care", "personal"],
    mechanic: ["workshop", "care", "personal"],
    accountant: ["finance", "personal"],
    hr: ["people", "personal"],
    customer: ["vehicles", "support"],
  };
  const labels = {
    "dashboard-section": "Tổng quan",
    "reception-section": "Tiếp nhận & Lịch hẹn",
    "staffReception-section": "Tiếp nhận & Lịch hẹn",
    "repair-section": "Phiếu sửa chữa",
    "tasks-section": "Công việc của tôi",
    "inventory-section": "Kho & Vật tư",
    "finance-section": "Thu tiền",
    "financeOps-section": "Đề nghị chi & Sổ thu",
    "report-section": "Báo cáo doanh thu",
    "staffReport-section": "Báo cáo doanh thu",
    "hr-section": "Nhân sự & Tài khoản",
    "staffHR-section": "Hồ sơ nhân sự",
    "hrOps-section": "Phân ca & Chứng chỉ",
    "myWork-section": "Lịch làm & Nghỉ phép",
    "advisorOps-section": "Chăm sóc sau sửa",
    "vehicles-section": "Xe của tôi",
    "repairs-section": "Sửa chữa & Chi phí",
    "booking-section": "Đặt lịch dịch vụ",
    "service-section": "Kiểm tra & Báo giá",
    "maintenance-section": "Bảo dưỡng & Nhắc hạn",
    "messages-section": "Hộp thư khách hàng",
    "chat-section": "Hỏi AI về xe",
  };
  const grouping = (target, role) => {
    if (target === "dashboard-section") return "home";
    if (role === "customer")
      return ["chat-section", "messages-section", "maintenance-section"].includes(target)
        ? "support"
        : "vehicles";
    if (target === "myWork-section") return role === "admin" ? "people" : "personal";
    if (
      ["finance-section", "financeOps-section", "report-section", "staffReport-section"].includes(
        target,
      )
    )
      return "finance";
    if (["hr-section", "staffHR-section", "hrOps-section"].includes(target)) return "people";
    if (["maintenance-section", "messages-section", "advisorOps-section"].includes(target))
      return "care";
    return "workshop";
  };
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  Garage.initWorkspace = (role) => {
    if (Garage.workspace?.active) return;
    const sidebar = document.getElementById("sidebar"),
      nav = sidebar?.querySelector("nav");
    const main = document.querySelector("main"),
      topbar = document.querySelector(".topbar");
    if (!sidebar || !nav || !main || !topbar) return;
    document.body.classList.add("workspace-shell");
    Garage.workspace = { active: true, role };
    const key = `garage:${role}:section`,
      containers = new Map();
    let current = "",
      pendingSync = false,
      mobileOpen = false,
      restoreTarget = localStorage.getItem(key),
      collapsedGroup = "";
    const buttons = () => [...nav.querySelectorAll(".nav-item[data-target]")];
    const allowed = (node) =>
      !!node && !node.hidden && !node.disabled && !!document.getElementById(node.dataset.target);
    const label = (node) =>
      node.dataset.title || labels[node.dataset.target] || node.textContent.trim();
    const groupName = (key) => {
      if (role === "customer" && key === "support") return "Chăm sóc & Hỗ trợ";
      if (role === "mechanic" && key === "care") return "Chăm sóc xe";
      if (role === "advisor" && key === "workshop") return "Tiếp nhận & Xưởng";
      return groups[key]?.title || "Công việc";
    };
    let dashboard = document.getElementById("dashboard-section");
    if (!dashboard) {
      dashboard = element("section");
      dashboard.id = "dashboard-section";
      dashboard.innerHTML = `<div class="section-heading"><div><p class="eyebrow">AUTOPRO · ${names[role] || "CÔNG VIỆC"}</p><h1>Bảng điều hành</h1><p class="section-description">Ưu tiên công việc cần xử lý và mở nhanh đúng chức năng.</p></div></div>`;
      (main.querySelector(".content-body") || main).prepend(dashboard);
      const home = element("button", "nav-item", "Tổng quan");
      home.type = "button";
      home.dataset.target = dashboard.id;
      home.dataset.permission =
        buttons().find((node) => !node.hidden && !node.disabled)?.dataset.permission || "";
      nav.prepend(home);
    }
    if (role === "customer") {
      labels["service-section"] = "Báo giá & Xác nhận";
      labels["messages-section"] = "Nhắn garage";
    }
    if (role === "mechanic") {
      labels["service-section"] = "Kiểm tra kỹ";
      labels["inventory-section"] = "Tra cứu vật tư";
    }
    const secondary = element("div", "workspace-subnav");
    secondary.setAttribute("role", "navigation");
    secondary.setAttribute("aria-label", "Chức năng liên quan");
    secondary.hidden = true;
    topbar.after(secondary);
    const toggle = document.querySelector(".toggle-sidebar");
    toggle?.setAttribute("aria-controls", "sidebar");
    toggle?.setAttribute("aria-expanded", "false");
    const close = element("button", "workspace-sidebar-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Đóng menu");
    sidebar.prepend(close);
    const backdrop = element("button", "workspace-backdrop");
    backdrop.type = "button";
    backdrop.hidden = true;
    backdrop.setAttribute("aria-label", "Đóng menu");
    document.body.append(backdrop);
    const isMobile = () =>
      window.matchMedia
        ? window.matchMedia("(max-width: 900px)").matches
        : window.innerWidth <= 900;
    const drawer = (open, restoreFocus = false) => {
      mobileOpen = !!open && isMobile();
      sidebar.classList.toggle("active", mobileOpen);
      backdrop.hidden = !mobileOpen;
      sidebar.inert = isMobile() && !mobileOpen;
      sidebar.setAttribute("aria-hidden", String(isMobile() && !mobileOpen));
      document.body.classList.toggle("workspace-menu-open", mobileOpen);
      toggle?.setAttribute("aria-expanded", String(mobileOpen));
      const content = document.getElementById("content");
      if (content) content.inert = mobileOpen;
      if (mobileOpen) close.focus();
      else if (restoreFocus) toggle?.focus();
    };
    toggle?.addEventListener("click", () => drawer(!mobileOpen));
    close.addEventListener("click", () => drawer(false, true));
    backdrop.addEventListener("click", () => drawer(false, true));
    window.addEventListener("resize", () => drawer(isMobile() && mobileOpen));
    drawer(false);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && mobileOpen) {
        event.preventDefault();
        drawer(false, true);
      }
      if (event.key !== "Tab" || !mobileOpen) return;
      const focusable = [...sidebar.querySelectorAll('button,a[href],input,[tabindex="0"]')].filter(
        (node) => !node.disabled && !node.hidden && !node.closest("[hidden]"),
      );
      const first = focusable[0],
        last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    });
    function ensureGroup(key) {
      if (containers.has(key)) return containers.get(key);
      const wrapper = element("div", "workspace-nav-group");
      wrapper.dataset.workspaceGroup = key;
      const heading = element("button", "workspace-group-button");
      heading.type = "button";
      heading.append(
        element("span", "workspace-group-mark", groups[key]?.mark || "•"),
        element("span", "", groupName(key)),
        element("span", "workspace-group-chevron", "›"),
      );
      const items = element("div", "workspace-group-items");
      items.id = `workspace-group-${key}`;
      items.hidden = true;
      heading.setAttribute("aria-controls", items.id);
      heading.setAttribute("aria-expanded", "false");
      heading.addEventListener("click", () => {
        if (heading.getAttribute("aria-expanded") === "true") {
          collapsedGroup = key;
          updateGroups();
          return;
        }
        collapsedGroup = "";
        const candidates = [...items.querySelectorAll(".nav-item")].filter(allowed);
        const selected =
          candidates.find((node) => node.dataset.target === current) || candidates[0];
        if (selected) navigate(selected.dataset.target, { closeDrawer: false });
      });
      wrapper.append(heading, items);
      containers.set(key, { wrapper, heading, items });
      nav.append(wrapper);
      return containers.get(key);
    }
    function updateGroups() {
      const activeGroup = grouping(current, role);
      for (const [key, group] of containers) {
        const visible = [...group.items.querySelectorAll(".nav-item")].some(allowed);
        group.wrapper.hidden = !visible;
        const expanded = key === activeGroup && collapsedGroup !== key;
        group.items.hidden = !expanded;
        group.heading.setAttribute("aria-expanded", String(expanded));
        group.heading.classList.toggle("active", expanded);
      }
      secondary.replaceChildren();
      const related = buttons().filter(
        (node) => allowed(node) && grouping(node.dataset.target, role) === activeGroup,
      );
      secondary.hidden = activeGroup === "home" || related.length < 2;
      if (secondary.hidden) return;
      secondary.append(element("span", "workspace-subnav-label", groupName(activeGroup)));
      const links = element("div", "workspace-subnav-links");
      related.forEach((original) => {
        const button = element("button", "workspace-subnav-button", label(original));
        button.type = "button";
        button.dataset.workspaceTarget = original.dataset.target;
        button.classList.toggle("active", current === original.dataset.target);
        if (current === original.dataset.target) button.setAttribute("aria-current", "page");
        button.addEventListener("click", () => navigate(original.dataset.target));
        links.append(button);
      });
      secondary.append(links);
    }
    function navigate(target, options = {}) {
      const item = buttons().find((node) => node.dataset.target === target);
      if (!allowed(item)) return false;
      if (!options.automatic) restoreTarget = "";
      const changed = current !== target;
      if (changed) collapsedGroup = "";
      current = target;
      buttons().forEach((node) => {
        node.classList.toggle("active", node === item);
        if (node === item) node.setAttribute("aria-current", "page");
        else node.removeAttribute("aria-current");
      });
      document.querySelectorAll("section[data-workspace-panel]").forEach((section) => {
        section.classList.toggle("active-section", section.id === target);
        section.hidden = section.id !== target;
      });
      const title = document.getElementById("pageTitle");
      if (title) title.textContent = label(item);
      if (options.persist !== false) localStorage.setItem(key, target);
      updateGroups();
      const focusAfterDrawer = mobileOpen && options.closeDrawer !== false;
      if (options.closeDrawer !== false) drawer(false);
      if (changed) {
        document.dispatchEvent(
          new CustomEvent("garage:section", {
            detail: { role, target, group: grouping(target, role) },
          }),
        );
        if (!options.automatic) Garage.changed?.();
      }
      if (options.focus || focusAfterDrawer) {
        const heading = document.getElementById(target)?.querySelector("h1,h2");
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
      }
      return true;
    }
    Garage.navigate = navigate;
    function syncNavigation() {
      pendingSync = false;
      if (!window.document) return;
      buttons().forEach((button) => {
        const target = button.dataset.target,
          panel = document.getElementById(target);
        if (!panel) return;
        panel.dataset.workspacePanel = "true";
        button.type = "button";
        button.dataset.title = labels[target] || button.dataset.title || button.textContent.trim();
        let text = button.querySelector(":scope > .workspace-nav-label");
        if (!text) {
          const icons = [...button.querySelectorAll(":scope > i")];
          const badges = [...button.querySelectorAll(".support-badge")];
          text = element("span", "workspace-nav-label", button.dataset.title);
          button.replaceChildren(...icons, text, ...badges);
        } else if (text.textContent !== button.dataset.title) {
          text.textContent = button.dataset.title;
        }
        const groupKey = grouping(target, role);
        if (groupKey === "home") {
          button.classList.add("workspace-home-link");
          if (nav.firstElementChild !== button) nav.prepend(button);
        } else {
          const group = ensureGroup(groupKey);
          if (button.parentElement !== group.items) group.items.append(button);
        }
      });
      const arranged = [
        buttons().find((node) => grouping(node.dataset.target, role) === "home"),
        ...(order[role] || []).map((key) => containers.get(key)?.wrapper),
      ].filter(Boolean);
      arranged.forEach((node, index) => {
        if (nav.children[index] !== node) nav.insertBefore(node, nav.children[index] || null);
      });
      const restored = buttons().find(
        (node) => node.dataset.target === restoreTarget && allowed(node),
      );
      if (restored) restoreTarget = "";
      const preferred =
        restored ||
        buttons().find((node) => node.dataset.target === current && allowed(node)) ||
        buttons().find(allowed);
      if (preferred)
        navigate(preferred.dataset.target, {
          closeDrawer: false,
          automatic: true,
          persist: !restoreTarget,
        });
      else {
        current = "";
        document.querySelectorAll("section[data-workspace-panel]").forEach((section) => {
          section.hidden = true;
          section.classList.remove("active-section");
        });
        secondary.hidden = true;
        updateGroups();
      }
      renderShortcuts();
    }
    document.addEventListener(
      "click",
      (event) => {
        const item = event.target.closest(".nav-item[data-target]");
        if (!item || !nav.contains(item)) return;
        if (!allowed(item)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        navigate(item.dataset.target);
        // A legacy dynamic module may still install its own nav handler.
        queueMicrotask(() => {
          if (window.document && current === item.dataset.target)
            navigate(current, { closeDrawer: false });
        });
      },
      true,
    );
    document.addEventListener("click", (event) => {
      const item = event.target.closest("[data-workspace-go]");
      if (item) navigate(item.dataset.workspaceGo, { focus: true });
    });
    const observer = new MutationObserver((mutations) => {
      if (!window.document) return;
      if (
        !mutations.some(
          (change) => change.type === "childList" || change.target.matches?.(".nav-item"),
        )
      )
        return;
      if (pendingSync) return;
      pendingSync = true;
      queueMicrotask(syncNavigation);
    });
    observer.observe(nav, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "disabled"],
    });
    // Tabs are delegated so shared modules can add them after page initialization.
    document.addEventListener("click", (event) => {
      const button = event.target.closest(".tab-btn[data-tab]");
      if (!button) return;
      const section = button.closest("section");
      if (!section) return;
      section.querySelectorAll(".tab-btn[data-tab]").forEach((node) => {
        if (node.closest("section") !== section) return;
        node.classList.toggle("active", node === button);
        node.setAttribute("aria-selected", String(node === button));
      });
      section.querySelectorAll(".tab-content").forEach((node) => {
        if (node.closest("section") === section)
          node.classList.toggle("active", node.id === button.dataset.tab);
      });
    });
    const overview = element("div", "workspace-overview");
    overview.id = "workspaceOverview";
    const actions = element("div", "workspace-actions");
    actions.setAttribute("aria-label", "Thao tác thường dùng");
    overview.append(actions);
    let priority, status, shortcutContainer;
    if (role !== "customer") {
      const columns = element("div", "workspace-dashboard-grid");
      const attention = element("div", "card workspace-attention");
      attention.append(
        element("h2", "", "Việc cần xử lý"),
        element("p", "muted", "Số liệu từ các chức năng bạn được phép truy cập."),
      );
      priority = element("div", "workspace-priority-list");
      status = element("p", "workspace-update-status", "Đang tải công việc…");
      status.setAttribute("role", "status");
      attention.append(priority, status);
      const shortcuts = element("div", "card workspace-shortcuts");
      shortcuts.append(element("h2", "", "Không gian làm việc"));
      shortcutContainer = element("div", "workspace-shortcut-list");
      shortcuts.append(shortcutContainer);
      columns.append(attention, shortcuts);
      overview.append(columns);
    }
    dashboard.querySelector(".section-heading")?.after(overview);
    if (!overview.isConnected) dashboard.prepend(overview);
    const quick = {
      admin: [
        ["reception-section", "Tiếp nhận xe"],
        ["service-section", "Kiểm tra & Báo giá"],
        ["finance-section", "Thu tiền"],
      ],
      advisor: [
        ["staffReception-section", "Tiếp nhận xe"],
        ["service-section", "Kiểm tra & Báo giá"],
        ["messages-section", "Hộp thư khách"],
      ],
      mechanic: [
        ["tasks-section", "Mở công việc"],
        ["service-section", "Kiểm tra kỹ"],
        ["inventory-section", "Tra cứu vật tư"],
      ],
      accountant: [
        ["finance-section", "Thu tiền"],
        ["financeOps-section", "Đề nghị chi & Sổ thu"],
        ["staffReport-section", "Xem doanh thu"],
      ],
      hr: [
        ["staffHR-section", "Hồ sơ nhân sự"],
        ["hrOps-section", "Phân ca & Chứng chỉ"],
        ["myWork-section", "Lịch cá nhân"],
      ],
      customer: [
        ["booking-section", "Đặt lịch dịch vụ"],
        ["service-section", "Xác nhận báo giá"],
        ["messages-section", "Nhắn garage"],
      ],
    };
    let shortcutsSignature = "";
    function renderShortcuts() {
      if (!actions) return;
      const available = buttons().filter(allowed);
      const signature = available.map((node) => node.dataset.target).join("|");
      if (signature === shortcutsSignature) return;
      shortcutsSignature = signature;
      actions.replaceChildren();
      (quick[role] || []).forEach(([target, title], index) => {
        if (!available.some((node) => node.dataset.target === target)) return;
        const button = element(
          "button",
          `btn ${index === 0 ? "btn-primary" : "btn-secondary"}`,
          title,
        );
        button.type = "button";
        button.dataset.workspaceGo = target;
        actions.append(button);
      });
      if (!shortcutContainer) return;
      shortcutContainer.replaceChildren();
      (order[role] || []).forEach((group) => {
        const related = available.filter((node) => grouping(node.dataset.target, role) === group);
        if (!related.length) return;
        const article = element("article", "workspace-shortcut");
        article.append(
          element("strong", "", groupName(group)),
          element("p", "muted", groups[group].text),
        );
        const links = element("div", "workspace-shortcut-links");
        related.forEach((node) => {
          const button = element("button", "", label(node));
          button.type = "button";
          button.dataset.workspaceGo = node.dataset.target;
          links.append(button);
        });
        article.append(links);
        shortcutContainer.append(article);
      });
    }
    syncNavigation();
    Promise.resolve(Garage.permissionsReady)
      .then((me) => {
        if (!me?.role || me.role !== role || role === "customer") return;
        const permissions = new Set(me.permissions || []),
          can = (permission) => permissions.has(permission);
        const rows = [],
          requests = new Map();
        const add = (permission, path, target, title, select, unit = "") => {
          if (!can(permission)) return;
          rows.push({ path, target, title, select, unit });
        };
        const receptionTarget = role === "advisor" ? "staffReception-section" : "reception-section";
        if (["admin", "advisor"].includes(role)) {
          add(
            "reception",
            "/bookings",
            receptionTarget,
            "Lịch hẹn chờ xác nhận",
            (data) => data.filter((row) => row.status === "pending").length,
          );
          add(
            "reception",
            "/vehicles",
            receptionTarget,
            "Xe đang chờ tiếp nhận / điều phối",
            (data) => data.filter((row) => row.status === "waiting").length,
          );
          add(
            "workshop",
            "/service/visits",
            "service-section",
            "Lượt dịch vụ đang xử lý",
            (data) =>
              data.filter(
                (row) =>
                  row.status !== "closed" &&
                  !["paid", "completed"].includes(row.ticketStatus) &&
                  row.vehicleStatus !== "delivered",
              ).length,
          );
        }
        if (role === "mechanic") {
          add(
            "workshop",
            "/repairs/my-tasks",
            "tasks-section",
            "Phiếu cần thực hiện",
            (data) => data.filter((row) => ["draft", "working"].includes(row.status)).length,
          );
          add(
            "workshop",
            "/repairs/my-tasks",
            "tasks-section",
            "Hạng mục chưa hoàn thành",
            (data) =>
              data
                .filter((row) => ["draft", "working"].includes(row.status))
                .reduce(
                  (sum, row) => sum + (row.items || []).filter((item) => !item.isCompleted).length,
                  0,
                ),
          );
        }
        if (can("finance")) {
          add(
            "finance",
            "/repairs",
            "finance-section",
            "Phiếu hoàn thành chờ thu",
            (data) => data.filter((row) => row.status === "completed").length,
          );
          add(
            "finance",
            "/repairs",
            "finance-section",
            "Tổng giá trị phiếu chờ thu",
            (data) =>
              data
                .filter((row) => row.status === "completed")
                .reduce((sum, row) => sum + Number(row.totalAmount || 0), 0),
            "money",
          );
          add(
            "finance",
            "/finance/expenses",
            "financeOps-section",
            "Đề nghị chi chờ duyệt",
            (data) => data.filter((row) => row.status === "submitted").length,
          );
        }
        add(
          "maintenance",
          "/maintenance/reminders",
          "maintenance-section",
          "Nhắc hạn bảo dưỡng đang mở",
          (data) => data.length,
        );
        add(
          "messages",
          "/messaging/conversations",
          "messages-section",
          "Tin nhắn khách chưa đọc",
          (data) => Number(data.totalUnread || 0),
        );
        if (can("hr")) {
          add(
            "hr",
            "/service/employees",
            role === "admin" ? "hr-section" : "staffHR-section",
            "Nhân viên đang hoạt động",
            (data) => data.filter((row) => row.isActive).length,
          );
          add(
            "hr",
            "/hr/operations",
            "hrOps-section",
            "Yêu cầu nghỉ chờ duyệt",
            (data) => (data.leave || []).filter((row) => row.status === "pending").length,
          );
        }
        const personalPermission = {
          admin: "hr",
          advisor: "reception",
          accountant: "finance",
          mechanic: "workshop",
          hr: "hr",
        }[role];
        add(
          personalPermission,
          "/hr/operations",
          "myWork-section",
          "Ca làm sắp tới của tôi",
          (data) =>
            (data.shifts || []).filter(
              (row) =>
                row.userId === me.id &&
                row.status === "scheduled" &&
                Garage.date(row.endsAt) >= new Date(),
            ).length,
        );
        priority.replaceChildren();
        rows.forEach((row, index) => {
          const item = element("button", "workspace-priority-row");
          item.type = "button";
          item.dataset.workspaceGo = row.target;
          item.hidden = index >= 5;
          const count = element("strong", "", "—");
          row.counter = count;
          item.append(
            element("span", "", row.title),
            count,
            element("span", "workspace-priority-arrow", "↗"),
          );
          priority.append(item);
        });
        if (rows.length > 5) {
          priority.id = "workspacePriority";
          const more = element(
            "button",
            "workspace-show-more",
            `Xem thêm ${rows.length - 5} tác vụ`,
          );
          more.type = "button";
          more.setAttribute("aria-expanded", "false");
          more.setAttribute("aria-controls", priority.id);
          more.addEventListener("click", () => {
            const expanded = more.getAttribute("aria-expanded") !== "true";
            more.setAttribute("aria-expanded", String(expanded));
            more.textContent = expanded ? "Thu gọn tác vụ" : `Xem thêm ${rows.length - 5} tác vụ`;
            [...priority.children].forEach((node, index) => {
              node.hidden = !expanded && index >= 5;
            });
          });
          status.before(more);
        }
        if (!rows.length) {
          status.textContent = "Mở chức năng được cấp quyền trong Không gian làm việc để tiếp tục.";
          return;
        }
        let loading = false;
        async function refresh(context = {}) {
          if (loading) return;
          loading = true;
          const guard = Garage.refreshGuard(context);
          let failed = false;
          try {
            requests.clear();
            rows.forEach((row) => {
              if (!requests.has(row.path))
                requests.set(row.path, Garage.request(row.path, { silent: true }));
            });
            const paths = [...requests.keys()],
              results = await Promise.allSettled(requests.values());
            if (!guard()) return;
            rows.forEach((row) => {
              const result = results[paths.indexOf(row.path)];
              if (result.status === "fulfilled") {
                try {
                  const value = row.select(result.value);
                  row.counter.textContent =
                    row.unit === "money" ? formatCurrency(value) : String(value);
                  row.counter.classList.toggle(
                    "workspace-count-alert",
                    Number(value) > 0 && row.unit !== "money",
                  );
                } catch {
                  failed = true;
                  row.counter.textContent = "—";
                }
              } else {
                failed = true;
                row.counter.textContent = "—";
              }
            });
            status.textContent = failed
              ? "Một số số liệu chưa tải được. Dữ liệu sẽ cập nhật khi kết nối ổn định."
              : "Đã cập nhật · " + new Date().toLocaleTimeString("vi-VN");
          } finally {
            loading = false;
          }
        }
        Garage.subscribe(refresh);
        refresh();
      })
      .catch(() => {
        if (status) status.textContent = "Chưa tải được thông tin tài khoản.";
      });
  };
})();
