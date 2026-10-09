const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");

const frontend = path.resolve(__dirname, "../fe");

test("portal styles keep action buttons compact and form inputs full width", () => {
  const errors = [];
  const console = new VirtualConsole();
  console.on("jsdomError", (error) => errors.push(error.message));
  const dom = new JSDOM(
    '<body><div class="card"><button class="btn btn-primary">Save</button><input aria-label="Name"><select aria-label="Car"><option>Car</option></select></div></body>',
    { virtualConsole: console },
  );
  try {
    const { document, getComputedStyle } = dom.window;
    for (const name of ["ui.css", "workspace.css", "portals.css", "care.css", "professional.css"]) {
      const style = document.createElement("style");
      style.textContent = fs.readFileSync(path.join(frontend, "shared", name), "utf8");
      document.head.append(style);
    }
    const button = getComputedStyle(document.querySelector("button"));
    assert.notEqual(button.width, "100%", "input sizing must not stretch every action button");
    assert.ok(parseFloat(button.minHeight) >= 44);
    for (const control of document.querySelectorAll("input,select")) {
      const style = getComputedStyle(control);
      assert.equal(style.width, "100%");
      assert.ok(parseFloat(style.minHeight) >= 44);
    }
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("all local styles parse and every icon used in the public pages exists", () => {
  const errors = [];
  const console = new VirtualConsole();
  console.on("jsdomError", (error) => errors.push(error.message));
  const dom = new JSDOM("<body></body>", { virtualConsole: console });
  try {
    for (const directory of ["shared", "login"]) {
      for (const name of fs
        .readdirSync(path.join(frontend, directory))
        .filter((name) => name.endsWith(".css"))) {
        const style = dom.window.document.createElement("style");
        style.textContent = fs.readFileSync(path.join(frontend, directory, name), "utf8");
        dom.window.document.head.append(style);
        assert.ok(style.sheet, `Unable to parse ${directory}/${name}`);
      }
    }
    const sprite = fs.readFileSync(path.join(frontend, "shared/icons.svg"), "utf8");
    const ids = new Set([...sprite.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
    for (const page of ["index.html", "login/index.html"]) {
      const content = fs.readFileSync(path.join(frontend, page), "utf8");
      for (const match of content.matchAll(/icons\.svg#([^"]+)/g)) {
        assert.ok(ids.has(match[1]), `Missing ${match[1]} in ${page}`);
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});
