/* Support chat updates only its own list and message bubbles; drafts never get rerendered. */
document.addEventListener("DOMContentLoaded", async () => {
  const host = document.getElementById("supportWorkspace");
  if (!host) return;
  const me = await Garage.permissionsReady;
  if (!["customer", "advisor", "admin"].includes(me.role) || !me.permissions.includes("messages"))
    return;
  const customer = me.role === "customer",
    e = Garage.escape;
  host.innerHTML = `<div class="section-heading"><div><p class="eyebrow">CHAT / ${customer ? "GARAGE" : "KHÁCH HÀNG"}</p><h1 id="supportTitle">${customer ? "Nhắn garage" : "Hộp thư khách hàng"}</h1><p class="section-description">Tin nhắn được lưu trong tài khoản. Tự cập nhật mỗi 5 giây khi trang đang mở.</p></div><button class="btn" id="supportRefresh" type="button">Làm mới tin nhắn</button></div>
    <p id="supportError" class="inline-message error" role="alert" hidden></p><div class="support-layout">
    <aside class="card support-inbox">${customer ? `<div class="support-new"><label for="supportVehicle">Trao đổi về xe</label><select id="supportVehicle"><option value="">Tư vấn chung</option></select><button id="supportNew" class="btn btn-primary" type="button">Bắt đầu / Mở hội thoại</button><button id="supportAskAI" class="btn" type="button">Hỏi AI trước</button></div>` : ""}
    <label for="supportSearch">Tìm hội thoại</label><input type="search" id="supportSearch" maxlength="100" placeholder="${customer ? "Tên, biển số…" : "Tên khách, biển số…"}"><div id="supportList" class="support-list"></div>
    <div class="support-pagination"><button id="supportPrev" class="btn btn-sm" type="button" disabled>Trước</button><button id="supportNext" class="btn btn-sm" type="button" disabled>Sau</button></div></aside>
    <div class="card support-thread"><div id="supportEmpty" class="support-empty"><strong>${customer ? "Garage sẵn sàng nhận câu hỏi của bạn" : "Chọn một hội thoại để trả lời"}</strong><p>${customer ? "Chọn xe hoặc tư vấn chung rồi bắt đầu. Garage sẽ trả lời khi có nhân viên phụ trách." : "Nhận phụ trách trước khi trả lời. Các hội thoại chưa phân công nằm trong hộp thư chung."}</p></div>
    <div id="supportConversation" hidden><div class="support-thread-header"><div><h3 id="supportSubject"></h3><p id="supportMeta" class="muted"></p></div><button id="supportStatus" class="btn btn-sm" type="button" ${customer ? "hidden" : ""}>Kết thúc</button></div>
    <div class="support-tools" ${customer ? "hidden" : ""}><button id="supportClaim" class="btn" type="button" ${me.role !== "advisor" ? "hidden" : ""}>Nhận phụ trách</button>${me.role === "admin" ? '<label for="supportAdvisor">Cố vấn<select id="supportAdvisor"><option value="">Chưa phân công</option></select></label><button id="supportAssign" class="btn" type="button">Phân công</button>' : ""}</div>
    <button id="supportOlder" class="btn btn-sm" type="button" hidden>Xem tin cũ hơn</button><div id="supportLog" class="support-log" role="log" aria-label="Tin nhắn với garage" aria-live="polite" aria-relevant="additions text"></div>
    <form id="supportForm" class="support-compose"><label for="supportInput">Tin nhắn</label><textarea id="supportInput" rows="3" maxlength="4000" required placeholder="Mô tả tình trạng xe hoặc câu hỏi cần garage hỗ trợ…"></textarea><div class="support-compose-actions"><span id="supportSendState" class="muted" role="status"></span><button id="supportSend" class="btn btn-primary" type="submit">Gửi tin nhắn</button></div></form></div></div></div>`;
  const $ = (id) => document.getElementById(id);
  const api = async (path, options = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      return await Garage.request("/messaging" + path, {
        notifyChange: false,
        silent: true,
        ...options,
        signal: controller.signal,
      });
    } catch (failure) {
      if (failure.name === "AbortError")
        throw new Error("Kết nối quá lâu. Hãy thử lại; bản nháp vẫn được giữ.");
      if (failure instanceof TypeError)
        throw new Error("Chưa kết nối được garage. Kiểm tra mạng rồi thử lại.");
      throw failure;
    } finally {
      clearTimeout(timeout);
    }
  };
  const drafts = new Map(),
    nodes = new Map();
  let selected = null,
    inbox = [],
    messages = [],
    offset = 0,
    generation = 0,
    inboxGeneration = 0,
    unreadTotal = 0;
  let sending = false,
    polling = false,
    changing = false,
    lastMarked = 0,
    retry = null;
  let vehicleChoiceReady;
  const visible = () =>
    document.visibilityState !== "hidden" &&
    $("messages-section").classList.contains("active-section");
  const showError = (message) => {
    $("supportError").textContent = message;
    $("supportError").hidden = !message;
  };
  const scope = (id) => (id == null ? "" : String(id));
  function setBusy() {
    for (const id of [
      "supportSend",
      "supportInput",
      "supportNew",
      "supportVehicle",
      "supportClaim",
      "supportAssign",
      "supportStatus",
      "supportAdvisor",
    ]) {
      if ($(id))
        $(id).disabled =
          sending ||
          changing ||
          (!customer &&
            selected?.status === "closed" &&
            ["supportSend", "supportInput"].includes(id));
    }
    $("supportList")
      .querySelectorAll("button")
      .forEach((button) => (button.disabled = sending || changing));
  }
  function metadata(thread) {
    selected = { ...thread };
    $("supportSubject").textContent = customer
      ? thread.licensePlate || "Tư vấn chung"
      : thread.customerName;
    $("supportMeta").textContent = [
      thread.licensePlate
        ? `${thread.licensePlate} · ${thread.carBrand || ""} ${thread.carModel || ""}`
        : "Tư vấn chung",
      thread.advisorName ? `Cố vấn: ${thread.advisorName}` : "Chờ cố vấn tiếp nhận",
      thread.status === "closed" ? "Đã kết thúc" : "Đang trao đổi",
    ].join(" · ");
    $("supportStatus").textContent = thread.status === "closed" ? "Mở lại" : "Kết thúc";
    $("supportClaim").hidden = me.role !== "advisor" || Boolean(thread.advisorId);
    // Do not replace an admin's selection while they are choosing an assignee.
    if ($("supportAdvisor") && document.activeElement !== $("supportAdvisor"))
      $("supportAdvisor").value = scope(thread.advisorId);
    setBusy();
  }
  function renderInbox(data) {
    inbox = data.items || [];
    unreadTotal = data.totalUnread ?? unreadTotal;
    const badge = $("supportUnread");
    if (badge) {
      badge.textContent = unreadTotal > 99 ? "99+" : String(unreadTotal);
      badge.hidden = !unreadTotal;
    }
    $("supportPrev").disabled = offset === 0;
    $("supportNext").disabled = !data.hasMore;
    const list = $("supportList");
    const signature = JSON.stringify([inbox, selected?.id, sending, changing]);
    if (list.dataset.signature === signature) return;
    list.dataset.signature = signature;
    list.replaceChildren();
    for (const thread of inbox) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.thread = thread.id;
      button.className = "support-contact" + (selected?.id === thread.id ? " active" : "");
      button.setAttribute("aria-pressed", String(selected?.id === thread.id));
      button.disabled = sending || changing;
      button.innerHTML = `<strong>${e(customer ? thread.licensePlate || "Tư vấn chung" : thread.customerName)}${thread.unreadCount ? `<span class="support-badge">${Number(thread.unreadCount)}</span>` : ""}</strong><small>${e(customer ? thread.advisorName || "Chờ garage tiếp nhận" : thread.licensePlate || "Tư vấn chung")} · ${thread.status === "closed" ? "Đã kết thúc" : "Đang mở"}</small><small>${e(thread.lastMessage || "Chưa có tin nhắn")}</small>`;
      list.append(button);
    }
    if (!inbox.length)
      list.textContent = $("supportSearch").value
        ? "Không tìm thấy hội thoại."
        : "Chưa có hội thoại.";
  }
  async function loadInbox() {
    const stamp = ++inboxGeneration;
    const data = await api(
      `/conversations?offset=${offset}&q=${encodeURIComponent($("supportSearch").value.trim())}`,
    );
    if (stamp === inboxGeneration) renderInbox(data);
  }
  const timeText = (value) =>
    Garage.date(value)?.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) || "";
  function insertMessages(items, receipts, older = false) {
    const log = $("supportLog"),
      nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 100;
    const oldHeight = log.scrollHeight;
    const added = [];
    for (const message of items) {
      if (nodes.has(message.id)) continue;
      const node = document.createElement("article");
      node.className = "chat-message" + (message.senderId === me.id ? " user" : "");
      node.dataset.message = message.id;
      const title = document.createElement("strong"),
        text = document.createElement("p"),
        stamp = document.createElement("small");
      title.textContent =
        message.senderId === me.id
          ? "Bạn"
          : `${message.senderName} · ${message.senderRole === "customer" ? "Khách hàng" : "Garage"}`;
      text.textContent = message.content;
      stamp.className = "support-message-time";
      node.append(title, text, stamp);
      nodes.set(message.id, node);
      messages.push(message);
      added.push(message);
    }
    messages.sort((a, b) => a.id - b.id);
    for (const message of added.sort((a, b) => a.id - b.id)) {
      const anchor = messages.find(
        (next) => next.id > message.id && nodes.get(next.id).parentNode === log,
      );
      log.insertBefore(nodes.get(message.id), anchor ? nodes.get(anchor.id) : null);
    }
    for (const message of messages) {
      const node = nodes.get(message.id);
      const label = `${timeText(message.createdAt)}${message.senderId === me.id ? (message.id <= (customer ? receipts.staffReadId : receipts.customerReadId) ? " · Đã đọc" : " · Đã gửi") : ""}`;
      if (node.querySelector("small").textContent !== label)
        node.querySelector("small").textContent = label;
    }
    if (older) log.scrollTop += log.scrollHeight - oldHeight;
    else if (nearBottom || items.some((message) => message.senderId === me.id))
      log.scrollTop = log.scrollHeight;
  }
  async function markRead() {
    if (!selected || !visible() || !messages.length || lastMarked >= messages.at(-1).id) return;
    const id = selected.id,
      throughMessageId = messages.at(-1).id,
      stamp = generation;
    await api(`/conversations/${id}/read`, {
      method: "POST",
      body: { throughMessageId },
    });
    if (stamp === generation) {
      lastMarked = throughMessageId;
      await loadInbox();
    }
  }
  async function loadMessages(older = false) {
    if (!selected) return;
    const stamp = generation,
      id = selected.id;
    const cursor = older
      ? messages[0]?.id
        ? `?before=${messages[0].id}`
        : ""
      : messages.at(-1)?.id
        ? `?after=${messages.at(-1).id}`
        : "";
    const data = await api(`/conversations/${id}/messages${cursor}`);
    if (stamp !== generation) return;
    if (data.conversation) metadata(data.conversation);
    insertMessages(data.items || [], data, older);
    if (older || !cursor) $("supportOlder").hidden = !data.hasMore;
    await markRead();
  }
  async function openThread(thread) {
    if (sending || changing) return;
    if (selected) drafts.set(selected.id, $("supportInput").value);
    generation++;
    selected = thread;
    messages = [];
    nodes.clear();
    lastMarked = 0;
    retry = null;
    $("supportLog").replaceChildren();
    $("supportEmpty").hidden = true;
    $("supportConversation").hidden = false;
    $("supportInput").value = drafts.get(thread.id) || "";
    $("supportSendState").textContent = "";
    metadata(thread);
    showError("");
    if (customer) $("supportVehicle").value = scope(thread.vehicleId);
    renderInbox({
      items: inbox,
      hasMore: !$("supportNext").disabled,
      totalUnread: unreadTotal,
    });
    try {
      await loadMessages();
    } catch (failure) {
      showError(failure.message);
    }
  }
  async function ensureConversation(vehicleId) {
    const thread = await api("/conversations", {
      method: "POST",
      body: { vehicleId: vehicleId || null },
    });
    await openThread(thread);
    await loadInbox();
    return thread;
  }
  $("supportNew")?.addEventListener("click", async () => {
    try {
      await ensureConversation(Number($("supportVehicle").value) || null);
    } catch (failure) {
      showError(failure.message);
    }
  });
  $("supportAskAI")?.addEventListener("click", () =>
    document.querySelector('[data-target="chat-section"]')?.click(),
  );
  $("supportList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-thread]");
    if (button) openThread(inbox.find((thread) => thread.id === Number(button.dataset.thread)));
  });
  $("supportInput").addEventListener("input", () => {
    if (selected) drafts.set(selected.id, $("supportInput").value);
  });
  let searchTimer;
  $("supportSearch").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      offset = 0;
      loadInbox().catch((failure) => showError(failure.message));
    }, 250);
  });
  for (const [id, step] of [
    ["supportPrev", -50],
    ["supportNext", 50],
  ])
    $(id).addEventListener("click", () => {
      offset = Math.max(0, offset + step);
      loadInbox().catch((failure) => showError(failure.message));
    });
  async function refresh() {
    if (
      polling ||
      changing ||
      document.visibilityState === "hidden" ||
      !localStorage.getItem("token")
    )
      return;
    polling = true;
    try {
      await loadInbox();
      if (visible() && !sending) await loadMessages();
    } catch (failure) {
      if (visible())
        showError(
          "Chưa cập nhật được tin nhắn: " + failure.message + ". Nội dung đang nhập vẫn được giữ.",
        );
    } finally {
      polling = false;
    }
  }
  $("supportRefresh").addEventListener("click", refresh);
  $("supportOlder").addEventListener("click", () =>
    loadMessages(true).catch((failure) => showError(failure.message)),
  );
  document
    .querySelector('[data-target="messages-section"]')
    .addEventListener("click", () => setTimeout(refresh, 0));
  document.addEventListener("visibilitychange", () => {
    if (visible()) refresh();
  });
  window.addEventListener("focus", refresh);
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (value) =>
      (
        Number(value) ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(value) / 4)))
      ).toString(16),
    );
  }
  $("supportForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const content = $("supportInput").value.trim();
    if (!selected || sending || changing || !content || !$("supportForm").reportValidity()) return;
    const id = selected.id,
      stamp = generation;
    if (!retry || retry.id !== id || retry.content !== content)
      retry = { id, content, key: uuid() };
    sending = true;
    setBusy();
    showError("");
    $("supportSendState").textContent = "Đang gửi…";
    try {
      await api(`/conversations/${id}/messages`, {
        method: "POST",
        body: { content, clientMessageId: retry.key },
      });
      if (stamp !== generation) return;
      retry = null;
      $("supportInput").value = "";
      drafts.delete(id);
      $("supportForm").reset();
      $("supportSendState").textContent = "Đã gửi";
      await loadMessages();
      await loadInbox();
    } catch (failure) {
      showError(failure.message);
      $("supportSendState").textContent = "Chưa xác nhận gửi · bấm Gửi để thử lại";
    } finally {
      sending = false;
      setBusy();
    }
  });
  async function staffAction(path, body) {
    if (!selected || sending || changing) return;
    changing = true;
    setBusy();
    showError("");
    try {
      await api(`/conversations/${selected.id}/${path}`, {
        method: "PUT",
        body,
      });
      await loadInbox();
      await loadMessages();
    } catch (failure) {
      showError(failure.message);
    } finally {
      changing = false;
      setBusy();
    }
  }
  $("supportClaim").addEventListener("click", () =>
    staffAction("assignment", { advisorId: me.id }),
  );
  $("supportAssign")?.addEventListener("click", () =>
    staffAction("assignment", {
      advisorId: Number($("supportAdvisor").value) || null,
    }),
  );
  $("supportStatus").addEventListener("click", () =>
    staffAction("status", {
      status: selected?.status === "closed" ? "open" : "closed",
    }),
  );
  Garage.openSupport = async ({ question = "", vehicleId = null } = {}) => {
    if (!customer) return;
    document.querySelector('[data-target="messages-section"]')?.click();
    await vehicleChoiceReady;
    try {
      await ensureConversation(vehicleId);
      if (question) {
        if ($("supportInput").value.trim()) {
          showError("Bạn đang có bản nháp. Hãy gửi hoặc xóa bản nháp trước khi chuyển câu hỏi AI.");
          return;
        }
        $("supportInput").value = question.slice(0, 4000);
        drafts.set(selected.id, $("supportInput").value);
        $("supportInput").focus();
        $("supportSendState").textContent =
          "Câu hỏi được chuyển thành bản nháp; bấm Gửi khi bạn sẵn sàng.";
      }
    } catch (failure) {
      showError(failure.message);
    }
  };
  Garage.messaging = { refresh };
  document.addEventListener("garage:section", (event) => {
    if (event.detail?.target === "messages-section") refresh();
  });
  if (customer) {
    vehicleChoiceReady = Garage.request("/vehicles/my-vehicles")
      .then((vehicles) => {
        for (const vehicle of vehicles) {
          const option = document.createElement("option");
          option.value = vehicle.id;
          option.textContent = `${vehicle.licensePlate} · ${vehicle.carBrand} ${vehicle.carModel || ""}`;
          $("supportVehicle").append(option);
        }
      })
      .catch((failure) => showError(failure.message));
  }
  if (me.role === "admin")
    api("/advisors")
      .then((advisors) => {
        for (const advisor of advisors) {
          const option = document.createElement("option");
          option.value = advisor.id;
          option.textContent = advisor.fullName;
          $("supportAdvisor").append(option);
        }
      })
      .catch((failure) => showError(failure.message));
  try {
    await loadInbox();
  } catch (failure) {
    showError(failure.message);
  }
  setInterval(refresh, 5000);
});
