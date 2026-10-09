const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const root = path.resolve(__dirname, "..");
const flush = () => new Promise((resolve) => setTimeout(resolve, 20));
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );

async function moduleView(file, role, host, fixtures, permissions) {
  const dom = new JSDOM(
    `<nav></nav><main><section class="active-section"><div id="${host}"></div></section></main><h1 id="pageTitle"></h1>`,
    {
      url: "http://localhost:8000/",
      runScripts: "outside-only",
    },
  );
  const w = dom.window;
  await new Promise((resolve) => w.addEventListener("load", resolve, { once: true }));
  const user = { id: 1, role, fullName: "Test User", permissions };
  const listeners = [],
    errors = [];
  w.addEventListener("error", (event) => errors.push(event.error));
  w.localStorage.setItem("user", JSON.stringify(user));
  w.formatCurrency = (value) => `${value} đ`;
  w.formatDate = (value) => String(value);
  w.confirm = () => true;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new w.Event("close"));
  };
  w.Garage = {
    escape,
    permissionsReady: Promise.resolve(user),
    whenAllowed: async () => true,
    refreshGuard: () => () => true,
    date: (value) => new Date(value),
    toast: () => {},
    subscribe: (listener) => listeners.push(listener),
    request: async (url, options = {}) => {
      const value = fixtures[url];
      return typeof value === "function" ? value(options) : (value ?? []);
    },
  };
  w.eval(fs.readFileSync(path.join(root, "fe", "shared", file), "utf8"));
  w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
  await flush();
  return {
    dom,
    w,
    errors,
    refresh: async () => {
      await Promise.all(listeners.map((listener) => listener()));
      await flush();
    },
  };
}

