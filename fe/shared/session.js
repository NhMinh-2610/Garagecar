/* Mở đúng portal theo tài khoản; API kiểm tra quyền truy cập cho từng yêu cầu. */
document.addEventListener("DOMContentLoaded", async () => {
  const signOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    location.replace("/login");
  };
  const role = document.body.dataset.role;
  let user;
  try {
    user = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    signOut();
    return;
  }
  if (!localStorage.getItem("token") || !user || !Garage.isKnownRole(user.role)) {
    signOut();
    return;
  }
  if (user.role !== role) {
    location.replace(Garage.portalPath(user.role));
    return;
  }
  Garage.initPortal(role);
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    if (confirm("Bạn có chắc muốn đăng xuất?")) signOut();
  });
  try {
    user = await Garage.permissionsReady;
    if (!user) return;
    if (user.role !== role) {
      location.replace(Garage.portalPath(user.role));
      return;
    }
    const name = document.querySelector(".user-info h4");
    const label = document.querySelector(".user-info small");
    if (name) name.textContent = user.fullName || user.username;
    if (label) label.textContent = Garage.roleName(user.role);
  } catch {
    // shared/access.js đã xử lý lỗi xác thực và kết nối.
  }
});
