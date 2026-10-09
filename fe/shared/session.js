/* Khoi dong portal theo tai khoan; quyen truy cap duoc API kiem tra lai. */
document.addEventListener("DOMContentLoaded", async () => {
  const routes = {
    admin: "/admin",
    advisor: "/advisor",
    accountant: "/accountant",
    hr: "/hr",
    mechanic: "/mechanic",
    customer: "/customer",
  };
  const names = {
    admin: "Quản trị viên",
    advisor: "Cố vấn dịch vụ",
    accountant: "Kế toán",
    hr: "Nhân sự",
    mechanic: "Kỹ thuật viên",
    customer: "Khách hàng",
  };
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
  if (!localStorage.getItem("token") || !user || !routes[user.role]) {
    signOut();
    return;
  }
  if (user.role !== role) {
    location.replace(routes[user.role]);
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
      location.replace(routes[user.role] || "/login");
      return;
    }
    const name = document.querySelector(".user-info h4");
    const label = document.querySelector(".user-info small");
    if (name) name.textContent = user.fullName || user.username;
    if (label) label.textContent = names[user.role];
  } catch {
    // Loi xac thuc va ket noi duoc xu ly tai shared/access.js.
  }
});
