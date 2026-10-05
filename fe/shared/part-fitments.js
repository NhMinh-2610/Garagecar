/* Human-entered fitment records require a source; model hints are not OEM codes. */
Garage.openPartFitments = async (stock, onSaved) => {
  const e = Garage.escape,
    d = document.createElement("dialog");
  d.className = "care-dialog";
  d.innerHTML = `<div class="card-heading"><h3>Cấu hình tương thích · ${e(stock.name)}</h3><button class="btn-icon" data-close aria-label="Đóng">×</button></div><p class="notice">Nhập theo tài liệu nhà cung cấp/OEM và VIN. Hệ thống chặn xuất vật tư nếu xe không khớp các cấu hình đã khai báo. Danh sách trống nghĩa là cần kiểm tra thủ công, không có nghĩa dùng được cho mọi xe.</p><form><div data-fitments></div><button type="button" class="btn btn-sm" data-add>＋ Thêm cấu hình</button><p class="care-error text-red" role="alert"></p><button class="btn btn-primary" type="submit">Lưu cấu hình</button></form>`;
  document.body.append(d);
  d.querySelector("[data-close]").onclick = () => d.close();
  d.onclose = () => d.remove();
  function add(f = {}) {
    const row = document.createElement("fieldset");
    row.innerHTML = `<legend>Xe / Biến thể</legend><div class="form-grid">${[
      ["brand", "Hãng", "text"],
      ["model", "Dòng xe", "text"],
      ["yearFrom", "Từ năm model", "number"],
      ["yearTo", "Đến năm model", "number"],
      ["engine", "Động cơ / Mã hệ truyền động", "text"],
      ["sourceUrl", "Liên kết tài liệu xác nhận", "url"],
    ]
      .map(
        ([key, title, type]) =>
          `<label class="form-group">${title}<input data-field="${key}" type="${type}" value="${e(f[key] ?? "")}" ${type === "number" ? 'min="1980" max="2100"' : ""} required></label>`,
      )
      .join(
        "",
      )}</div><button type="button" class="btn btn-sm" data-remove>Xóa cấu hình này</button>`;
    row.querySelector("[data-remove]").onclick = () => row.remove();
    d.querySelector("[data-fitments]").append(row);
  }
  stock.fitments?.forEach(add);
  d.querySelector("[data-add]").onclick = () => add();
  d.querySelector("form").onsubmit = async (event) => {
    event.preventDefault();
    const btn = event.target.querySelector("[type=submit]");
    if (btn.disabled || !event.target.reportValidity()) return;
    btn.disabled = true;
    try {
      const fitments = [...d.querySelectorAll("fieldset")].map((row) =>
        Object.fromEntries(
          [...row.querySelectorAll("[data-field]")].map((input) => [
            input.dataset.field,
            input.type === "number" ? Number(input.value) : input.value,
          ]),
        ),
      );
      await Garage.request("/inventory/" + stock.id, {
        method: "PUT",
        body: { fitments },
      });
      d.close();
      await onSaved();
    } catch (err) {
      d.querySelector(".care-error").textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  };
  d.showModal();
};
