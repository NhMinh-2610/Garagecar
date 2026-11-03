/* Gửi biểu mẫu dialog: chặn gửi lặp và giữ dữ liệu khi lưu thất bại. */
Garage.bindDialogForm = (dialog, save, onSaved, { focusError = false } = {}) => {
  const form = dialog.querySelector("form");
  const submitButton = form.querySelector('[type="submit"]');
  const errorMessage = dialog.querySelector(".care-error");
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (submitButton.disabled || !form.reportValidity()) return;
    submitButton.disabled = true;
    try {
      const result = await save(form);
      dialog.close();
      await onSaved?.(result);
    } catch (error) {
      errorMessage.textContent = error.message;
      if (focusError) errorMessage.focus();
    } finally {
      submitButton.disabled = false;
    }
  };
};
