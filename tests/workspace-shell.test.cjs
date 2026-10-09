const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const source = (name) => fs.readFileSync(path.join(__dirname, "..", "fe", "shared", name), "utf8");
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

async function shell(role = "admin", options = {}) {
  const targets = options.targets || [
    "dashboard-section",
    "reception-section",
    "service-section",
    "maintenance-section",
    "finance-section",
    "hr-section",
  ];
  const dom = new JSDOM(
    `<body><aside id="sidebar"><a class="brand" href="/">AutoPro</a><nav>${targets.map((target) => `<button class="nav-item" data-target="${target}" ${target === "reception-section" ? 'data-permission="reception"' : ""}>${target}</button>`).join("")}</nav><div class="sidebar-footer">Account</div></aside><div id="content"><header class="topbar"><button class="toggle-sidebar">Menu</button><span id="pageTitle"></span></header><main class="content-body">${targets.map((target) => `<section id="${target}"><div class="section-heading"><h1>${target}</h1></div><form><input aria-label="Draft" value="keep me"></form>${target === "service-section" ? '<section id="nested-checklist"><h2>Nested checklist</h2></section>' : ""}</section>`).join("")}</main></div></body>`,
    { url: "http://localhost:8000/admin", runScripts: "outside-only" },
  );
  const w = dom.window,
    calls = [],
    listeners = [],
    errors = [];
  w.addEventListener("error", (event) => errors.push(event.error));
  w.matchMedia = () => ({ matches: !!options.mobile });
  if (options.saved) w.localStorage.setItem(`garage:${role}:section`, options.saved);
  w.Garage = {
    base: "/api",
    escape: (value) => String(value),
    date: (value) => new Date(value),
    toast() {},
    refreshGuard: () => () => true,
    subscribe: (fn) => listeners.push(fn),
    permissionsReady: Promise.resolve({
      id: 7,
      role,
      fullName: options.fullName,
      permissions: options.permissions || [],
    }),
    request: async (path) => {
      calls.push(path);
      const data = options.responses?.[path];
      if (data instanceof Error) throw data;
      return data ?? (path === "/hr/operations" ? { shifts: [], leave: [] } : []);
    },
  };
  w.eval(source("portal.js"));
  w.eval(source("workspace.js"));
  w.Garage.initPortal(role);
  await tick();
  return { dom, w, calls, listeners, errors };
}

