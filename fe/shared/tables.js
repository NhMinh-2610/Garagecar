/* Keep long business lists bounded without replacing rows or losing controls. */
(() => {
  const states = new WeakMap();
  let started = false;
  function refresh(table) {
    const state = states.get(table);
    if (!state || !table.isConnected) return;
    const rows = [...(table.tBodies[0]?.rows || [])].filter(
      (row) =>
        !(row.cells.length === 1 && row.cells[0].colSpan > 1) &&
        (!row.hidden || row.hasAttribute("data-page-hidden")),
    );
    const size = Math.max(1, Math.min(50, Number(table.dataset.pageSize) || 8));
    const pages = Math.max(1, Math.ceil(rows.length / size));
    state.page = Math.max(1, Math.min(state.page, pages));
    const start = (state.page - 1) * size;
    rows.forEach((row, index) => {
      const hidden = index < start || index >= start + size;
      row.hidden = hidden;
      row.toggleAttribute("data-page-hidden", hidden);
    });
    state.label.textContent = rows.length
      ? `${start + 1}–${Math.min(start + size, rows.length)} / ${rows.length} bản ghi`
      : "Chưa có bản ghi";
    state.previous.disabled = state.page === 1;
    state.next.disabled = state.page === pages;
    state.pager.hidden = rows.length <= size;
  }
  function attach(table) {
    if (states.has(table)) return;
    const pager = document.createElement("nav");
    pager.className = "record-pager";
    pager.setAttribute("aria-label", "Phân trang danh sách");
    const label = document.createElement("span");
    label.className = "record-pager-label";
    label.setAttribute("aria-live", "polite");
    const previous = document.createElement("button");
    const next = document.createElement("button");
    previous.type = next.type = "button";
    previous.className = next.className = "btn btn-sm";
    previous.textContent = "← Trước";
    next.textContent = "Sau →";
    pager.append(label, previous, next);
    (table.closest(".table-responsive") || table).after(pager);
    const state = { page: 1, pager, label, previous, next };
    states.set(table, state);
    previous.onclick = () => {
      state.page--;
      refresh(table);
    };
    next.onclick = () => {
      state.page++;
      refresh(table);
    };
    refresh(table);
  }
  function scan(node) {
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_NODE) return;
    if (node.matches?.("table[data-page-size]")) attach(node);
    node.querySelectorAll?.("table[data-page-size]").forEach(attach);
  }
  function start() {
    if (started) return;
    started = true;
    scan(document);
    const observer = new MutationObserver((records) => {
      const updated = new Set();
      records.forEach((record) => {
        const table = record.target.closest?.("table[data-page-size]");
        if (table) updated.add(table);
        record.addedNodes.forEach(scan);
      });
      updated.forEach(refresh);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const reset = (event) => {
      if (!event.target.matches('input[type="search"], .toolbar select, [data-table-filter]'))
        return;
      const scope = event.target.closest(".tab-content, section") || document;
      scope.querySelectorAll("table[data-page-size]").forEach((table) => {
        const state = states.get(table);
        if (state) {
          state.page = 1;
          refresh(table);
        }
      });
    };
    document.addEventListener("input", reset);
    document.addEventListener("change", reset);
    window.addEventListener("pagehide", () => observer.disconnect(), {
      once: true,
    });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
