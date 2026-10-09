const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
const rows = (count) =>
  Array.from(
    { length: count },
    (_, index) => `<tr><td>${index + 1}</td><td><button>Open ${index + 1}</button></td></tr>`,
  ).join("");
async function list(count = 19) {
  const dom = new JSDOM(
    `<section><input type="search"><div class="table-responsive"><table data-page-size="8"><thead><tr><th>ID</th><th>Action</th></tr></thead><tbody>${rows(count)}</tbody></table></div></section>`,
    { runScripts: "outside-only" },
  );
  await new Promise((resolve) => dom.window.addEventListener("load", resolve, { once: true }));
  dom.window.eval(fs.readFileSync(path.join(__dirname, "../fe/shared/tables.js"), "utf8"));
  await tick();
  return dom;
}

test("large business tables page existing rows and keep row actions intact", async () => {
  const dom = await list();
  try {
    const d = dom.window.document;
    const firstRow = d.querySelector("tbody tr");
    let clicked = 0;
    firstRow.querySelector("button").onclick = () => clicked++;
    const visible = () => [...d.querySelectorAll("tbody tr")].filter((row) => !row.hidden);
    assert.equal(visible().length, 8);
    assert.equal(d.querySelector(".record-pager-label").textContent, "1–8 / 19 bản ghi");
    d.querySelector(".record-pager button:last-child").click();
    assert.equal(visible()[0].cells[0].textContent, "9");
    assert.equal(visible().length, 8);
    d.querySelector(".record-pager button:first-of-type").click();
    assert.equal(d.querySelector("tbody tr"), firstRow);
    firstRow.querySelector("button").click();
    assert.equal(clicked, 1);
  } finally {
    dom.window.close();
  }
});

test("filtering resets pagination and background rows clamp an out-of-range page", async () => {
  const dom = await list();
  try {
    const d = dom.window.document;
    const next = d.querySelector(".record-pager button:last-child");
    next.click();
    next.click();
    assert.equal(d.querySelector(".record-pager-label").textContent, "17–19 / 19 bản ghi");
    d.querySelector("tbody").innerHTML = rows(10);
    await tick();
    assert.equal(d.querySelector(".record-pager-label").textContent, "9–10 / 10 bản ghi");
    d.querySelector("input").dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    assert.equal(d.querySelector(".record-pager-label").textContent, "1–8 / 10 bản ghi");
    d.querySelector("tbody").innerHTML =
      '<tr><td colspan="2" class="empty-state">Không có kết quả</td></tr>';
    await tick();
    assert.equal(d.querySelector(".record-pager").hidden, true);
    assert.equal(d.querySelector("tbody tr").hidden, false);
  } finally {
    dom.window.close();
  }
});

test("dynamically mounted lists receive pagination without changing detail tables", async () => {
  const dom = await list(2);
  try {
    const d = dom.window.document;
    assert.equal(d.querySelector(".record-pager").hidden, true);
    const card = d.createElement("div");
    card.innerHTML = `<table data-page-size="8"><tbody>${rows(9)}</tbody></table><table id="invoice"><tbody>${rows(12)}</tbody></table>`;
    d.body.append(card);
    await tick();
    assert.equal(d.querySelectorAll(".record-pager").length, 2);
    assert.equal(d.querySelectorAll("#invoice tr[hidden]").length, 0);
    assert.equal(card.querySelectorAll("table[data-page-size] tr:not([hidden])").length, 8);
  } finally {
    dom.window.close();
  }
});