test("professional tabs paginate independently and retain filters, selection and modal drafts on refresh", async () => {
  const fixtures = {
    "/hr/operations": {
      shifts: Array.from({ length: 12 }, (_, index) => ({
        id: index + 1,
        userId: 2,
        status: "scheduled",
        startsAt: "2026-10-10T08:00:00+07:00",
        endsAt: "2026-10-10T17:00:00+07:00",
        bay: `Bay ${index + 1}`,
        note: "Scheduled",
      })),
      certificates: [
        {
          id: 1,
          userId: 2,
          kind: "ev_safety",
          issuer: "EV One",
          certificateNumber: "EV-001",
          validFrom: "2026-01-01",
          validUntil: "2027-01-01",
          status: "active",
        },
        {
          id: 2,
          userId: 2,
          kind: "diagnostics",
          issuer: "Diagnostic Two",
          certificateNumber: "DG-002",
          validFrom: "2026-01-01",
          validUntil: "2027-01-01",
          status: "active",
        },
      ],
      leave: [],
    },
    "/service/employees": [{ id: 2, fullName: "Mechanic", role: "mechanic", isActive: true }],
  };
  const { dom, w, errors, refresh } = await moduleView(
    "professional.js",
    "hr",
    "hrOpsWorkspace",
    fixtures,
    ["hr"],
  );
  try {
    const host = w.document.getElementById("hrOpsWorkspace");
    const panel = (key) => host.querySelector(`[data-ops-panel="${key}"]`);
    const tab = (key) => host.querySelector(`[data-ops-tab="${key}"]`);
    assert.equal(host.querySelectorAll('[role="tabpanel"]:not([hidden])').length, 1);
    assert.equal(panel("shifts").querySelectorAll("tbody tr:not([hidden])").length, 10);
    panel("shifts").querySelector('[data-page="next"]').click();
    assert.equal(panel("shifts").querySelectorAll("tbody tr:not([hidden])").length, 2);
    tab("certificates").click();
    const search = panel("certificates").querySelector('input[type="search"]');
    search.value = "EV One";
    search.dispatchEvent(new w.Event("input"));
    assert.equal(panel("certificates").querySelectorAll("tbody tr:not([hidden])").length, 1);
    panel("certificates").querySelector('[data-ops="certificate"]').click();
    const form = w.document.querySelector("dialog form");
    form.elements.issuer.value = "Unsent draft";
    await refresh();
    assert.equal(w.document.querySelector("dialog form"), form);
    assert.equal(form.elements.issuer.value, "Unsent draft");
    assert.equal(tab("certificates").getAttribute("aria-selected"), "true");
    assert.equal(panel("certificates").querySelector('input[type="search"]').value, "EV One");
    tab("shifts").click();
    assert.equal(panel("shifts").querySelectorAll("tbody tr:not([hidden])").length, 2);
    host
      .querySelector('[role="tablist"]')
      .dispatchEvent(new w.KeyboardEvent("keydown", { key: "End", bubbles: true }));
    assert.equal(tab("leave").getAttribute("aria-selected"), "true");
    assert.equal(w.document.activeElement, tab("leave"));
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("service list exposes the next action, expands details and keeps focused filters across refresh", async () => {
  const visits = Array.from({ length: 15 }, (_, index) => ({
    id: index + 1,
    licensePlate: `30A-${index + 1}`,
    concern: `Concern ${index + 1} <safe>`,
    initialInspection: "Inspection",
    status: index === 0 ? "closed" : "awaiting_approval",
    quotes:
      index === 0
        ? []
        : [
            {
              id: index + 30,
              revision: 2,
              stage: "final",
              status: "pending",
              totalAmount: 250,
              items: [
                {
                  taskName: "Check <safe>",
                  partName: "Part",
                  quantity: 1,
                  partPrice: 200,
                  laborPrice: 50,
                  totalPrice: 250,
                },
              ],
            },
          ],
  }));
  const { dom, w, errors, refresh } = await moduleView(
    "service.js",
    "customer",
    "serviceWorkspace",
    { "/service/visits": visits },
    ["maintenance"],
  );
  try {
    const host = w.document.getElementById("serviceWorkspace");
    assert.equal(host.querySelectorAll("[data-visit-id]").length, 12);
    assert.equal(host.querySelector("safe"), null);
    const search = host.querySelector("#serviceSearch"),
      status = host.querySelector("#serviceStatus");
    status.value = "attention";
    status.dispatchEvent(new w.Event("change"));
    assert.match(host.querySelector("#serviceVisitCount").textContent, /^14/);
    search.value = "30A-2";
    search.dispatchEvent(new w.Event("input"));
    search.focus();
    const visit = host.querySelector('[data-visit-id="2"]');
    assert.ok(
      visit.querySelector('.visit-next-action [data-service="decision"][data-approved="true"]'),
    );
    const detail = visit.querySelector("details");
    assert.equal(detail.open, false);
    detail.open = true;
    await flush();
    await refresh();
    assert.equal(host.querySelector("#serviceSearch"), search);
    assert.equal(w.document.activeElement, search);
    assert.equal(search.value, "30A-2");
    assert.equal(status.value, "attention");
    assert.equal(host.querySelector('[data-visit-id="2"] details').open, true);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("maintenance separates reminders from research, preserves EV filters and ignores a stale vehicle response", async () => {
  let resolveFirst;
  const first = new Promise((resolve) => {
    resolveFirst = resolve;
  });
  const result = (component) => ({
    state: "unverified_profile",
    care: null,
    profile: null,
    rules: [
      {
        component,
        action: "inspect",
        status: "ok",
        dueKm: 10000,
        dueDate: "2027-01-01",
      },
    ],
    records: [],
  });
  const catalog = {
    components: [
      {
        code: "battery",
        name: "Pin EV",
        group: "Điện",
        inspection: "Kiểm tra pin",
      },
      {
        code: "engine_oil",
        name: "Dầu động cơ",
        group: "Động cơ",
        inspection: "Kiểm tra dầu",
      },
      ...Array.from({ length: 13 }, (_, index) => ({
        code: `part-${index}`,
        name: `Other part ${index}`,
        group: "Other",
        inspection: "Inspect",
      })),
    ],
    presets: [],
    brands: [
      {
        brand: "VinFast",
        models: ["VF 8"],
        notes: "Reference",
        sourceUrl: "https://example.com/manual",
        modelProfiles: [{ model: "VF 8", powertrain: "ev", componentCodes: ["battery"] }],
      },
    ],
  };
  const fixtures = {
    "/maintenance/catalog": catalog,
    "/maintenance/vehicles": [
      { id: 1, licensePlate: "30A-1", carBrand: "VinFast", carModel: "VF 8" },
      { id: 2, licensePlate: "30A-2", carBrand: "VinFast", carModel: "VF 8" },
    ],
    "/maintenance/reminders": Array.from({ length: 17 }, (_, index) => ({
      id: index + 1,
      status: index % 2 ? "published" : "pending",
      summary: {
        licensePlate: `30A-${index + 1}`,
        component: "battery",
        action: "inspect",
        status: "due",
        dueKm: 10000,
        dueDate: "2026-10-01",
        sourceUrl: "https://example.com/manual",
        sourcePage: "1",
      },
    })),
    "/maintenance/profiles": [],
    "/maintenance/vehicles/1": () => first,
    "/maintenance/vehicles/2": result("battery"),
  };
  const { dom, w, errors, refresh } = await moduleView(
    "maintenance.js",
    "advisor",
    "maintenanceWorkspace",
    fixtures,
    ["maintenance"],
  );
  try {
    const host = w.document.getElementById("maintenanceWorkspace");
    assert.equal(host.querySelectorAll('[role="tabpanel"]:not([hidden])').length, 1);
    assert.equal(host.querySelector('[data-care-panel="reminders"]').hidden, false);
    assert.equal(host.querySelectorAll(".care-reminder:not([hidden])").length, 8);
    host.querySelector('[data-care-page="next"]').click();
    assert.equal(host.querySelectorAll(".care-reminder:not([hidden])").length, 8);
    const reminderStatus = host.querySelector("#careReminderStatus");
    reminderStatus.value = "published";
    reminderStatus.dispatchEvent(new w.Event("change"));
    assert.equal(
      host.querySelectorAll('.care-reminder:not([hidden])[data-status="pending"]').length,
      0,
    );
    host.querySelector('[data-care-tab="library"]').click();
    assert.equal(host.querySelectorAll(".component-card:not([hidden])").length, 12);
    host.querySelector('[data-library-page="next"]').click();
    assert.equal(host.querySelectorAll(".component-card:not([hidden])").length, 3);
    await refresh();
    assert.equal(host.querySelectorAll(".component-card:not([hidden])").length, 3);
    assert.equal(host.querySelector("#careReminderStatus").value, "published");
    const brand = host.querySelector("#careBrand");
    brand.value = "VinFast";
    brand.dispatchEvent(new w.Event("change"));
    const model = host.querySelector("#careModel");
    model.value = "VF 8";
    model.dispatchEvent(new w.Event("change"));
    const search = host.querySelector("#careSearch");
    search.value = "pin";
    search.dispatchEvent(new w.Event("input"));
    await refresh();
    assert.equal(
      host.querySelector('[data-care-tab="library"]').getAttribute("aria-selected"),
      "true",
    );
    assert.equal(host.querySelector("#careBrand").value, "VinFast");
    assert.equal(host.querySelector("#careModel").value, "VF 8");
    assert.equal(host.querySelector("#careSearch").value, "pin");
    assert.equal(host.querySelectorAll(".component-card").length, 1);
    assert.match(host.querySelector("#componentLibrary").textContent, /Pin EV/);
    const vehicle = host.querySelector("#careVehicle");
    vehicle.value = "1";
    vehicle.dispatchEvent(new w.Event("change"));
    vehicle.value = "2";
    vehicle.dispatchEvent(new w.Event("change"));
    await flush();
    assert.match(host.querySelector("#careVehiclePanel").textContent, /Pin EV/);
    resolveFirst(result("engine_oil"));
    await flush();
    assert.equal(vehicle.value, "2");
    assert.doesNotMatch(host.querySelector("#careVehiclePanel").textContent, /Dầu động cơ/);
    assert.equal(host.querySelector('[data-care-panel="vehicle"]').hidden, false);
    assert.deepEqual(errors, []);
  } finally {
    resolveFirst(result("engine_oil"));
    dom.window.close();
  }
});
