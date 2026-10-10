const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const root = path.resolve(__dirname, "..");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const vehicle = {
  id: 1,
  licensePlate: "30A12345",
  customerName: "Customer <safe>",
  customerId: 3,
  phone: "0901234567",
  carBrand: "Toyota",
  carModel: "Vios",
  status: "waiting",
  receivedDate: "2026-09-28T00:00:00Z",
  repairTickets: [],
};
const part = {
  id: 1,
  name: "Oil <safe>",
  quantity: 10,
  unitPrice: 100,
  createdAt: "2026-09-28T00:00:00Z",
};
const mechanic = { id: 1, fullName: "Mechanic", userId: 2, status: "active" };

test("support chat preserves drafts, renders safe messages and retries with the same message ID", async () => {
  let unread = 1,
    fail = true;
  const thread = {
    id: 10,
    customerId: 1,
    customerName: "Customer <safe>",
    vehicleId: 1,
    licensePlate: vehicle.licensePlate,
    carBrand: "Toyota",
    carModel: "Vios",
    advisorId: 2,
    advisorName: "Advisor",
    status: "open",
    unreadCount: 1,
    lastMessage: "Welcome",
  };
  const rows = [
    {
      id: 11,
      senderId: 2,
      senderName: "Advisor <safe>",
      senderRole: "advisor",
      content: "<img src=x onerror=alert(1)>",
      createdAt: "2026-10-09T00:00:00Z",
    },
  ];
  const { dom, w, calls, errors } = await portal("customer", {
    "/messaging/conversations": (options) =>
      response(
        options.method === "POST"
          ? thread
          : { items: [{ ...thread, unreadCount: unread }], totalUnread: unread },
      ),
    "/messaging/conversations/10/messages": (options) => {
      if (options.method === "POST") {
        if (fail) {
          fail = false;
          return response(null, 503, "Lost connection");
        }
        const body = JSON.parse(options.body);
        rows.push({
          id: 13,
          senderId: 1,
          senderName: "Customer",
          senderRole: "customer",
          content: body.content,
          createdAt: "2026-10-09T00:01:00Z",
        });
        return response(rows.at(-1), 201);
      }
      return response({ conversation: thread, items: rows, customerReadId: 0, staffReadId: 13 });
    },
    "/messaging/conversations/10/read": () => {
      unread = 0;
      return response({ read: true });
    },
  });
  try {
    const $ = (id) => w.document.getElementById(id);
    assert.equal($("supportUnread").textContent, "1");
    w.document.querySelector('[data-target="messages-section"]').click();
    w.document.querySelector('[data-thread="10"]').click();
    await delay(70);
    assert.equal($("supportLog").querySelector("img"), null);
    assert.ok($("supportLog").textContent.includes("<img src=x"));
    const original = $("supportLog").firstElementChild;
    $("supportInput").value = "My draft";
    $("supportInput").dispatchEvent(new w.Event("input"));
    $("supportInput").focus();
    rows.push({
      id: 12,
      senderId: 2,
      senderName: "Advisor",
      senderRole: "advisor",
      content: "Describe the sound",
      createdAt: "2026-10-09T00:00:30Z",
    });
    await w.Garage.messaging.refresh();
    assert.equal($("supportInput").value, "My draft");
    assert.equal(w.document.activeElement, $("supportInput"));
    assert.equal($("supportLog").firstElementChild, original);
    assert.equal($("supportLog").querySelectorAll("article").length, 2);
    const submit = () =>
      $("supportForm").dispatchEvent(new w.Event("submit", { cancelable: true }));
    submit();
    await delay(60);
    assert.equal($("supportInput").value, "My draft");
    assert.ok($("supportError").textContent.includes("Lost connection"));
    submit();
    await delay(70);
    const sent = calls.filter(
      (call) => call.path === "/messaging/conversations/10/messages" && call.method === "POST",
    );
    assert.equal(sent.length, 2);
    assert.equal(sent[0].body.clientMessageId, sent[1].body.clientMessageId);
    assert.equal($("supportInput").value, "");
    assert.ok($("supportLog").textContent.includes("Đã đọc"));
    assert.ok(calls.some((call) => call.path === "/messaging/conversations/10/read"));
    assert.equal(w.localStorage.getItem("garage:data-changed"), null);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("AI question becomes a garage draft without sending it or replacing an existing draft", async () => {
  const thread = {
    id: 10,
    customerId: 1,
    vehicleId: 1,
    licensePlate: vehicle.licensePlate,
    status: "open",
    unreadCount: 0,
  };
  const { dom, w, calls, errors } = await portal("customer", {
    "/messaging/conversations": (options) =>
      response(options.method === "POST" ? thread : { items: [thread], totalUnread: 0 }),
    "/messaging/conversations/10/messages": {
      conversation: thread,
      items: [],
      customerReadId: 0,
      staffReadId: 0,
    },
  });
  try {
    const $ = (id) => w.document.getElementById(id);
    $("chatInput").value = "Xe rung khi phanh, garage kiểm tra được không?";
    $("chatVehicle").value = "1";
    $("chatToGarage").click();
    await delay(100);
    assert.ok($("messages-section").classList.contains("active-section"));
    assert.equal($("supportInput").value, $("chatInput").value);
    assert.equal(
      calls.find((call) => call.path === "/messaging/conversations" && call.method === "POST").body
        .vehicleId,
      1,
    );
    assert.equal(
      calls.filter((call) => call.path.endsWith("/messages") && call.method === "POST").length,
      0,
    );
    $("supportInput").value = "Existing unsent draft";
    $("supportInput").dispatchEvent(new w.Event("input"));
    $("chatToGarage").click();
    await delay(90);
    assert.equal($("supportInput").value, "Existing unsent draft");
    assert.ok($("supportError").textContent.includes("bản nháp"));
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("support timeout preserves the draft when the server already stored the message", async () => {
  let attempt = 0,
    stored;
  const thread = { id: 10, customerId: 1, status: "open", unreadCount: 0 };
  const { dom, w, calls, errors } = await portal("customer", {
    "/messaging/conversations": { items: [thread], totalUnread: 0 },
    "/messaging/conversations/10/messages": (options) => {
      if (options.method !== "POST")
        return response({
          conversation: thread,
          items: stored ? [stored] : [],
          staffReadId: 0,
          customerReadId: 0,
        });
      const body = JSON.parse(options.body);
      attempt++;
      if (attempt === 1) {
        stored = {
          id: 11,
          senderId: 1,
          senderName: "Customer",
          senderRole: "customer",
          content: body.content,
          createdAt: "2026-10-09T00:00:00Z",
        };
        return new Promise((resolve, reject) =>
          options.signal.addEventListener(
            "abort",
            () => reject(new w.DOMException("Timed out", "AbortError")),
            { once: true },
          ),
        );
      }
      return response(stored);
    },
    "/messaging/conversations/10/read": { read: true },
  });
  try {
    const $ = (id) => w.document.getElementById(id),
      originalTimeout = w.setTimeout.bind(w);
    w.setTimeout = (fn, ms) => originalTimeout(fn, ms === 15000 ? 20 : ms);
    w.document.querySelector('[data-target="messages-section"]').click();
    w.document.querySelector('[data-thread="10"]').click();
    await delay(50);
    $("supportInput").value = "Network retry";
    $("supportForm").dispatchEvent(new w.Event("submit", { cancelable: true }));
    await delay(60);
    assert.equal($("supportInput").value, "Network retry");
    assert.ok($("supportError").textContent.includes("Kết nối quá lâu"));
    await w.Garage.messaging.refresh();
    assert.equal($("supportLog").querySelectorAll("article").length, 1);
    $("supportForm").dispatchEvent(new w.Event("submit", { cancelable: true }));
    await delay(60);
    const sent = calls.filter(
      (call) => call.path === "/messaging/conversations/10/messages" && call.method === "POST",
    );
    assert.equal(sent[0].body.clientMessageId, sent[1].body.clientMessageId);
    assert.equal($("supportLog").querySelectorAll("article").length, 1);
    assert.equal($("supportInput").value, "");
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("advisor claims and closes chat, admin assigns chat, and feature restrictions hide the inbox", async () => {
  for (const role of ["advisor", "admin"]) {
    const thread = {
      id: 10,
      customerId: 3,
      customerName: "Customer",
      status: "open",
      advisorId: null,
      unreadCount: 0,
    };
    const { dom, w, calls, errors } = await portal(role, {
      "/messaging/conversations": { items: [thread], totalUnread: 0 },
      "/messaging/advisors": [{ id: 7, fullName: "Advisor Seven" }],
      "/messaging/conversations/10/messages": () =>
        response({ conversation: thread, items: [], customerReadId: 0, staffReadId: 0 }),
      "/messaging/conversations/10/assignment": (options) => {
        thread.advisorId = JSON.parse(options.body).advisorId;
        return response({ advisorId: thread.advisorId });
      },
      "/messaging/conversations/10/status": (options) => {
        thread.status = JSON.parse(options.body).status;
        return response({ status: thread.status });
      },
    });
    try {
      const $ = (id) => w.document.getElementById(id);
      w.document.querySelector('[data-target="messages-section"]').click();
      w.document.querySelector('[data-thread="10"]').click();
      await delay(70);
      if (role === "advisor") $("supportClaim").click();
      else {
        $("supportAdvisor").value = "7";
        $("supportAssign").click();
      }
      await delay(70);
      assert.equal(
        calls.find((call) => call.path.endsWith("/assignment")).body.advisorId,
        role === "advisor" ? 1 : 7,
      );
      $("supportStatus").click();
      await delay(70);
      assert.equal($("supportInput").disabled, true);
      assert.equal($("supportStatus").textContent, "Mở lại");
      $("supportStatus").click();
      await delay(70);
      assert.equal($("supportInput").disabled, false);
      assert.deepEqual(errors, []);
    } finally {
      dom.window.close();
    }
  }
  const { dom, w, calls, errors } = await portal("advisor", {
    "/auth/me": { id: 1, role: "advisor", fullName: "Advisor", disabledPermissions: ["messages"] },
  });
  try {
    assert.equal(w.document.querySelector('[data-target="messages-section"]').hidden, true);
    assert.equal(
      calls.some((call) => call.path.startsWith("/messaging")),
      false,
    );
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("customer chat keeps context, shares vehicle history only by choice and renders replies safely", async () => {
  const { dom, w, calls, errors } = await portal("customer", {
    "/ai/chat/info": {
      provider: "ollama",
      model: "test-model",
      isDemo: false,
      configured: true,
      usesExternalService: false,
    },
    "/ai/chat": {
      reply: "<img src=x onerror=alert(1)> Kiểm tra tại garage.",
      isDemo: false,
      sources: [
        { title: "Bad link", url: "javascript:alert(1)" },
        { title: "Hãng", url: "https://example.com/manual", type: "manufacturer_reference" },
      ],
    },
  });
  try {
    const $ = (id) => w.document.getElementById(id);
    w.document.querySelector('[data-target="chat-section"]').click();
    assert.ok($("chat-section").classList.contains("active-section"));
    assert.equal($("chatSend").disabled, false);
    const ask = async (text) => {
      $("chatInput").value = text;
      $("chatForm").dispatchEvent(new w.Event("submit", { cancelable: true }));
      await delay(60);
    };
    await ask("Xe rung");
    assert.equal(calls.find((c) => c.path === "/ai/chat").body.vehicleId, undefined);
    assert.equal($("chatMessages").querySelector("img"), null);
    assert.ok($("chatMessages").textContent.includes("<img src=x"));
    assert.equal($("chatMessages").querySelectorAll("a").length, 1);
    $("chatVehicle").value = "1";
    $("chatVehicle").dispatchEvent(new w.Event("change"));
    assert.equal($("chatUseHistory").disabled, false);
    $("chatUseHistory").checked = true;
    $("chatUseHistory").dispatchEvent(new w.Event("change"));
    await ask("Cần bảo dưỡng gì?");
    let sent = calls.filter((c) => c.path === "/ai/chat").at(-1).body;
    assert.equal(sent.vehicleId, 1);
    assert.equal(sent.messages.length, 1);
    await ask("Vậy tôi cần đến garage khi nào?");
    sent = calls.filter((c) => c.path === "/ai/chat").at(-1).body;
    assert.deepEqual(
      sent.messages.map((m) => m.role),
      ["user", "assistant", "user"],
    );
    $("chatVehicle").value = "";
    $("chatVehicle").dispatchEvent(new w.Event("change"));
    await ask("Hỏi chung");
    sent = calls.filter((c) => c.path === "/ai/chat").at(-1).body;
    assert.equal(sent.vehicleId, undefined);
    assert.equal(sent.messages.length, 1);
    $("chatBooking").click();
    assert.ok($("booking-section").classList.contains("active-section"));
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("chat keeps failed questions, prevents duplicate sends and labels demo replies", async () => {
  let finish;
  const { dom, w, calls, errors } = await portal("customer", {
    "/ai/chat/info": {
      provider: "mock",
      isDemo: true,
      configured: true,
      usesExternalService: false,
    },
    "/ai/chat": () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  try {
    const $ = (id) => w.document.getElementById(id);
    const submit = () => $("chatForm").dispatchEvent(new w.Event("submit", { cancelable: true }));
    assert.ok($("chatProvider").textContent.includes("demo"));
    $("chatInput").value = "Xe có tiếng kêu";
    submit();
    submit();
    await delay(20);
    assert.equal(calls.filter((c) => c.path === "/ai/chat").length, 1);
    assert.equal($("chatReset").disabled, true);
    assert.equal($("chatVehicle").disabled, true);
    finish(response(null, 503, "AI tạm thời chưa kết nối"));
    await delay(60);
    assert.equal($("chatInput").value, "Xe có tiếng kêu");
    assert.ok($("chatError").textContent.includes("AI tạm thời"));
    submit();
    await delay(20);
    finish(response({ reply: "Câu trả lời mẫu", isDemo: true }));
    await delay(60);
    assert.equal(calls.filter((c) => c.path === "/ai/chat").at(-1).body.messages.length, 1);
    assert.ok($("chatMessages").textContent.includes("[Câu trả lời mẫu]"));
    assert.equal($("chatInput").value, "");
    assert.equal($("chatSend").disabled, false);
    $("chatReset").click();
    assert.equal($("chatMessages").querySelectorAll("article").length, 0);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("admin creates customer account linked to a vehicle, edits activation and resets passwords", async () => {
  const account = {
    id: 3,
    username: "customer",
    fullName: "Customer",
    email: "c@example.com",
    role: "customer",
    isActive: true,
  };
  const { dom, w, calls, errors } = await portal("admin", {
    "/vehicles": [{ ...vehicle, customerId: null }],
    "/auth/users": (options) => response(options.method === "POST" ? { id: 9 } : [account]),
    "/auth/users/3": account,
  });
  try {
    const $ = (id) => w.document.getElementById(id);
    w.document.querySelector('[data-create-customer="1"]').click();
    assert.equal($("newRole").value, "customer");
    assert.equal($("staffMechanicId").disabled, true);
    assert.equal($("accountVehicleIds").value, "1");
    $("newUsername").value = "newcustomer";
    $("newEmail").value = "new@example.com";
    $("newPassword").value = "initial123";
    $("createUserForm").dispatchEvent(new w.Event("submit", { cancelable: true }));
    await delay(80);
    const create = calls.find((c) => c.path === "/auth/users" && c.method === "POST");
    assert.equal(create.body.role, "customer");
    assert.deepEqual(create.body.vehicleIds, [1]);
    assert.equal(create.body.mechanicId, null);
    assert.equal($("newPassword").value, "");
    w.document.querySelector('[data-user="3"][data-action="edit"]').click();
    let form = $("accountEditForm");
    form.elements.isActive.value = "false";
    form.dispatchEvent(new w.Event("submit", { cancelable: true }));
    await delay(80);
    assert.equal(
      calls.find((c) => c.path === "/auth/users/3" && c.method === "PUT").body.isActive,
      false,
    );
    w.document.querySelector('[data-user="3"][data-action="password"]').click();
    form = $("accountEditForm");
    form.elements.password.value = "changed123";
    form.elements.confirmPassword.value = "mismatch";
    form.dispatchEvent(new w.Event("submit", { cancelable: true }));
    assert.ok($("accountEditError").textContent.includes("không khớp"));
    form.elements.confirmPassword.value = "changed123";
    form.dispatchEvent(new w.Event("submit", { cancelable: true }));
    await delay(80);
    assert.deepEqual(calls.find((c) => c.path === "/auth/users/3/password").body, {
      password: "changed123",
    });
    $("btnAddMechanic").click();
    assert.equal($("newRole").value, "mechanic");
    assert.equal($("staffMechanicId").disabled, false);
    assert.equal($("customerVehicleField").hidden, true);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("all roles can access account details; failed password change retains session", async () => {
  for (const role of ["admin", "mechanic", "customer"]) {
    const { dom, w, calls, errors } = await portal(role, {
      "/auth/me": { id: 1, role, fullName: "Test", email: "test@example.com" },
      "/auth/me/password": () => response(null, 400, "Mật khẩu hiện tại không đúng"),
    });
    try {
      w.document.getElementById("myAccountButton").click();
      await delay(50);
      const form = w.document.getElementById("changePasswordForm");
      assert.ok(form);
      form.elements.currentPassword.value = "wrong123";
      form.elements.password.value = "next123";
      form.elements.confirmPassword.value = "next123";
      form.dispatchEvent(new w.Event("submit", { cancelable: true }));
      await delay(50);
      assert.ok(
        w.document.getElementById("passwordChangeError").textContent.includes("không đúng"),
      );
      assert.equal(w.localStorage.getItem("token"), "test");
      assert.deepEqual(calls.find((c) => c.path === "/auth/me/password").body, {
        currentPassword: "wrong123",
        password: "next123",
      });
      assert.deepEqual(errors, []);
    } finally {
      dom.window.close();
    }
  }
});

const response = (data, status = 200, message = "") =>
  new Response(JSON.stringify({ success: status < 400, data, message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const repairFixture = (id, status) => ({
  id,
  status,
  vehicleId: 1,
  vehicle,
  mechanicName: "Mechanic <safe>",
  totalAmount: 250,
  createdAt: "2026-09-28T01:00:00Z",
  startedAt: status !== "draft" ? "2026-09-28T02:00:00Z" : null,
  completedAt: ["completed", "paid"].includes(status) ? "2026-09-28T03:00:00Z" : null,
  paidAt: status === "paid" ? "2026-09-28T04:00:00Z" : null,
  items: [
    {
      id: 10,
      taskName: "Change oil <safe>",
      partName: part.name,
      quantity: 2,
      partPrice: 100,
      laborPrice: 50,
      totalPrice: 250,
      isCompleted: ["completed", "paid"].includes(status),
    },
  ],
});

test("customer filters by vehicle and status, opens safe cost breakdown and prints only paid receipts", async () => {
  const rows = ["draft", "working", "completed", "paid"].map((status, i) =>
    repairFixture(i + 1, status),
  );
  const { dom, w, errors, calls } = await portal("customer", {
    "/repairs/my-repairs": rows,
    "/repairs/4": rows[3],
    "/repairs/2": rows[1],
  });
  try {
    const $ = (id) => w.document.getElementById(id);
    assert.equal($("statActiveRepairs").textContent, "2");
    assert.equal($("statOutstanding").textContent, w.formatCurrency(250));
    assert.equal($("statPaid").textContent, w.formatCurrency(250));
    w.document.querySelector('[data-vehicle="1"]').click();
    assert.equal($("repairVehicle").value, "1");
    assert.ok($("repairs-section").classList.contains("active-section"));
    $("repairStatus").value = "paid";
    $("repairStatus").dispatchEvent(new w.Event("input"));
    assert.equal(w.document.querySelectorAll("#repairsTable tbody tr").length, 1);
    w.document.querySelector('#repairsTable [data-detail="4"]').click();
    await delay(60);
    assert.ok($("repairDetailModal").open);
    assert.ok($("repairDetailContent").textContent.includes("Change oil <safe>"));
    assert.equal($("repairDetailContent").querySelector("safe"), null);
    const cells = [...$("repairDetailContent").querySelectorAll("tbody td")].map(
      (td) => td.textContent,
    );
    assert.deepEqual(cells.slice(1, 5), [
      "2",
      w.formatCurrency(100),
      w.formatCurrency(50),
      w.formatCurrency(250),
    ]);
    let printed = false;
    w.print = () => {
      printed = true;
    };
    $("printReceipt").click();
    assert.ok(printed);
    $("closeRepairDetail").click();
    assert.equal($("repairDetailModal").open, false);
    $("repairStatus").value = "working";
    $("repairStatus").dispatchEvent(new w.Event("input"));
    w.document.querySelector('#repairsTable [data-detail="2"]').click();
    await delay(60);
    assert.equal($("printReceipt"), null);
    assert.ok(calls.some((c) => c.path === "/repairs/4"));
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("booking forms persist the same admin request and show its reference", async () => {
  for (const role of ["customer", "home"]) {
    const { dom, w, calls, errors } = await portal(
      role,
      { "/bookings": { id: 42 } },
      { anonymous: role === "home" },
    );
    try {
      const form = w.document.getElementById("bookingForm");
      form.elements.customerName.value = "Customer";
      form.elements.phone.value = "0901234567";
      form.elements.preferredDate.value = "2099-01-01";
      form.elements.service.value = "repair";
      form.elements.note.value = "30A12345 - kiểm tra phanh";
      form.dispatchEvent(new w.Event("submit", { cancelable: true }));
      form.dispatchEvent(new w.Event("submit", { cancelable: true }));
      await delay(60);
      const callsPost = calls.filter((c) => c.path === "/bookings" && c.method === "POST");
      assert.equal(callsPost.length, 1);
      assert.deepEqual(callsPost[0].body, {
        customerName: "Customer",
        phone: "0901234567",
        preferredDate: "2099-01-01",
        service: "repair",
        note: "30A12345 - kiểm tra phanh",
      });
      assert.ok(w.document.getElementById("bookingResult").textContent.includes("#42"));
      assert.equal(form.querySelector('[type="submit"]').disabled, false);
      assert.ok(form.elements.preferredDate.min);
      assert.deepEqual(errors, []);
    } finally {
      dom.window.close();
    }
  }
});

test("mechanic starts assigned ticket, toggles checklist, completes, and filters stock", async () => {
  const ticket = repairFixture(7, "draft");
  const { dom, w, calls, errors } = await portal("mechanic", {
    "/repairs/my-tasks": () => response([ticket]),
    "/repairs/7": (options) => {
      ticket.status = JSON.parse(options.body).status;
      return response(ticket);
    },
    "/repairs/7/items/10/toggle": (options) => {
      ticket.items[0].isCompleted = JSON.parse(options.body).isCompleted;
      return response(ticket);
    },
    "/workshop/tickets/7/items/10/evidence": (options) => response({ id: 1 }),
    "/inventory": [
      part,
      { ...part, id: 2, name: "Empty stock", quantity: 0 },
      { ...part, id: 3, name: "Low stock", quantity: 2 },
    ],
  });
  try {
    const $ = (id) => w.document.getElementById(id);
    assert.equal($("statWaiting").textContent, "1");
    assert.equal(w.document.querySelector("[data-item]").disabled, true);
    w.document.querySelector('[data-start="7"]').click();
    await delay(80);
    assert.equal(ticket.status, "working");
    assert.equal(w.document.querySelector("[data-complete]").disabled, true);
    const checkbox = w.document.querySelector("[data-item]");
    checkbox.checked = true;
    checkbox.dispatchEvent(new w.Event("change", { bubbles: true }));
    await delay(80);
    assert.equal(ticket.items[0].isCompleted, false);
    const form = w.document.querySelector(".evidence-dialog form");
    assert.ok(form);
    Object.defineProperty(form.elements.resultPhoto, "files", {
      value: [new w.File(["photo bytes"], "result.png", { type: "image/png" })],
    });
    form.reportValidity = () => true; // jsdom does not update native file validity for injected files.
    form.elements.note.value = "Measured and checked";
    form.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await delay(150);
    assert.ok(
      calls.some(
        (c) => c.path === "/workshop/tickets/7/items/10/evidence" && c.body.kind === "completion",
      ),
    );
    assert.equal(w.document.querySelector("[data-complete]").disabled, false);
    assert.equal(ticket.items[0].isCompleted, true);
    w.document.querySelector("[data-complete]").click();
    await delay(80);
    assert.equal(ticket.status, "completed");
    assert.equal($("statDone").textContent, "1");
    $("taskStatus").value = "done";
    $("taskStatus").dispatchEvent(new w.Event("input"));
    assert.equal(w.document.querySelector("[data-item]").disabled, true);
    $("taskSearch").value = "missing";
    $("taskSearch").dispatchEvent(new w.Event("input"));
    assert.equal(w.document.querySelectorAll(".task-card").length, 0);
    $("stockFilter").value = "empty";
    $("stockFilter").dispatchEvent(new w.Event("input"));
    assert.ok($("inventoryTable").textContent.includes("Empty stock"));
    assert.ok(!$("inventoryTable").textContent.includes("Low stock"));
    assert.deepEqual(
      calls.filter((c) => c.method === "PUT").map((c) => c.body),
      [{ status: "working" }, { isCompleted: true }, { status: "completed" }],
    );
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("mechanic restores server checklist on failed update", async () => {
  const ticket = repairFixture(7, "working");
  const { dom, w } = await portal("mechanic", {
    "/repairs/my-tasks": [ticket],
    "/repairs/7/items/10/toggle": () => response(null, 409, "Phiếu đã thay đổi"),
    "/workshop/tickets/7/items/10/evidence": () => response({ id: 1 }),
  });
  try {
    const checkbox = w.document.querySelector("[data-item]");
    checkbox.checked = true;
    checkbox.dispatchEvent(new w.Event("change", { bubbles: true }));
    await delay(80);
    const form = w.document.querySelector(".evidence-dialog form");
    Object.defineProperty(form.elements.resultPhoto, "files", {
      value: [new w.File(["photo bytes"], "result.png", { type: "image/png" })],
    });
    form.reportValidity = () => true;
    form.elements.note.value = "Checked result";
    form.dispatchEvent(new w.Event("submit", { cancelable: true }));
    await delay(150);
    assert.equal(w.document.querySelector("[data-item]").checked, false);
    assert.equal(w.document.querySelector("[data-item]").disabled, false);
    assert.ok(
      w.document
        .querySelector(".evidence-dialog .care-error")
        .textContent.includes("Phiếu đã thay đổi"),
    );
  } finally {
    dom.window.close();
  }
});

test("public welcome page renders real prices and service selection", async () => {
  const { dom, w, errors } = await portal(
    "home",
    { "/settings/wages": [{ id: 1, name: "Kiểm tra <safe>", price: 123000 }] },
    { anonymous: true },
  );
  try {
    assert.ok(w.document.getElementById("servicePrices").textContent.includes("123.000"));
    assert.equal(w.document.querySelector("#servicePrices safe"), null);
    w.document.querySelector('[data-service="repair"]').click();
    assert.equal(w.document.getElementById("bookingService").value, "repair");
    w.document.querySelector(".public-menu-toggle").click();
    assert.equal(
      w.document.querySelector(".public-menu-toggle").getAttribute("aria-expanded"),
      "true",
    );
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("auth supports register mode, password visibility and matching confirmation", async () => {
  const { dom, w, calls, errors } = await portal(
    "login",
    { "/auth/register": { id: 5 } },
    { anonymous: true, query: "?mode=register" },
  );
  try {
    const $ = (id) => w.document.getElementById(id);
    assert.ok($("registerForm").classList.contains("active"));
    w.document.querySelector('[data-password="registerPassword"]').click();
    assert.equal($("registerPassword").type, "text");
    $("registerFullName").value = "Customer";
    $("registerUsername").value = "customer";
    $("registerEmail").value = "c@example.com";
    $("registerPassword").value = "abcdef123";
    $("registerPasswordConfirm").value = "different";
    $("registerForm").dispatchEvent(new w.Event("submit", { cancelable: true }));
    assert.ok($("messageBox").textContent.includes("không khớp"));
    assert.equal(calls.filter((c) => c.path === "/auth/register").length, 0);
    $("registerPasswordConfirm").value = "abcdef123";
    $("registerForm").dispatchEvent(new w.Event("submit", { cancelable: true }));
    await delay(2100);
    assert.ok($("loginForm").classList.contains("active"));
    assert.equal($("loginEmail").value, "c@example.com");
    assert.deepEqual(calls.find((c) => c.path === "/auth/register").body, {
      fullName: "Customer",
      username: "customer",
      email: "c@example.com",
      password: "abcdef123",
    });
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("login preserves backend rate-limit feedback and allows retry", async () => {
  const { dom, w } = await portal(
    "login",
    { "/auth/login": () => response(null, 429, "Vui lòng thử lại sau 15 phút") },
    { anonymous: true },
  );
  try {
    w.document.getElementById("loginEmail").value = "c@example.com";
    w.document.getElementById("loginPassword").value = "abcdef123";
    const form = w.document.getElementById("loginForm");
    form.dispatchEvent(new w.Event("submit", { cancelable: true }));
    await delay(60);
    assert.ok(w.document.getElementById("messageBox").textContent.includes("15 phút"));
    assert.equal(form.querySelector('[type="submit"]').disabled, false);
  } finally {
    dom.window.close();
  }
});

async function portal(role, overrides = {}, options = {}) {
  const dir = path.join(root, "fe", role === "home" ? "" : role);
  const dom = new JSDOM(fs.readFileSync(path.join(dir, "index.html"), "utf8"), {
    url: `${options.origin || "http://localhost:8000"}/static/${role === "home" ? "" : role + "/"}index.html${options.query || ""}`,
    runScripts: "outside-only",
  });
  await new Promise((resolve) => dom.window.addEventListener("load", resolve, { once: true }));
  const w = dom.window,
    errors = [],
    calls = [];
  w.addEventListener("error", (e) => errors.push(e.error));
  w.console.error = (...args) => errors.push(args.map(String).join(" "));
  w.Headers = Headers;
  w.confirm = () => true;
  w.alert = () => {};
  w.setInterval = () => 0;
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new w.Event("close"));
  };
  if (!options.anonymous) {
    w.localStorage.setItem("token", "test");
    w.localStorage.setItem(
      "user",
      JSON.stringify({ id: 1, role: options.accountRole || role, fullName: "Test" }),
    );
  }
  w.fetch = async (url, options = {}) => {
    assert.equal(new URL(url).origin, w.location.origin, "API requests stay on the portal origin");
    const pathname = new URL(url).pathname.replace("/api", "");
    calls.push({
      path: pathname,
      method: options.method || "GET",
      body: options.body && JSON.parse(options.body),
    });
    if (typeof overrides[pathname] === "function") return overrides[pathname](options);
    const data =
      overrides[pathname] ??
      {
        "/vehicles": [vehicle],
        "/vehicles/my-vehicles": [vehicle],
        "/repairs": [],
        "/messaging/conversations": { items: [], totalUnread: 0, hasMore: false },
        "/messaging/advisors": [],
        "/repairs/my-repairs": [],
        "/repairs/my-tasks": [],
        "/inventory": [part],
        "/mechanics": [mechanic],
        "/auth/users": [{ id: 3, role: "customer", fullName: "Customer", email: "c@example.com" }],
        "/settings/brands": [{ id: 1, name: "Toyota" }],
        "/settings/wages": [{ id: 1, name: "Change oil", price: 50 }],
        "/hr/operations": { shifts: [], certificates: [], leave: [] },
        "/finance/expenses": [],
        "/finance/receipts": [],
        "/advisor/followups": [],
        "/workshop/tickets/7/evidence": [],
        "/settings/params": { max_cars_per_day: "30" },
        "/bookings": [],
        "/reports/revenue": [],
        "/service/visits": [],
        "/service/resources": {},
        "/service/employees": [],
      }[pathname] ??
      {};
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  for (const script of w.document.querySelectorAll("script[src]")) {
    if (/^https?:/.test(script.src) && new URL(script.src).origin !== w.location.origin) continue;
    const src = script.getAttribute("src").split("?")[0];
    const file = src.startsWith("/static/")
      ? path.join(root, "fe", src.slice(8))
      : path.resolve(dir, src);
    w.eval(fs.readFileSync(file, "utf8"));
  }
  w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
  await delay(120);
  return { dom, w, calls, errors };
}

test("a portal on a custom port loads vehicle data from the same server", async () => {
  const { dom, w, errors, calls } = await portal(
    "customer",
    {},
    { origin: "http://localhost:8001" },
  );
  try {
    assert.ok(calls.some((call) => call.path === "/vehicles/my-vehicles"));
    assert.ok(
      w.document.getElementById("vehicles-section").textContent.includes(vehicle.licensePlate),
    );
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

for (const role of ["admin", "customer", "mechanic", "advisor", "accountant", "hr"]) {
  test(`${role} portal loads its actual HTML and scripts without runtime errors`, async () => {
    const { dom, w, errors, calls } = await portal(role);
    try {
      assert.deepEqual(errors, []);
      assert.ok(w.document.querySelector("section.active-section"));
      assert.ok(calls.length > 0);
      assert.equal(w.Garage.base, "http://localhost:8000/api");
      const contentArea = w.document.querySelector(".content-body");
      assert.ok(contentArea);
      for (const button of w.document.querySelectorAll("#sidebar .nav-item[data-target]")) {
        const section = w.document.getElementById(button.dataset.target);
        assert.equal(
          section?.parentElement,
          contentArea,
          `${role}/${button.dataset.target} must share the same content margins`,
        );
      }
    } finally {
      dom.window.close();
    }
  });
}

test("repair editor submits IDs and quantities; reception opens the correct section", async () => {
  const { dom, w, calls, errors } = await portal("admin");
  try {
    await w.openRepairModalWithVehicle(1);
    assert.ok(w.document.getElementById("repair-section").classList.contains("active-section"));
    w.document.getElementById("mechanicSelect").value = "1";
    const task = w.document.getElementById("taskSelect");
    task.value = "Change oil";
    task.dispatchEvent(new w.Event("change"));
    const part = w.document.getElementById("partSelect");
    part.value = "1";
    part.dispatchEvent(new w.Event("change"));
    w.document.getElementById("partQuantity").value = "3";
    w.document.getElementById("btnAddItem").click();
    w.document.getElementById("btnSaveTicket").click();
    await delay(100);
    const request = calls.find((c) => c.path === "/repairs" && c.method === "POST");
    assert.ok(request);
    assert.equal(request.body.vehicleId, 1);
    assert.equal(request.body.mechanicId, 1);
    assert.deepEqual(request.body.items, [
      { taskName: "Change oil", inventoryId: 1, quantity: 3, laborPrice: 50 },
    ]);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("ticket creation opens the exact active visit and converts only its approved final quote", async () => {
  const visits = Array.from({ length: 14 }, (_, index) => ({
    id: index + 1,
    vehicleId: 1,
    licensePlate: vehicle.licensePlate,
    concern: "Old visit",
    status: "closed",
    quotes: [],
  }));
  visits.push({
    id: 42,
    vehicleId: 1,
    licensePlate: vehicle.licensePlate,
    concern: "Current visit",
    status: "ready",
    diagnosis: "Inspection complete",
    quotes: [
      { id: 8, stage: "final", status: "approved", revision: 2, totalAmount: 250, items: [] },
    ],
  });
  const { dom, w, calls, errors } = await portal("admin", {
    "/service/visits": visits,
    "/service/resources": { mechanics: [mechanic] },
  });
  try {
    const host = w.document.getElementById("serviceWorkspace");
    const status = host.querySelector("#serviceStatus");
    status.value = "closed";
    status.dispatchEvent(new w.Event("change"));
    host.querySelector('[data-service-page="next"]').click();
    await w.openRepairModalWithVehicle(1);
    assert.ok(w.document.getElementById("service-section").classList.contains("active-section"));
    assert.equal(w.document.getElementById("repairModal").style.display, "none");
    assert.equal(status.value, "all");
    assert.equal(host.querySelectorAll("[data-visit-id]").length, 1);
    const current = host.querySelector('[data-visit-id="42"]');
    assert.ok(current.querySelector("details").open);
    assert.equal(w.document.activeElement, current);
    assert.equal(
      calls.some((call) => call.method !== "GET"),
      false,
    );
    current.querySelector('[data-service="convert"]').click();
    const form = w.document.querySelector("dialog.care-dialog form");
    assert.equal(form.elements.mechanicId.value, "1");
    form.dispatchEvent(new w.Event("submit", { cancelable: true }));
    await delay(100);
    const converted = calls.filter((call) => call.method === "POST");
    assert.equal(converted.length, 1);
    assert.equal(converted[0].path, "/service/quotes/8/convert");
    assert.deepEqual(converted[0].body, { mechanicId: 1 });
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("selecting a vehicle with an open visit blocks direct creation and keeps draft items", async () => {
  const visit = {
    id: 42,
    vehicleId: 1,
    licensePlate: vehicle.licensePlate,
    concern: "Inspect",
    status: "intake",
    quotes: [],
  };
  const { dom, w, calls, errors } = await portal("admin", {
    "/service/visits": [visit],
    "/vehicles": [vehicle, { ...vehicle, id: 2, licensePlate: "30A22222" }],
  });
  try {
    const $ = (id) => w.document.getElementById(id);
    $("btnNewRepair").click();
    await delay(100);
    const task = $("taskSelect");
    task.value = "Change oil";
    task.dispatchEvent(new w.Event("change"));
    $("btnAddItem").click();
    $("repairVehicleSelect").value = "1";
    $("repairVehicleSelect").dispatchEvent(new w.Event("change"));
    assert.equal($("repairWorkflowNotice").hidden, false);
    assert.match($("repairWorkflowMessage").textContent, /#42/);
    assert.equal($("btnSaveTicket").disabled, true);
    $("btnSaveTicket").click();
    assert.equal(
      calls.some((call) => call.method === "POST"),
      false,
    );
    $("repairVehicleSelect").value = "2";
    $("repairVehicleSelect").dispatchEvent(new w.Event("change"));
    assert.equal($("repairWorkflowNotice").hidden, true);
    assert.equal($("btnSaveTicket").disabled, false);
    assert.match($("repairItemsTable").textContent, /Change oil/);
    $("repairVehicleSelect").value = "1";
    $("repairVehicleSelect").dispatchEvent(new w.Event("change"));
    $("btnOpenServiceVisit").click();
    await delay(100);
    assert.equal($("repairModal").style.display, "none");
    assert.ok($("serviceWorkspace").querySelector('[data-visit-id="42"]'));
    assert.equal(
      calls.some((call) => call.method === "POST"),
      false,
    );
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("saving rechecks new service visits and preserves the repair draft on a failed lookup", async () => {
  let visitCreated = false,
    fail = false;
  const { dom, w, calls, errors } = await portal("admin", {
    "/service/visits": () =>
      fail
        ? response(null, 503, "Cannot load visits")
        : response(
            visitCreated
              ? [
                  {
                    id: 42,
                    vehicleId: 1,
                    licensePlate: vehicle.licensePlate,
                    concern: "Inspect",
                    status: "intake",
                    quotes: [],
                  },
                ]
              : [],
          ),
  });
  try {
    const $ = (id) => w.document.getElementById(id);
    await w.openRepairModalWithVehicle(1);
    $("taskSelect").value = "Change oil";
    $("taskSelect").dispatchEvent(new w.Event("change"));
    $("btnAddItem").click();
    fail = true;
    $("btnSaveTicket").click();
    await delay(100);
    assert.equal(
      calls.some((call) => call.method === "POST"),
      false,
    );
    assert.equal($("repairModal").style.display, "block");
    assert.match($("repairItemsTable").textContent, /Change oil/);
    assert.equal($("btnSaveTicket").disabled, false);
    fail = false;
    visitCreated = true;
    $("btnSaveTicket").click();
    await delay(100);
    assert.equal($("repairWorkflowNotice").hidden, false);
    assert.equal($("btnSaveTicket").disabled, true);
    assert.equal($("repairModal").style.display, "block");
    assert.match($("repairItemsTable").textContent, /Change oil/);
    assert.equal(
      calls.some((call) => call.method === "POST"),
      false,
    );
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

for (const status of ["draft", "working"]) {
  test(`assignment of a ${status} ticket preserves the approved quote`, async () => {
    const ticket = {
      id: 7,
      vehicleId: 1,
      vehicle,
      mechanicId: 1,
      mechanicName: mechanic.fullName,
      serviceVisitId: 42,
      status,
      totalAmount: 50,
      items: [
        {
          id: 1,
          taskName: "Change oil",
          inventoryId: null,
          quantity: 1,
          laborPrice: 50,
          partPrice: 0,
        },
      ],
    };
    const { dom, w, calls, errors } = await portal("admin", {
      "/repairs": [ticket],
      "/service/visits": [
        {
          id: 42,
          vehicleId: 1,
          licensePlate: vehicle.licensePlate,
          status: "in_workshop",
          ticketId: 7,
          quotes: [],
        },
      ],
    });
    try {
      w.document.querySelector('[data-action="edit"][data-id="7"]').click();
      await delay(100);
      assert.equal(w.document.getElementById("repairModal").style.display, "block");
      assert.equal(w.document.getElementById("repairWorkflowNotice").hidden, true);
      assert.equal(w.document.getElementById("btnAddItem").disabled, true);
      assert.equal(w.document.querySelector("#repairModal .editor-panel").hidden, true);
      assert.equal(w.document.querySelector('[data-action="delete"][data-id="7"]'), null);
      w.document.getElementById("btnSaveTicket").click();
      await delay(100);
      const updated = calls.find((call) => call.path === "/repairs/7" && call.method === "PUT");
      assert.ok(updated);
      assert.deepEqual(updated.body, { mechanicId: 1 });
      assert.equal(
        calls.some((call) => call.method === "POST"),
        false,
      );
      assert.deepEqual(errors, []);
    } finally {
      dom.window.close();
    }
  });
}

test("an HTML gateway error keeps the draft and reports a readable retry message", async () => {
  const { dom, w, errors } = await portal("admin", {
    "/repairs": (options) =>
      options.method === "POST"
        ? new Response("<html>Bad gateway</html>", {
            status: 502,
            headers: { "Content-Type": "text/html" },
          })
        : response([]),
  });
  try {
    await w.openRepairModalWithVehicle(1);
    const $ = (id) => w.document.getElementById(id);
    $("taskSelect").value = "Change oil";
    $("taskSelect").dispatchEvent(new w.Event("change"));
    $("btnAddItem").click();
    $("btnSaveTicket").click();
    await delay(100);
    assert.equal($("repairModal").style.display, "block");
    assert.match($("repairItemsTable").textContent, /Change oil/);
    assert.match($("toast-container").textContent, /Máy chủ tạm thời/);
    assert.doesNotMatch($("toast-container").textContent, /Unexpected token|Bad gateway/);
    assert.equal($("btnSaveTicket").disabled, false);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("existing stock uses atomic receipt endpoint instead of creating duplicate material", async () => {
  const { dom, w, calls } = await portal("admin");
  try {
    const select = w.document.getElementById("existingInventory");
    select.value = "1";
    select.dispatchEvent(new w.Event("change"));
    w.document.getElementById("invQuantity").value = "5";
    w.document
      .getElementById("importForm")
      .dispatchEvent(new w.Event("submit", { cancelable: true }));
    await delay(100);
    const request = calls.find((c) => c.path === "/inventory/1/receive");
    assert.ok(request);
    assert.equal(request.body.quantity, 5);
    assert.equal(w.document.querySelector("#inventoryTable script"), null);
    assert.ok(w.document.querySelector("#inventoryTable").textContent.includes("Oil <safe>"));
  } finally {
    dom.window.close();
  }
});

test("admin keeps related intake views separate and opens stock entry only when requested", async () => {
  const { dom, w, calls, errors } = await portal("admin");
  try {
    const $ = (id) => w.document.getElementById(id);
    assert.equal($("reception-vehicles").classList.contains("active"), true);
    assert.equal($("reception-bookings").classList.contains("active"), false);
    w.Garage.navigate("reception-section");
    w.document.querySelector('[data-tab="reception-bookings"]').click();
    assert.equal($("reception-bookings").classList.contains("active"), true);
    assert.equal($("reception-vehicles").classList.contains("active"), false);
    w.Garage.navigate("inventory-section");
    assert.equal($("stockImportDialog").open, false);
    $("btnNewStockImport").click();
    assert.equal($("stockImportDialog").open, true);
    $("closeStockImport").click();
    w.document.querySelector('[data-stock="1"][data-action="receive"]').click();
    assert.equal($("stockImportDialog").open, true);
    assert.equal($("existingInventory").value, "1");
    assert.equal(w.document.activeElement, $("invQuantity"));
    assert.equal(
      calls.some((call) => call.method === "POST"),
      false,
    );
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("admin sections have distinct controls and inventory search works", async () => {
  const { dom, w, errors } = await portal("admin");
  try {
    const ids = [...w.document.querySelectorAll("[id]")].map((el) => el.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const section of ["repair", "inventory", "finance", "report", "hr"]) {
      assert.equal(
        w.document.querySelectorAll("#" + section + "-section .metrics .metric").length,
        4,
      );
    }
    const search = w.document.getElementById("inventorySearch");
    search.value = "does not exist";
    search.dispatchEvent(new w.Event("input"));
    assert.match(w.document.getElementById("inventoryTable").textContent, /Không tìm thấy/);
    search.value = "Oil";
    search.dispatchEvent(new w.Event("input"));
    assert.match(w.document.getElementById("inventoryTable").textContent, /Oil <safe>/);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("finance distinguishes pending amounts from received money and reopens old receipts", async () => {
  const repair = {
    id: 1,
    vehicle,
    mechanicId: 1,
    mechanicName: "Mechanic",
    items: [],
    status: "completed",
    totalAmount: 250,
  };
  const paid = {
    ...repair,
    id: 2,
    status: "paid",
    totalAmount: 100,
    paidAt: new Date().toISOString(),
  };
  const { dom, w, errors } = await portal("admin", { "/repairs": [repair, paid] });
  try {
    assert.equal(w.document.getElementById("financePending").textContent, "1");
    assert.equal(w.document.getElementById("financePaidCount").textContent, "1");
    assert.equal(
      w.document.getElementById("financeOutstanding").textContent,
      w.formatCurrency(250),
    );
    assert.equal(w.document.getElementById("financeMonth").textContent, w.formatCurrency(100));
    w.document.querySelector('[data-invoice="2"]').click();
    assert.match(w.document.querySelector(".invoice-details").textContent, /Đã thu tiền/);
    assert.equal(w.document.getElementById("confirmPayment").disabled, true);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("reports render real aggregates and wage editor uses the selected record", async () => {
  const { dom, w, calls, errors } = await portal("admin", {
    "/reports/revenue": [
      { brand: "Toyota", count: 2, revenue: 200 },
      { brand: "Honda", count: 1, revenue: 100 },
    ],
  });
  try {
    assert.equal(w.document.getElementById("reportCount").textContent, "3");
    assert.equal(w.document.getElementById("reportRevenue").textContent, w.formatCurrency(300));
    assert.equal(w.document.getElementById("reportAverage").textContent, w.formatCurrency(100));
    assert.equal(w.document.getElementById("exportReport").disabled, false);
    w.document.querySelector('[data-kind="wages"]').click();
    const form = w.document.getElementById("catalogEdit");
    assert.equal(form.elements.name.value, "Change oil");
    form.elements.price.value = "75";
    form.dispatchEvent(new w.Event("submit", { cancelable: true }));
    await delay(80);
    assert.ok(
      calls.some(
        (c) => c.path === "/settings/wages/1" && c.method === "PUT" && c.body.price === 75,
      ),
    );
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("maintenance catalogue, exact scopes and history editor use structured data", async () => {
  const catalog = JSON.parse(
    fs.readFileSync(path.join(root, "be/data/maintenance_catalog.json"), "utf8"),
  );
  const profile = { id: 2, ...catalog.presets[0], status: "approved" };
  const { dom, w, calls, errors } = await portal("admin", {
    "/maintenance/catalog": catalog,
    "/maintenance/vehicles": [vehicle],
    "/maintenance/profiles": [profile],
    "/maintenance/reminders": [],
    "/maintenance/vehicles/1": {
      state: "missing_vehicle_details",
      care: null,
      profile: null,
      rules: [],
      records: [],
    },
  });
  try {
    w.document.querySelector('[data-target="maintenance-section"]').click();
    const select = w.document.getElementById("careVehicle");
    select.value = "1";
    select.dispatchEvent(new w.Event("change"));
    await delay(80);
    assert.match(w.document.getElementById("careVehiclePanel").textContent, /Chưa có năm xe/);
    const brand = w.document.getElementById("careBrand");
    brand.value = "Mitsubishi";
    brand.dispatchEvent(new w.Event("change"));
    assert.match(w.document.getElementById("brandGuidance").textContent, /4N16/);
    assert.equal(w.document.querySelectorAll(".component-card").length, catalog.components.length);
    w.document.querySelector('[data-care="profile"]').click();
    const form = w.document.querySelector(".care-dialog form");
    const preset = w.document.getElementById("carePreset");
    preset.value = "0";
    preset.dispatchEvent(new w.Event("change"));
    assert.equal(form.elements.market.value, "MY");
    assert.equal(form.querySelectorAll(".care-rule").length, 5);
    form.dispatchEvent(new w.Event("submit", { cancelable: true }));
    await delay(80);
    const call = calls.find((c) => c.path === "/maintenance/profiles" && c.method === "POST");
    assert.ok(call);
    assert.equal(call.body.scope.market, "MY");
    assert.equal(call.body.scope.yearFrom, 2023);
    assert.equal(call.body.rules.find((r) => r.component === "coolant").repeatKm, null);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("customer approves the displayed quotation revision and cannot edit scopes", async () => {
  const catalog = JSON.parse(
    fs.readFileSync(path.join(root, "be/data/maintenance_catalog.json"), "utf8"),
  );
  const visit = {
    id: 4,
    vehicleId: 1,
    licensePlate: "30A12345",
    concern: "Oil <safe>",
    initialInspection: "Inspection",
    status: "awaiting_approval",
    quotes: [
      {
        id: 10,
        revision: 2,
        stage: "final",
        status: "pending",
        totalAmount: 250,
        items: [
          {
            taskName: "Change <safe>",
            partName: "Oil",
            quantity: 2,
            partPrice: "100",
            laborPrice: "50",
            totalPrice: "250",
          },
        ],
      },
    ],
  };
  const { dom, w, calls, errors } = await portal("customer", {
    "/service/visits": [visit],
    "/maintenance/catalog": catalog,
    "/maintenance/vehicles": [vehicle],
    "/maintenance/reminders": [],
  });
  try {
    assert.ok(w.document.querySelector('[data-service="decision"][data-id="10"]'));
    assert.equal(w.document.querySelector('[data-service="intake"]'), null);
    assert.equal(w.document.querySelector('[data-care="profile"]'), null);
    assert.equal(w.document.querySelector("#serviceWorkspace safe"), null);
    w.document.querySelector('[data-service="decision"][data-approved="true"]').click();
    const form = w.document.querySelector(".care-dialog form");
    form.elements.note.value = "Please proceed";
    form.dispatchEvent(new w.Event("submit", { cancelable: true }));
    await delay(80);
    const call = calls.find((c) => c.path === "/service/quotes/10/decision");
    assert.deepEqual(call.body, { approved: true, note: "Please proceed" });
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("staff portals load only their job functions and accountant waits for QC", async () => {
  for (const role of ["advisor", "accountant", "hr"]) {
    const overrides = {
      "/auth/me": { id: 1, role, fullName: "Staff", disabledPermissions: [] },
      "/auth/customer-lookup": [],
      "/service/employees": [],
      "/service/visits": [],
      "/maintenance/vehicles": [],
      "/maintenance/profiles": [],
      "/maintenance/reminders": [],
      "/maintenance/catalog": { components: [], brands: [], presets: [] },
      "/service/resources": { vehicles: [], mechanics: [], inventory: [] },
    };
    if (role === "accountant")
      overrides["/repairs"] = [
        { id: 1, serviceVisitId: 3, status: "completed", vehicle, totalAmount: 250, items: [] },
      ];
    const { dom, w, calls, errors } = await portal(role, overrides, { accountRole: role });
    try {
      assert.deepEqual(errors, []);
      const visible = [...w.document.querySelectorAll(".nav-item:not([hidden])")].map(
        (n) => n.dataset.permission,
      );
      assert.ok(
        visible.includes(
          role === "advisor" ? "workshop" : role === "accountant" ? "finance" : "hr",
        ),
      );
      assert.ok(!calls.some((c) => c.path === "/auth/users"));
      if (role === "accountant") {
        assert.equal(w.document.querySelector('[data-staff="pay"]').disabled, true);
        assert.ok(!calls.some((c) => c.path === "/maintenance/profiles"));
      }
    } finally {
      dom.window.close();
    }
  }
});

test("PWA precache files exist and authenticated APIs are never intercepted", async () => {
  const vm = require("node:vm"),
    handlers = {};
  const script = fs.readFileSync(path.join(root, "fe/service-worker.js"), "utf8");
  vm.runInNewContext(script, {
    self: {
      location: { origin: "https://garage.example" },
      addEventListener: (type, fn) => (handlers[type] = fn),
    },
    URL,
  });
  let intercepted = false;
  for (const request of [
    {
      url: "https://garage.example/api/maintenance/vehicles/1",
      method: "GET",
      headers: new Headers(),
      mode: "cors",
    },
    {
      url: "https://garage.example/static/customer/index.html",
      method: "GET",
      headers: new Headers({ Authorization: "Bearer x" }),
      mode: "navigate",
    },
  ]) {
    handlers.fetch({
      request,
      respondWith: () => {
        intercepted = true;
      },
    });
  }
  assert.equal(intercepted, false);
  const files = [...script.matchAll(/["']\/static\/([^"']+)["']/g)].map((m) => m[1]);
  for (const file of new Set(files)) assert.ok(fs.existsSync(path.join(root, "fe", file)), file);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "fe/manifest.webmanifest"), "utf8"));
  assert.equal(manifest.display, "standalone");
  for (const icon of manifest.icons)
    assert.ok(fs.existsSync(path.join(root, "fe", icon.src.slice(8))));
});

test("VinFast model filter excludes combustion parts on an EV", async () => {
  const catalog = JSON.parse(
    fs.readFileSync(path.join(root, "be/data/maintenance_catalog.json"), "utf8"),
  );
  const { dom, w, errors } = await portal("advisor", {
    "/maintenance/catalog": catalog,
    "/maintenance/vehicles": [],
    "/maintenance/profiles": [],
    "/maintenance/reminders": [],
    "/auth/customer-lookup": [],
    "/service/resources": { vehicles: [], mechanics: [], inventory: [] },
  });
  try {
    const brand = w.document.getElementById("careBrand");
    brand.value = "VinFast";
    brand.dispatchEvent(new w.Event("change"));
    const model = w.document.getElementById("careModel");
    model.value = "VF 8";
    model.dispatchEvent(new w.Event("change"));
    const library = w.document.getElementById("componentLibrary").textContent;
    assert.ok(library.includes("Mạch làm mát pin"));
    assert.ok(!library.includes("Dầu động cơ"));
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("independent staff pages contain only their job menus and operations", async () => {
  for (const role of ["advisor", "accountant", "hr"]) {
    const { dom, w, calls, errors } = await portal(role, {
      "/maintenance/catalog": { components: [], brands: [], presets: [] },
      "/maintenance/vehicles": [],
      "/maintenance/profiles": [],
      "/maintenance/reminders": [],
      "/auth/customer-lookup": [],
    });
    try {
      assert.equal(w.document.body.dataset.staffRole, role);
      const pages = [...w.document.querySelectorAll("main section")].map((x) => x.id);
      if (role === "advisor") {
        assert.ok(pages.includes("advisorOps-section"));
        assert.ok(!pages.includes("finance-section"));
        assert.ok(!calls.some((x) => x.path.startsWith("/finance/")));
      }
      if (role === "accountant") {
        assert.ok(pages.includes("financeOps-section"));
        assert.ok(!pages.includes("staffHR-section"));
        assert.ok(!calls.some((x) => x.path === "/service/employees"));
      }
      if (role === "hr") {
        assert.ok(pages.includes("hrOps-section"));
        assert.ok(!pages.includes("service-section"));
        assert.ok(!calls.some((x) => x.path === "/repairs"));
      }
      assert.deepEqual(errors, []);
    } finally {
      dom.window.close();
    }
  }
});
