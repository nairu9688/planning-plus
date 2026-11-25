// Construit docs/scriptable/planning-plus-widget.perso.js : le script avec le token API intégré.
// Le token est lu dans docs/scriptable/.token (ignoré par git) ; la copie perso est aussi ignorée.
// Usage : node tools/build-widget-personal.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), "docs/scriptable");
const token = fs.readFileSync(path.join(dir, ".token"), "utf8").trim();
if (!/^pp_[A-Za-z0-9_-]+$/.test(token)) throw new Error("docs/scriptable/.token : token invalide");
const src = fs.readFileSync(path.join(dir, "planning-plus-widget.js"), "utf8");
if (!src.includes('const EMBEDDED_TOKEN = "";')) throw new Error("EMBEDDED_TOKEN introuvable dans le script");
fs.writeFileSync(path.join(dir, "planning-plus-widget.perso.js"), src.replace('const EMBEDDED_TOKEN = "";', `const EMBEDDED_TOKEN = "${token}";`));
console.log("docs/scriptable/planning-plus-widget.perso.js");
