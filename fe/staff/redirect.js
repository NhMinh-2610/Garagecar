document.addEventListener("DOMContentLoaded", async () => {
  const user = await Garage.permissionsReady;
  if (user.role) location.replace("/" + user.role);
  else
    document.getElementById("redirectError").textContent =
      "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.";
});
