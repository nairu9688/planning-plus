// Construit docs/scriptable/preview.html : page autonome qui exécute le script des widgets
// dans le navigateur (runtime Scriptable imité) avec des données d'exemple.
// Usage : node tools/build-widget-preview.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "docs/scriptable");
const read = (p) => fs.readFileSync(path.join(dir, p), "utf8");

const widget = read("planning-plus-widget.js").replace(/<\/script/gi, "<\\/script");
const html = read("preview/template.html")
  .replace("__WIDGET_SOURCE__", () => widget)
  .replace("__RUNTIME__", () => read("preview/runtime.js"))
  .replace("__SAMPLE__", () => read("preview/sample-data.js"));

fs.writeFileSync(path.join(dir, "preview.html"), html);
console.log(`docs/scriptable/preview.html (${Math.round(html.length / 1024)} Ko)`);
