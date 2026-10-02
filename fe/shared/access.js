/* Read current capabilities once; a hidden menu is complemented by API enforcement. */
window.Garage.permissionsReady = window.Garage.request("/auth/me")
  .then((me) => {
    const cached = JSON.parse(localStorage.getItem("user") || "{}");
    const user = me?.role ? me : cached;
    const defaults = {
      admin: [
        "reception",
        "workshop",
        "maintenance",
        "catalog",
        "finance",
        "reports",
        "hr",
        "accounts",
      ],
      advisor: ["reception", "workshop", "maintenance"],
      accountant: ["finance", "reports"],
      hr: ["hr"],
      mechanic: ["workshop", "maintenance"],
      customer: ["maintenance"],
    };
    if (me?.role) localStorage.setItem("user", JSON.stringify(me));
    return {
      ...user,
      permissions: (defaults[user.role] || []).filter(
        (p) => !(user.disabledPermissions || []).includes(p),
      ),
    };
  })
  .catch(() => ({ permissions: [] }));
window.Garage.whenAllowed = async (domain) => {
  const me = await Garage.permissionsReady;
  return (Array.isArray(domain) ? domain : [domain]).every((p) =>
    me.permissions.includes(p),
  );
};
document.addEventListener("DOMContentLoaded", async () => {
  const me = await Garage.permissionsReady;
  if (!me.role) return;
  const adminDomains = {
    dashboard: ["reception", "workshop", "finance"],
    reception: ["reception"],
    repair: ["workshop"],
    inventory: ["catalog"],
    finance: ["finance"],
    report: ["reports"],
    hr: ["hr"],
    service: ["workshop"],
    maintenance: ["maintenance"],
  };
  const domains =
    me.role === "admin"
      ? adminDomains
      : me.role === "mechanic"
        ? {
            tasks: ["workshop"],
            inventory: ["workshop"],
            service: ["workshop"],
            maintenance: ["maintenance"],
          }
        : me.role === "customer"
          ? { maintenance: ["maintenance"] }
          : {};
  document.querySelectorAll(".nav-item").forEach((btn) => {
    const keys = domains[btn.dataset.target?.replace("-section", "")] || [];
    btn.hidden = !keys.every((p) => me.permissions.includes(p));
    btn.disabled = btn.hidden;
  });
  if (document.querySelector(".nav-item.active")?.hidden)
    document.querySelector(".nav-item:not([hidden])")?.click();
});
