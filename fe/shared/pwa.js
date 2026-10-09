/* Public app shell only. Private API data is never stored by the service worker. */
document.addEventListener("DOMContentLoaded", () => {
  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/static/manifest.webmanifest";
    document.head.append(link);
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = "#0f172a";
    document.head.append(meta);
  }
  const status = document.createElement("div");
  status.className = "pwa-status";
  status.setAttribute("role", "status");
  status.hidden = true;
  document.body.prepend(status);
  function online() {
    status.hidden = navigator.onLine !== false;
    status.textContent =
      "Đang mất kết nối. Kết nối lại để tải dữ liệu hoặc lưu công việc; các thao tác chưa lưu vẫn ở màn hình hiện tại.";
  }
  window.addEventListener("offline", online);
  window.addEventListener("online", () => {
    online();
    window.Garage?.changed();
  });
  online();
  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker
      .register("/service-worker.js", { scope: "/" })
      .catch(() => window.Garage?.toast("Chưa bật được chế độ cài ứng dụng."));
  }
  let installEvent;
  const button = document.createElement("button");
  button.className = "btn btn-sm install-pwa";
  button.textContent = "Cài AutoPro";
  button.hidden = true;
  const sidebarFooter = document.querySelector("#sidebar .sidebar-footer");
  if (sidebarFooter) sidebarFooter.before(button);
  else (document.querySelector("header") || document.body).append(button);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installEvent = event;
    button.hidden = false;
  });
  button.onclick = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const answer = await installEvent.userChoice;
    if (answer.outcome === "accepted") button.hidden = true;
    installEvent = null;
  };
  window.addEventListener("appinstalled", () => {
    button.hidden = true;
  });
  if (
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !window.matchMedia?.("(display-mode: standalone)").matches
  ) {
    button.hidden = false;
    button.textContent = "Cài trên iPhone";
    button.onclick = () =>
      window.Garage?.toast("Mở bằng Safari → Chia sẻ → Thêm vào Màn hình chính.");
  }
});
