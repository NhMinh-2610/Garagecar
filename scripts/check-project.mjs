// Kiem tra lien ket noi bo, tai nguyen giao dien va cu phap JavaScript.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
let checked = 0;

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? files(target) : [target];
  });
}

function checkLink(file, raw, markdown = false) {
  const value = raw.replace(/^<|>$/g, "");
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return;
  const link = decodeURIComponent(value.split(/[?#]/)[0]);
  if (!link) return;
  let target;
  if (link.startsWith("/static/")) target = path.join(root, "fe", link.slice(8));
  else if (link.startsWith("/")) {
    if (!markdown) return; // Cac route /login, /admin... do backend phuc vu.
    target = path.join(root, link);
  } else target = path.resolve(path.dirname(file), link);
  checked++;
  if (!existsSync(target)) failures.push(`${path.relative(root, file)}: ${raw}`);
}

const frontend = files(path.join(root, "fe"));
const docs = [
  ...files(path.join(root, "docs")),
  ...readdirSync(root)
    .filter((name) => name.endsWith(".md"))
    .map((name) => path.join(root, name)),
];
for (const file of [...frontend, ...docs]) {
  const extension = path.extname(file);
  if (![".js", ".html", ".md"].includes(extension)) continue;
  const source = readFileSync(file, "utf8");
  if (extension === ".js") {
    try {
      new Script(source, { filename: path.relative(root, file) });
      checked++;
    } catch (error) {
      failures.push(error.message);
    }
  } else if (extension === ".html") {
    for (const match of source.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
      checkLink(file, match[1]);
    }
  } else {
    const prose = source.replace(/```[^]*?```/g, "").replace(/`[^`]+`/g, "");
    for (const match of prose.matchAll(/\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)) {
      checkLink(file, match[1], true);
    }
  }
}
const worker = path.join(root, "fe", "service-worker.js");
for (const match of readFileSync(worker, "utf8").matchAll(/"(\/static\/[^"\n]+)"/g)) {
  checkLink(worker, match[1]);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Checked ${checked} local links, assets and JavaScript files.`);
}
