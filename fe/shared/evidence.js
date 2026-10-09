/* Private photo uploads and a gallery shared by the vehicle's authorized viewers. */
(() => {
  const e = Garage.escape;
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-evidence-ticket]");
    if (button) Garage.openEvidence(Number(button.dataset.evidenceTicket));
  });
  const read = (file) =>
    new Promise((resolve, reject) => {
      if (!file || file.size > 20 * 1024 * 1024)
        return reject(new Error("Chọn ảnh tối đa 20 MB trước khi nén."));
      if (file.size > 3 * 1024 * 1024) {
        const image = new Image(),
          url = URL.createObjectURL(file);
        image.onload = () => {
          try {
            const ratio = Math.min(1, 1920 / Math.max(image.width, image.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(image.width * ratio);
            canvas.height = Math.round(image.height * ratio);
            canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
            const result = canvas.toDataURL("image/jpeg", 0.85);
            if (result.length > 4200000)
              throw new Error("Ảnh sau nén còn quá lớn. Chọn ảnh nhỏ hơn.");
            resolve(result);
          } catch (err) {
            reject(err);
          } finally {
            URL.revokeObjectURL(url);
          }
        };
        image.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Không đọc được ảnh. Dùng JPEG, PNG hoặc WebP."));
        };
        image.src = url;
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Không đọc được ảnh."));
      reader.readAsDataURL(file);
    });
  Garage.openEvidence = async (ticketId, item = null, complete = false, onSaved = () => {}) => {
    const d = document.createElement("dialog");
    d.className = "care-dialog evidence-dialog";
    d.innerHTML = `<div class="card-heading"><h3>${complete ? "Ảnh kết quả & Xác nhận công việc" : "Bằng chứng sửa chữa"} · #${ticketId}</h3><button class="btn-icon" data-close aria-label="Đóng">×</button></div><p class="panel-note">Ảnh được gửi khi có kết nối và chỉ người có quyền với phiếu được xem. Ghi chú số đo, kết quả kiểm tra; không chụp thông tin cá nhân không cần thiết.</p><div data-gallery class="evidence-grid"></div><p class="care-error text-red" role="alert"></p>${complete && item ? `<form><h4>${e(item.taskName)}</h4><label class="form-group">Ảnh kết quả sau thực hiện<input name="resultPhoto" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required></label>${item.inventoryId ? `<p class="notice">Vật tư: ${e(item.partName)} · SL ${item.quantity}. ${item.partCode ? "Mã phiếu: " + e(item.partCode) : "Quản trị cần khai báo mã thật trong kho."}</p><label class="form-group">Ảnh bao bì / nhãn sản phẩm<input name="packagePhoto" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required></label><div class="form-grid"><label class="form-group">Mã sản phẩm / mã vạch<input name="productCode" required maxlength="100" autocomplete="off"></label><label class="form-group">Số lô / serial (nếu có)<input name="lotNumber" maxlength="100"></label></div>` : ""}<label class="form-group">Kết quả / số đo / ghi chú<textarea name="note" required minlength="3" maxlength="2000" rows="3"></textarea></label><p class="field-help">Mã nhập được đối chiếu với SKU/mã vạch trong kho. Điều này xác nhận nhận dạng, không thay thế tra cứu tương thích theo VIN.</p><button class="btn btn-primary" type="submit">Gửi ảnh & Xác nhận hoàn thành</button></form>` : ""}`;
    document.body.append(d);
    const urls = [];
    d.querySelector("[data-close]").onclick = () => d.close();
    d.onclose = () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      d.remove();
    };
    const error = d.querySelector(".care-error");
    d.showModal();
    async function gallery() {
      try {
        const rows = await Garage.request(`/workshop/tickets/${ticketId}/evidence`);
        const visible = item ? rows.filter((r) => r.itemId === item.id) : rows;
        d.querySelector("[data-gallery]").innerHTML =
          visible
            .map(
              (r) =>
                `<article class="card"><button type="button" class="btn btn-sm" data-photo="${r.id}">${r.kind === "package" ? "Ảnh bao bì" : "Ảnh kết quả"} · Hạng mục ${r.itemId} · Lần ${r.round}</button><p>${e(r.note)}</p><small>${e(r.productCode || "")} ${e(r.lotNumber || "")} · ${e(formatDate(r.createdAt))}</small><div data-image="${r.id}"></div></article>`,
            )
            .join("") || "<p>Chưa có bằng chứng ảnh.</p>";
      } catch (err) {
        error.textContent = err.message;
      }
    }
    d.onclick = async (event) => {
      const btn = event.target.closest("[data-photo]");
      if (!btn) return;
      btn.disabled = true;
      try {
        const response = await Garage.apiFetch(
          `${Garage.base}/workshop/evidence/${btn.dataset.photo}/image`,
        );
        if (!response.ok) throw new Error("Không thể tải ảnh.");
        const url = URL.createObjectURL(await response.blob());
        urls.push(url);
        const img = document.createElement("img");
        img.src = url;
        img.alt = "Bằng chứng công việc";
        img.loading = "lazy";
        d.querySelector(`[data-image="${btn.dataset.photo}"]`).replaceChildren(img);
      } catch (err) {
        error.textContent = err.message;
        btn.disabled = false;
      }
    };
    const form = d.querySelector("form");
    if (form) {
      const saved = new Set();
      form.onsubmit = async (event) => {
        event.preventDefault();
        const button = form.querySelector("[type=submit]");
        if (button.disabled || !form.reportValidity()) return;
        button.disabled = true;
        error.textContent = "";
        try {
          for (const kind of item.inventoryId ? ["package", "completion"] : ["completion"]) {
            if (saved.has(kind)) continue;
            const file =
              form.elements[kind === "package" ? "packagePhoto" : "resultPhoto"].files[0];
            await Garage.request(`/workshop/tickets/${ticketId}/items/${item.id}/evidence`, {
              method: "POST",
              body: {
                kind,
                image: await read(file),
                note: form.elements.note.value,
                productCode: kind === "package" ? form.elements.productCode.value : null,
                lotNumber: kind === "package" ? form.elements.lotNumber.value : null,
              },
            });
            saved.add(kind);
          }
          await Garage.request(`/repairs/${ticketId}/items/${item.id}/toggle`, {
            method: "PUT",
            body: { isCompleted: true },
          });
          Garage.toast("Đã lưu ảnh và xác nhận công việc.", "success");
          d.close();
          await onSaved();
        } catch (err) {
          error.textContent = err.message;
          await gallery();
        } finally {
          button.disabled = false;
        }
      };
    }
    await gallery();
  };
})();
