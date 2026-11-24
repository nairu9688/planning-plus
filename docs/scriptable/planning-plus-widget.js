// Planning+ — widget Scriptable (petit, moyen, grand)
// 1. Installe Scriptable, crée un script avec ce contenu.
// 2. Renseigne APP_URL et TOKEN (Réglages → Tokens API dans Planning+).
// 3. Ajoute un widget Scriptable sur l'écran d'accueil et choisis ce script.
//    Paramètre du widget (facultatif) : "devoir" pour ouvrir directement l'ajout de devoir au toucher.

const APP_URL = "https://planning-plus.vercel.app"; // ← ton URL Vercel
const TOKEN = "pp_xxx"; // ← ton token API

const C = {
  navy: new Color("#1B2A4A"),
  navyDark: new Color("#7C9CE0"),
  bg: Color.dynamic(new Color("#F6F7FB"), new Color("#0D1220")),
  card: Color.dynamic(new Color("#FFFFFF"), new Color("#151B2B")),
  text: Color.dynamic(new Color("#121A2C"), new Color("#E8ECF5")),
  muted: Color.dynamic(new Color("#667089"), new Color("#95A0B8")),
  accent: Color.dynamic(new Color("#1B2A4A"), new Color("#7C9CE0")),
};

async function load() {
  const req = new Request(`${APP_URL}/api/v1/summary`);
  req.headers = { Authorization: `Bearer ${TOKEN}` };
  return req.loadJSON();
}

function color(summary, subject) {
  const hex = subject && summary.colors ? summary.colors[subject] : null;
  return hex ? new Color(hex) : C.muted;
}

function line(stack, text, { size = 12, weight = "regular", col = C.text, lines = 1 } = {}) {
  const t = stack.addText(text);
  t.font = weight === "bold" ? Font.boldSystemFont(size) : weight === "semibold" ? Font.semiboldSystemFont(size) : Font.systemFont(size);
  t.textColor = col;
  t.lineLimit = lines;
  return t;
}

function examBlock(stack, s, label, exam) {
  const b = stack.addStack();
  b.layoutVertically();
  line(b, label.toUpperCase(), { size: 9, weight: "semibold", col: C.muted });
  if (!exam) {
    line(b, "Rien à venir", { size: 12, col: C.muted });
    return;
  }
  const row = b.addStack();
  row.centerAlignContent();
  const dot = row.addText("●");
  dot.font = Font.systemFont(9);
  dot.textColor = color(s, exam.subject);
  row.addSpacer(4);
  line(row, exam.title, { size: 12, weight: "semibold" });
  line(b, exam.countdownText, { size: 15, weight: "bold", col: C.accent });
}

async function build() {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(12, 14, 12, 14);
  const family = config.widgetFamily ?? "medium";
  let s;
  try {
    s = await load();
  } catch (e) {
    line(w, "Planning+", { weight: "bold" });
    line(w, "Hors ligne ou token invalide", { size: 11, col: C.muted, lines: 2 });
    return w;
  }

  const head = w.addStack();
  line(head, "Planning+", { size: 11, weight: "bold", col: C.accent });
  head.addSpacer();
  line(head, `Semaine ${s.week}`, { size: 11, col: C.muted });
  w.addSpacer(6);

  if (family === "small") {
    examBlock(w, s, "Prochain DS", s.nextDs);
    w.addSpacer();
    line(w, `${s.homeworkToday.length} devoir(s) aujourd'hui`, { size: 10, col: C.muted });
    w.url = args.widgetParameter === "devoir" ? `${APP_URL}/?nouveau=devoir` : `${APP_URL}/`;
    return w;
  }

  const row = w.addStack();
  examBlock(row, s, "Prochain DS", s.nextDs);
  row.addSpacer();
  examBlock(row, s, s.cb ? "Concours blanc" : "Prochaine khôlle", s.cb ? { title: s.cb.name, countdownText: s.cb.countdownText } : s.nextKholle);
  w.addSpacer(8);

  const tonight = w.addStack();
  tonight.layoutVertically();
  if (s.tonight) {
    const mode = s.tonight.mode === "maison" ? "Maison 21h–23h" : "Étude 20h–21h50";
    line(tonight, `CE SOIR · ${mode}`, { size: 9, weight: "semibold", col: C.muted });
    const items = s.tonight.items.map((i) => i.description || i.subject).filter(Boolean);
    line(tonight, items.length ? items.join(" · ") : "Rien de prévu", { size: 12, lines: family === "large" ? 3 : 1 });
  } else {
    line(tonight, "Pas de session ce soir", { size: 12, col: C.muted });
  }

  if (family === "large") {
    w.addSpacer(8);
    line(w, "DEVOIRS DU JOUR", { size: 9, weight: "semibold", col: C.muted });
    for (const h of s.homeworkToday.slice(0, 5)) {
      const r = w.addStack();
      const dot = r.addText("●");
      dot.font = Font.systemFont(9);
      dot.textColor = color(s, h.subject);
      r.addSpacer(4);
      line(r, h.title, { size: 12 });
    }
    if (!s.homeworkToday.length) line(w, "Aucun", { size: 12, col: C.muted });
    w.addSpacer(8);
    const actions = w.addStack();
    actions.spacing = 8;
    const add = actions.addText("+ Devoir");
    add.font = Font.semiboldSystemFont(12);
    add.textColor = C.accent;
    add.url = `${APP_URL}/?nouveau=devoir`;
    if (s.tonight) {
      const t = actions.addText(s.tonight.mode === "maison" ? "→ Étude" : "→ Maison");
      t.font = Font.semiboldSystemFont(12);
      t.textColor = C.accent;
      // Bascule via le Raccourci « Planning+ mode » (voir docs/SHORTCUTS.md).
      t.url = `shortcuts://run-shortcut?name=${encodeURIComponent("Planning+ mode")}&input=text&text=${s.tonight.id}`;
      const b = actions.addText("Bilan");
      b.font = Font.semiboldSystemFont(12);
      b.textColor = C.accent;
      b.url = `${APP_URL}/planner/${s.tonight.id}/bilan`;
    }
  }

  w.addSpacer();
  w.url = args.widgetParameter === "devoir" ? `${APP_URL}/?nouveau=devoir` : `${APP_URL}/`;
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  return w;
}

const widget = await build();
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
