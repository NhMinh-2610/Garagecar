/* Both public and customer booking forms submit the same admin-managed request. */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("bookingForm");
  if (!form) return;
  const date = form.elements.preferredDate;
  const today = () => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type).value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  };
  date.min = today();
  let user;
  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch {
    /* Public visitors have no account. */
  }
  if (user?.role === "customer") form.elements.customerName.value = user.fullName || "";
  const message = document.getElementById("bookingResult");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    date.min = today();
    if (!form.reportValidity()) return;
    const button = form.querySelector('[type="submit"]');
    if (button.disabled) return;
    const label = button.textContent;
    button.disabled = true;
    button.textContent = "Đang gửi…";
    message.hidden = true;
    try {
      const body = Object.fromEntries(new FormData(form));
      for (const key of ["customerName", "phone", "note"]) body[key] = body[key].trim();
      const data = await Garage.request("/bookings", { method: "POST", body });
      message.className = "inline-message";
      message.textContent = `Đã nhận yêu cầu #${data.id} cho ngày ${body.preferredDate.split("-").reverse().join("/")}. Garage sẽ liên hệ qua ${body.phone} để xác nhận. Vui lòng lưu mã yêu cầu này.`;
      form.reset();
      if (user?.role === "customer") form.elements.customerName.value = user.fullName || "";
    } catch (error) {
      message.className = "inline-message error";
      message.textContent = error.message;
    } finally {
      message.hidden = false;
      button.disabled = false;
      button.textContent = label;
    }
  });
});