test("grouped navigation restores a valid section and keeps original inputs and nested sections intact", async () => {
  const { dom, w, errors } = await shell("admin", { saved: "service-section" });
  try {
    const $ = (id) => w.document.getElementById(id);
    const input = $("service-section").querySelector("input");
    input.value = "Unsent work";
    assert.ok($("service-section").classList.contains("active-section"));
    assert.equal($("service-section").hidden, false);
    assert.equal($("nested-checklist").hasAttribute("data-workspace-panel"), false);
    assert.equal($("nested-checklist").hidden, false);
    assert.equal(
      w.document.querySelectorAll('.workspace-group-button[aria-expanded="true"]').length,
      1,
    );
    const groupHeading = w.document.querySelector('.workspace-group-button[aria-expanded="true"]');
    groupHeading.click();
    assert.equal(groupHeading.getAttribute("aria-expanded"), "false");
    groupHeading.click();
    assert.equal(groupHeading.getAttribute("aria-expanded"), "true");
    w.document
      .querySelector('.workspace-subnav-button[data-workspace-target="reception-section"]')
      .click();
    assert.equal($("reception-section").hidden, false);
    assert.equal($("service-section").hidden, true);
    assert.equal(w.Garage.navigate("service-section"), true);
    assert.equal($("service-section").querySelector("input"), input);
    assert.equal(input.value, "Unsent work");
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("dynamic professional sections join the correct group and forbidden sections stay inaccessible", async () => {
  const { dom, w } = await shell("accountant", {
    targets: ["finance-section", "staffReport-section"],
    permissions: [],
  });
  try {
    const section = w.document.createElement("section");
    section.id = "financeOps-section";
    section.innerHTML = "<h1>Expense records</h1>";
    w.document.querySelector("main").append(section);
    const nav = w.document.createElement("button");
    nav.className = "nav-item";
    nav.dataset.target = section.id;
    nav.onclick = () =>
      w.document
        .querySelectorAll("main section")
        .forEach((node) => node.classList.toggle("active-section", node === section));
    w.document.querySelector("#sidebar nav").append(nav);
    await tick();
    assert.equal(nav.closest(".workspace-nav-group").dataset.workspaceGroup, "finance");
    nav.click();
    await tick();
    assert.equal(section.hidden, false);
    assert.equal(nav.getAttribute("aria-current"), "page");
    nav.hidden = true;
    nav.disabled = true;
    await tick();
    assert.equal(w.Garage.navigate(section.id), false);
    assert.equal(section.hidden, true);
    assert.notEqual(w.localStorage.getItem("garage:accountant:section"), section.id);
  } finally {
    dom.window.close();
  }
});

test("saved dynamic workspaces restore after mount without overriding a later user choice", async () => {
  for (const userChoosesFirst of [false, true]) {
    const { dom, w } = await shell("accountant", {
      targets: ["finance-section", "staffReport-section"],
      saved: "financeOps-section",
    });
    try {
      if (userChoosesFirst) w.Garage.navigate("staffReport-section");
      const section = w.document.createElement("section");
      section.id = "financeOps-section";
      section.innerHTML = "<h1>Expenses</h1>";
      w.document.querySelector("main").append(section);
      const button = w.document.createElement("button");
      button.className = "nav-item";
      button.dataset.target = section.id;
      button.textContent = "Expenses";
      w.document.querySelector("#sidebar nav").append(button);
      await tick();
      const expected = userChoosesFirst ? "staffReport-section" : "financeOps-section";
      assert.equal(w.document.querySelector("section.active-section").id, expected);
      assert.equal(w.localStorage.getItem("garage:accountant:section"), expected);
    } finally {
      dom.window.close();
    }
  }
});

test("mobile drawer closes with Escape or backdrop and restores accessible focus", async () => {
  const { dom, w } = await shell("customer", {
    mobile: true,
    targets: ["dashboard-section", "vehicles-section", "booking-section", "messages-section"],
  });
  try {
    const toggle = w.document.querySelector(".toggle-sidebar"),
      sidebar = w.document.getElementById("sidebar");
    toggle.click();
    assert.equal(toggle.getAttribute("aria-expanded"), "true");
    assert.equal(sidebar.inert, false);
    assert.equal(w.document.getElementById("content").inert, true);
    w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    assert.equal(w.document.activeElement, toggle);
    assert.equal(sidebar.inert, true);
    assert.equal(w.document.getElementById("content").inert, false);
    toggle.click();
    w.document.querySelector(".workspace-backdrop").click();
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    toggle.click();
    w.document.querySelector('[data-target="vehicles-section"]').click();
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    assert.equal(w.document.activeElement, w.document.querySelector("#vehicles-section h1"));
  } finally {
    dom.window.close();
  }
});

test("dashboard summaries fetch only enabled capabilities and leave unloaded counts unknown", async () => {
  const { dom, w, calls, listeners } = await shell("admin", {
    permissions: ["finance"],
    targets: ["dashboard-section", "finance-section", "financeOps-section", "report-section"],
    responses: {
      "/repairs": [
        { status: "completed", totalAmount: 1200000 },
        { status: "paid", totalAmount: 800000 },
      ],
      "/finance/expenses": new Error("Offline"),
    },
  });
  try {
    assert.equal(calls.includes("/vehicles"), false);
    assert.equal(calls.includes("/service/employees"), false);
    assert.equal(calls.includes("/maintenance/reminders"), false);
    assert.equal(calls.includes("/bookings"), false);
    assert.equal(calls.filter((path) => path === "/repairs").length, 1);
    const counts = [...w.document.querySelectorAll(".workspace-priority-row strong")].map(
      (node) => node.textContent,
    );
    assert.equal(counts[0], "1");
    assert.ok(counts[1].includes("1.200.000"));
    assert.equal(counts[2], "—");
    const summary = [...w.document.querySelectorAll(".workspace-stat-value")].map(
      (node) => node.textContent,
    );
    assert.deepEqual(summary, counts);
    assert.ok(
      w.document.querySelector(".workspace-update-status").textContent.includes("chưa tải được"),
    );
    const input = w.document.querySelector("#finance-section input");
    input.value = "Draft";
    w.document.querySelector(".workspace-stat").click();
    assert.equal(w.document.getElementById("finance-section").hidden, false);
    await listeners[0]({ background: true });
    assert.equal(input.value, "Draft");
  } finally {
    dom.window.close();
  }
});

test("the welcome treats account names as text and keeps quick actions within the available menu", async () => {
  const name = 'Người dùng <img src=x onerror="alert(1)">';
  const { dom, w, errors } = await shell("customer", {
    fullName: name,
    targets: ["dashboard-section", "vehicles-section", "booking-section"],
  });
  try {
    const welcome = w.document.querySelector(".workspace-welcome");
    assert.equal(welcome.querySelector("img"), null);
    assert.ok(welcome.querySelector("h1").textContent.includes("alert(1)"));
    const quick = w.document.querySelectorAll(".workspace-actions [data-workspace-go]");
    assert.equal(quick.length, 1);
    quick[0].click();
    assert.equal(w.document.getElementById("booking-section").hidden, false);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("delegated tab navigation works for later content and stays inside its section", async () => {
  const { dom, w } = await shell();
  try {
    const section = w.document.getElementById("service-section");
    section.insertAdjacentHTML(
      "beforeend",
      '<button class="tab-btn active" data-tab="first">First</button><button class="tab-btn" data-tab="second">Second</button><div id="first" class="tab-content active"></div><div id="second" class="tab-content"></div><section><button class="tab-btn active" data-tab="nested-first">Nested</button><div id="nested-first" class="tab-content active"></div></section>',
    );
    section.querySelector('[data-tab="second"]').click();
    assert.ok(w.document.getElementById("second").classList.contains("active"));
    assert.equal(w.document.getElementById("first").classList.contains("active"), false);
    assert.ok(w.document.getElementById("nested-first").classList.contains("active"));
  } finally {
    dom.window.close();
  }
});
