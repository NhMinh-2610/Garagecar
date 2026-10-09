/* In-memory conversation; vehicle history is opt-in and checked again by the server. */
(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const $ = (id) => document.getElementById(id);
    if (!$("chatForm")) return;
    const history = [];
    let busy = false,
      ready = false,
      controller;
    const error = (message) => {
      $("chatError").textContent = message;
      $("chatError").hidden = !message;
    };
    const controls = (value) => {
      busy = value;
      for (const id of ["chatInput", "chatVehicle", "chatReset"]) $(id).disabled = value;
      $("chatUseHistory").disabled = value || !$("chatVehicle").value;
      $("chatSend").disabled = value || !ready;
      $("chatPending").hidden = !value;
      $("chatStop").hidden = !value;
      $("chatMessages").setAttribute("aria-busy", String(value));
      document
        .querySelectorAll("[data-chat-question]")
        .forEach((button) => (button.disabled = value));
    };
    const reset = () => {
      history.length = 0;
      $("chatMessages").replaceChildren();
      const welcome = document.createElement("p");
      welcome.className = "chat-empty";
      welcome.textContent = "Bạn mô tả triệu chứng, thời điểm xuất hiện và đèn báo nhé.";
      $("chatMessages").append(welcome);
      error("");
    };
    function addMessage(role, text, sources = []) {
      $("chatMessages").querySelector(".chat-empty")?.remove();
      const node = document.createElement("article");
      node.className = `chat-message ${role}`;
      const name = document.createElement("strong");
      name.textContent = role === "user" ? "Bạn" : "Trợ lý xe";
      const content = document.createElement("p");
      content.textContent = text;
      node.append(name, content);
      const links = document.createElement("div");
      links.className = "chat-sources";
      for (const source of sources) {
        try {
          const url = new URL(source.url);
          if (!["https:", "http:"].includes(url.protocol)) continue;
          const link = document.createElement("a");
          link.href = url.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = `${source.type === "approved_schedule" ? "Lịch đã duyệt" : "Tham khảo hãng"}: ${source.title}`;
          links.append(link);
        } catch {
          /* Ignore malformed source URLs. */
        }
      }
      if (links.children.length) node.append(links);
      $("chatMessages").append(node);
      while ($("chatMessages").children.length > 40) $("chatMessages").firstElementChild.remove();
      $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
      return node;
    }
    $("chatInput").addEventListener(
      "input",
      () => ($("chatCount").textContent = `${$("chatInput").value.length} / 2000`),
    );
    $("chatReset").addEventListener("click", reset);
    $("chatVehicle").addEventListener("change", () => {
      $("chatUseHistory").checked = false;
      controls(false);
      reset();
    });
    $("chatUseHistory").addEventListener("change", reset);
    $("chatStop").addEventListener("click", () => controller?.abort());
    $("chatBooking").addEventListener("click", () =>
      document.querySelector('[data-target="booking-section"]')?.click(),
    );
    $("chatToGarage")?.addEventListener("click", () => {
      const question =
        $("chatInput").value.trim() ||
        [...history].reverse().find((message) => message.role === "user")?.content;
      if (!question) {
        error("Hãy nhập câu hỏi hoặc chọn một gợi ý trước khi chuyển cho cố vấn.");
        return;
      }
      if (!Garage.openSupport) {
        error("Tính năng nhắn garage chưa sẵn sàng hoặc đã bị khóa.");
        return;
      }
      Garage.openSupport({
        question,
        vehicleId: Number($("chatVehicle").value) || null,
      });
    });
    document.querySelectorAll("[data-chat-question]").forEach((button) =>
      button.addEventListener("click", () => {
        $("chatInput").value = button.dataset.chatQuestion;
        $("chatInput").dispatchEvent(new Event("input"));
        $("chatInput").focus();
      }),
    );
    $("chatForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const question = $("chatInput").value.trim();
      if (busy || !ready || !question || !$("chatForm").reportValidity()) return;
      const messages = [...history, { role: "user", content: question }];
      // Keep whole user/assistant pairs within backend context limits.
      while (
        messages.length > 21 ||
        messages.reduce((sum, item) => sum + item.content.length, 0) > 16000
      )
        messages.splice(0, 2);
      const body = { messages };
      if ($("chatUseHistory").checked && $("chatVehicle").value)
        body.vehicleId = Number($("chatVehicle").value);
      controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 110000);
      const bubble = addMessage("user", question);
      controls(true);
      error("");
      try {
        const answer = await Garage.request("/ai/chat", {
          method: "POST",
          body,
          signal: controller.signal,
          notifyChange: false,
        });
        if (!answer?.reply) throw new Error("AI chưa trả về câu trả lời. Hãy thử lại.");
        history.splice(0, history.length, ...messages, {
          role: "assistant",
          content: answer.reply.slice(0, 4000),
        });
        addMessage(
          "assistant",
          `${answer.isDemo ? "[Câu trả lời mẫu]\n" : ""}${answer.reply}`,
          answer.sources || [],
        );
        $("chatInput").value = "";
        $("chatCount").textContent = "0 / 2000";
        $("chatForm").reset();
      } catch (failure) {
        bubble.classList.add("failed");
        error(
          failure.name === "AbortError"
            ? "Đã dừng chờ. Câu hỏi vẫn được giữ để bạn gửi lại."
            : failure.message,
        );
      } finally {
        clearTimeout(timer);
        controller = null;
        controls(false);
        $("chatInput").focus();
      }
    });
    Garage.request("/ai/chat/info")
      .then((info) => {
        ready = Boolean(info.configured);
        $("chatProvider").textContent = !ready
          ? "AI chưa được cấu hình"
          : info.isDemo
            ? "Chế độ demo · câu trả lời mẫu"
            : `LLM · ${info.model || info.provider}`;
        $("chatProvider").classList.toggle("demo", Boolean(info.isDemo));
        $("chatPrivacy").textContent =
          `${info.usesExternalService ? "Câu hỏi được gửi đến dịch vụ AI bên ngoài. Khi bật sử dụng hồ sơ, thông tin kỹ thuật và lịch sử sửa xe đã chọn cũng được gửi; không tự gửi tên, điện thoại, địa chỉ hay VIN." : "Hồ sơ chỉ được gửi đến AI khi bạn bật lựa chọn này."} Chat giữ trong trang đang mở, không lưu vào database. Khi đổi xe hoặc lựa chọn hồ sơ, hội thoại bắt đầu lại.`;
        if (!ready) error("Garage cần cấu hình dịch vụ LLM ở backend để mở chat.");
        controls(false);
      })
      .catch((failure) => {
        $("chatProvider").textContent = "Chưa kết nối được AI";
        error(failure.message);
      });
    Garage.request("/vehicles/my-vehicles")
      .then((vehicles) => {
        for (const vehicle of vehicles) {
          const option = document.createElement("option");
          option.value = vehicle.id;
          option.textContent = `${vehicle.licensePlate} · ${vehicle.carBrand} ${vehicle.carModel || ""}`;
          $("chatVehicle").append(option);
        }
      })
      .catch(() => {
        $("chatVehicle").disabled = true;
      });
  });
})();
