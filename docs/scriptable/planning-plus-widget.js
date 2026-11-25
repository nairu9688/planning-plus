// Variables used by Scriptable.
// icon-color: deep-blue; icon-glyph: graduation-cap;
//
// ─────────────────────────────────────────────────────────────────────────────
//  Planning+ — widgets iPhone (Scriptable)
// ─────────────────────────────────────────────────────────────────────────────
//  Installation : voir docs/WIDGETS.md.
//  1. Crée un script nommé « Planning+ » dans Scriptable avec ce contenu.
//  2. Lance-le une fois dans l'app : il te demande l'URL et le token (stockés dans le trousseau).
//  3. Ajoute des widgets Scriptable → Script « Planning+ » → Paramètre = type ci-dessous.
//
//  Paramètres (le type de widget) :
//    tableau     Tableau de bord (petit, moyen, grand, très grand) — par défaut
//    edt         Emploi du temps : petit = maintenant/ensuite, moyen = aujourd'hui, grand = 3 jours
//    devoirs     Devoirs à venir, avec bouton pour cocher (moyen / grand)
//    kholles     Prochaines khôlles (salle, préparation, questions à revoir)
//    ds          Compte à rebours DS + concours blanc, jauges de préparation
//    soir        Session de ce soir, bascule étude/maison, Focus, Bilan
//    semaine     Statistiques de la semaine (barres par jour, matières, série)
//    postits     Post-its
//    actions     Grille de boutons (ajouter un devoir, un post-it, synchro…)
//    maintenant  Cours en cours / suivant avec minuteur en direct
//  Écran verrouillé : rond = soirs avant le DS, rectangle = prochain cours ou ce soir, ligne = DS.
// ─────────────────────────────────────────────────────────────────────────────

const KC_URL = "planning-plus-url";
const KC_TOKEN = "planning-plus-token";
const KC_STYLE = "planning-plus-style";
// Style « verre » : pour un écran d'accueil transparent ou teinté (iOS repeint en blanc uni
// tout fond de couleur). Les cartes et boutons sont alors dessinés par un contour, sans fond.
let GLASS = false;
// Mots du paramètre du widget (ex. « edt colonnes verre »).
let PARAM_WORDS = [];
const GLASS_LINE = new Color("#FFFFFF", 0.45);
const DEFAULT_URL = "https://planning-plus-two.vercel.app";
const SCRIPT = Script.name();

// ── Palette ─────────────────────────────────────────────────────────────────
const NAVY = new Color("#1B2A4A");
const NAVY_LIGHT = new Color("#7C9CE0");
const C = {
  bg: Color.dynamic(new Color("#F6F7FB"), new Color("#0D1220")),
  card: Color.dynamic(new Color("#FFFFFF"), new Color("#151B2B")),
  card2: Color.dynamic(new Color("#EEF1F7"), new Color("#1C2436")),
  text: Color.dynamic(new Color("#121A2C"), new Color("#E8ECF5")),
  muted: Color.dynamic(new Color("#667089"), new Color("#95A0B8")),
  accent: Color.dynamic(NAVY, NAVY_LIGHT),
  danger: Color.dynamic(new Color("#D93025"), new Color("#F28B82")),
  warn: Color.dynamic(new Color("#E37400"), new Color("#FDD663")),
  ok: Color.dynamic(new Color("#1E8E3E"), new Color("#81C995")),
  white: Color.white(),
};
const DARK = Device.isUsingDarkAppearance();
// Les widgets iPad sont moins hauts que sur iPhone à taille égale : une ligne de moins.
const PAD = typeof Device.isPad === "function" && Device.isPad();
const hex = (h, a = 1) => new Color(h || "#8A93A6", a);
const NOTE_BG = { yellow: "#FFF4C2", blue: "#DCEBFF", green: "#DDF5E3", pink: "#FFE0EA", purple: "#EDE3FF" };

/** Texte d'un champ d'alerte ; certaines versions renvoient null pour un champ non modifié. */
const fieldOf = (alert, i) => {
  const v = alert.textFieldValue(i);
  return typeof v === "string" ? v.trim() : "";
};

// ── Config / API ────────────────────────────────────────────────────────────
function cfg() {
  return {
    url: Keychain.contains(KC_URL) ? Keychain.get(KC_URL) : DEFAULT_URL,
    token: Keychain.contains(KC_TOKEN) ? Keychain.get(KC_TOKEN) : null,
  };
}

async function setup() {
  const a = new Alert();
  a.title = "Planning+";
  a.message = "URL de l'app et token API (Réglages → Tokens API).\nAstuce : copie le token avant d'ouvrir cette fenêtre, il sera repris automatiquement si le champ reste vide.";
  a.addTextField("URL", cfg().url);
  a.addTextField("Token pp_…", cfg().token ?? "");
  a.addAction("Enregistrer");
  a.addCancelAction("Annuler");
  if ((await a.presentAlert()) === -1) return false;
  // Selon la version d'iOS / Scriptable, un champ non modifié peut revenir à null.
  const field = (i) => fieldOf(a, i);
  const url = (field(0) || cfg().url || DEFAULT_URL).replace(/\/$/, "");
  let token = field(1) || cfg().token || "";
  if (!token.startsWith("pp_")) {
    const clip = (Pasteboard.pasteString() || "").trim();
    if (clip.startsWith("pp_")) token = clip;
  }
  Keychain.set(KC_URL, url);
  if (!token.startsWith("pp_")) {
    const e = new Alert();
    e.title = "Token manquant";
    e.message = "Crée un token dans Planning+ (Réglages → Tokens API), copie-le, puis relance le script.";
    e.addAction("OK");
    await e.presentAlert();
    return false;
  }
  Keychain.set(KC_TOKEN, token);
  // Vérifie tout de suite que l'URL et le token marchent.
  const ok = new Alert();
  try {
    const d = await api("/api/v1/widget?days=1");
    ok.title = "Connecté ✓";
    ok.message = `${d.todayLabel} · semaine ${d.week} · ${d.homeworkCounts.open} devoir(s) en cours.`;
  } catch (err) {
    ok.title = "Connexion impossible";
    ok.message = `${err.message}\nVérifie l'URL (${url}) et le token.`;
  }
  ok.addAction("OK");
  await ok.presentAlert();
  return true;
}

async function api(path, method = "GET", body) {
  const { url, token } = cfg();
  const r = new Request(`${url}${path}`);
  r.method = method;
  r.timeoutInterval = 20;
  r.headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (body) r.body = JSON.stringify(body);
  const json = await r.loadJSON();
  if (r.response.statusCode >= 400) throw new Error(json.error || `Erreur ${r.response.statusCode}`);
  return json;
}

const fm = FileManager.local();
const cachePath = fm.joinPath(fm.cacheDirectory(), "planning-plus-widget.json");

/** Données avec cache : si le réseau échoue, on affiche la dernière version connue. */
async function loadData(days) {
  try {
    const d = await api(`/api/v1/widget?days=${days}`);
    fm.writeString(cachePath, JSON.stringify(d));
    return { d, stale: false };
  } catch (e) {
    if (fm.fileExists(cachePath)) return { d: JSON.parse(fm.readString(cachePath)), stale: true };
    throw e;
  }
}

// URL d'action : relance ce script avec ?action=… (cocher un devoir, basculer le mode…).
const act = (action, params = {}) =>
  `scriptable:///run/${encodeURIComponent(SCRIPT)}?${Object.entries({ action, ...params })
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&")}`;
const app = (path = "/") => `${cfg().url}${path}`;

// ── Dessin (DrawContext) ────────────────────────────────────────────────────
const CTX_SIZE = new Map();
const IMG_SIZE = new Map();
function ctx(w, h) {
  const c = new DrawContext();
  c.size = new Size(w, h);
  c.opaque = false;
  c.respectScreenScale = true;
  CTX_SIZE.set(c, new Size(w, h));
  return c;
}
/** Termine un dessin en retenant sa taille (sinon l'iPad agrandit l'image pour remplir la place). */
function done(c) {
  const img = c.getImage();
  IMG_SIZE.set(img, CTX_SIZE.get(c));
  return img;
}
/** Ajoute une image dessinée à sa taille exacte. */
function addImg(parent, img) {
  const wi = parent.addImage(img);
  const s = IMG_SIZE.get(img);
  if (s) wi.imageSize = s;
  return wi;
}
/** Couleur de dessin : en style verre, tout passe en blanc (iOS délave les images en mode transparent). */
const gw = (normal, alpha = 1) => (GLASS ? new Color("#FFFFFF", alpha) : normal);

/** Anneau de progression avec texte au centre. */
function ring({ size = 64, pct = 0, color = NAVY_LIGHT, track, width = 7, big = "", small = "", bigSize, textColor }) {
  const c = ctx(size, size);
  const r = size / 2 - width / 2 - 1;
  const cx = size / 2;
  const cy = size / 2;
  const arc = (from, to, col) => {
    const p = new Path();
    const steps = Math.max(2, Math.ceil((to - from) * 90));
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + 2 * Math.PI * (from + ((to - from) * i) / steps);
      const pt = new Point(cx + r * Math.cos(a), cy + r * Math.sin(a));
      i ? p.addLine(pt) : p.move(pt);
    }
    c.addPath(p);
    c.setStrokeColor(col);
    c.setLineWidth(width);
    c.strokePath();
  };
  arc(0, 1, GLASS ? new Color("#FFFFFF", 0.25) : track || new Color(DARK ? "#2A3348" : "#E3E7EF"));
  color = gw(color);
  if (pct > 0) arc(0, Math.min(1, pct), color);
  // Bouts arrondis.
  if (pct > 0) {
    const end = -Math.PI / 2 + 2 * Math.PI * Math.min(1, pct);
    for (const a of [-Math.PI / 2, end]) {
      c.setFillColor(color);
      c.fillEllipse(new Rect(cx + r * Math.cos(a) - width / 2, cy + r * Math.sin(a) - width / 2, width, width));
    }
  }
  const tc = GLASS ? Color.white() : textColor || (DARK ? Color.white() : NAVY);
  c.setTextAlignedCenter();
  c.setTextColor(tc);
  c.setFont(Font.boldRoundedSystemFont(bigSize || size * 0.3));
  const bh = (bigSize || size * 0.3) * 1.25;
  c.drawTextInRect(String(big), new Rect(0, cy - bh / 2 - (small ? size * 0.07 : 0), size, bh));
  if (small) {
    c.setFont(Font.semiboldSystemFont(size * 0.12));
    c.setTextColor(gw(new Color(DARK ? "#95A0B8" : "#667089"), 0.75));
    c.drawTextInRect(small, new Rect(0, cy + bh / 2 - size * 0.08, size, size * 0.18));
  }
  return done(c);
}

/** Histogramme vertical (minutes par jour). */
function bars(values, { w = 140, h = 56, color = NAVY_LIGHT, labels = [], highlight = -1 }) {
  const c = ctx(w, h);
  const max = Math.max(60, ...values);
  const n = values.length;
  const gap = 5;
  const bw = (w - gap * (n - 1)) / n;
  const lh = labels.length ? 12 : 0;
  values.forEach((v, i) => {
    const bh = Math.max(3, ((h - lh - 2) * v) / max);
    const x = i * (bw + gap);
    const p = new Path();
    p.addRoundedRect(new Rect(x, h - lh - bh, bw, bh), Math.min(4, bw / 2), Math.min(4, bw / 2));
    c.addPath(p);
    c.setFillColor(GLASS ? new Color("#FFFFFF", i === highlight ? 1 : v ? 0.6 : 0.2) : i === highlight ? color : new Color(color.hex, v ? 0.55 : 0.18));
    c.fillPath();
    if (labels[i]) {
      c.setFont(Font.semiboldSystemFont(8));
      c.setTextColor(gw(new Color(DARK ? "#95A0B8" : "#667089"), 0.75));
      c.setTextAlignedCenter();
      c.drawTextInRect(labels[i], new Rect(x - 2, h - lh + 1, bw + 4, lh));
    }
  });
  return done(c);
}

/** Barre horizontale empilée par matière. */
function stacked(parts, { w = 300, h = 10 }) {
  const c = ctx(w, h);
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const p0 = new Path();
  p0.addRoundedRect(new Rect(0, 0, w, h), h / 2, h / 2);
  c.addPath(p0);
  c.setFillColor(gw(new Color(DARK ? "#2A3348" : "#E3E7EF"), 0.2));
  c.fillPath();
  let x = 0;
  parts.forEach((part, k) => {
    const pw = (w * part.value) / total;
    c.setFillColor(GLASS ? new Color("#FFFFFF", [1, 0.7, 0.45, 0.3][k % 4]) : hex(part.color));
    c.fillRect(new Rect(x, 0, Math.max(0, pw - 1), h));
    x += pw;
  });
  return done(c);
}

/** Emploi du temps sur plusieurs jours, dessiné (colonnes par jour). */
function timeline(days, { w = 330, h = 280, nowMin }) {
  const c = ctx(w, h);
  const all = days.flatMap((d) => [...d.events, ...d.sessions]);
  let start = Math.min(8 * 60, ...all.map((e) => e.startMin));
  let end = Math.max(18 * 60, ...all.map((e) => e.endMin));
  start = Math.floor(start / 60) * 60;
  end = Math.min(24 * 60, Math.ceil(end / 60) * 60);
  const gutter = 20;
  const head = 16;
  const colW = (w - gutter) / days.length;
  const ppm = (h - head) / (end - start);
  const y = (m) => head + (m - start) * ppm;
  const muted = gw(new Color(DARK ? "#95A0B8" : "#667089"), 0.7);
  const line = gw(new Color(DARK ? "#283147" : "#E3E7EF"), 0.18);

  // En-têtes de jours.
  days.forEach((d, i) => {
    c.setFont(Font.boldSystemFont(10));
    c.setTextColor(i === 0 ? gw(DARK ? NAVY_LIGHT : NAVY) : muted);
    c.setTextAlignedCenter();
    c.drawTextInRect(i === 0 ? "Aujourd'hui" : d.short, new Rect(gutter + i * colW, 0, colW, 14));
  });
  // Lignes horaires.
  for (let m = start; m <= end; m += 60) {
    if ((m / 60) % 2 === 0) {
      c.setFont(Font.mediumSystemFont(7));
      c.setTextColor(muted);
      c.setTextAlignedLeft();
      c.drawTextInRect(`${m / 60}h`, new Rect(0, y(m) - 5, gutter, 10));
    }
    c.setFillColor(line);
    c.fillRect(new Rect(gutter, y(m), w - gutter, 0.5));
  }
  // Séparateurs de colonnes.
  for (let i = 1; i < days.length; i++) {
    c.setFillColor(line);
    c.fillRect(new Rect(gutter + i * colW, head, 0.5, h - head));
  }
  // Blocs.
  days.forEach((d, i) => {
    const x0 = gutter + i * colW + 2;
    const bw = colW - 4;
    for (const s of d.sessions) {
      const top = y(s.startMin);
      const bh = Math.max(8, y(s.endMin) - top - 1);
      const p = new Path();
      p.addRoundedRect(new Rect(x0, top, bw, bh), 4, 4);
      c.addPath(p);
      c.setFillColor(gw(new Color(DARK ? "#7C9CE0" : "#1B2A4A", DARK ? 0.2 : 0.12), 0.08));
      c.fillPath();
      // Hachures.
      c.setStrokeColor(gw(new Color(DARK ? "#7C9CE0" : "#1B2A4A", 0.25), 0.22));
      c.setLineWidth(1);
      for (let k = -bh; k < bw; k += 6) {
        const hp = new Path();
        const xa = Math.max(0, k);
        const ya = Math.max(0, -k);
        const len = Math.min(bw - xa, bh - ya);
        if (len <= 0) continue;
        hp.move(new Point(x0 + xa, top + bh - ya));
        hp.addLine(new Point(x0 + xa + len, top + bh - ya - len));
        c.addPath(hp);
        c.strokePath();
      }
      if (bh >= 12) {
        c.setFont(Font.semiboldSystemFont(7.5));
        c.setTextColor(gw(DARK ? NAVY_LIGHT : NAVY, 0.85));
        c.setTextAlignedLeft();
        c.drawTextInRect(`Session ${s.startLabel}`, new Rect(x0 + 3, top + 1, bw - 4, 10));
      }
    }
    for (const e of d.events) {
      const top = y(e.startMin);
      const bh = Math.max(8, y(e.endMin) - top - 1);
      const col = gw(hex(e.color));
      const strong = e.kind === "ds" || e.kind === "kholle";
      const p = new Path();
      p.addRoundedRect(new Rect(x0, top, bw, bh), 4, 4);
      c.addPath(p);
      c.setFillColor(gw(new Color(e.color || "#8A93A6", DARK ? 0.32 : 0.2), strong ? 0.22 : 0.12));
      c.fillPath();
      if (strong) {
        c.addPath(p);
        c.setStrokeColor(col);
        c.setLineWidth(1.5);
        c.strokePath();
      }
      c.setFillColor(col);
      c.fillRect(new Rect(x0, top + 1, 2.5, bh - 2));
      const fs = colW < 80 ? 7.5 : 8.5;
      c.setFont(strong ? Font.heavySystemFont(fs) : Font.semiboldSystemFont(fs));
      c.setTextColor(GLASS || DARK ? Color.white() : new Color("#121A2C"));
      c.setTextAlignedLeft();
      const lines = Math.max(1, Math.floor((bh - 2) / (fs + 2)));
      c.drawTextInRect(e.short, new Rect(x0 + 5, top + 1, bw - 7, Math.min(bh - 1, (fs + 2) * Math.min(2, lines))));
      if (lines >= 3) {
        c.setFont(Font.mediumSystemFont(fs - 1));
        c.setTextColor(muted);
        c.drawTextInRect(`${e.startLabel}${e.location ? ` · ${e.location.replace("Salle ", "S")}` : ""}`, new Rect(x0 + 5, top + (fs + 2) * 2, bw - 7, fs + 2));
      }
    }
  });
  // Ligne « maintenant ».
  if (nowMin >= start && nowMin <= end) {
    c.setFillColor(new Color("#D93025"));
    c.fillRect(new Rect(gutter, y(nowMin) - 0.75, colW, 1.5));
    c.fillEllipse(new Rect(gutter - 3, y(nowMin) - 3, 6, 6));
  }
  return done(c);
}

// ── Briques de mise en page ─────────────────────────────────────────────────
function txt(stack, s, { size = 12, weight = "regular", color = C.text, lines = 1, scale = 0.7, rounded = false } = {}) {
  const t = stack.addText(String(s ?? ""));
  const F = {
    regular: rounded ? Font.regularRoundedSystemFont : Font.systemFont,
    medium: rounded ? Font.mediumRoundedSystemFont : Font.mediumSystemFont,
    semibold: rounded ? Font.semiboldRoundedSystemFont : Font.semiboldSystemFont,
    bold: rounded ? Font.boldRoundedSystemFont : Font.boldSystemFont,
    heavy: rounded ? Font.heavyRoundedSystemFont : Font.heavySystemFont,
  }[weight];
  t.font = F(size);
  t.textColor = color;
  t.lineLimit = lines;
  t.minimumScaleFactor = scale;
  return t;
}
const row = (parent, spacing = 6) => {
  const s = parent.addStack();
  s.layoutHorizontally();
  s.centerAlignContent();
  s.spacing = spacing;
  return s;
};
const col = (parent, spacing = 3) => {
  const s = parent.addStack();
  s.layoutVertically();
  s.spacing = spacing;
  return s;
};
function card(parent, { pad = 8, radius = 12, bg = C.card, url } = {}) {
  const s = parent.addStack();
  s.layoutVertically();
  s.setPadding(pad, pad, pad, pad);
  s.cornerRadius = radius;
  if (GLASS) {
    s.borderWidth = 1;
    s.borderColor = GLASS_LINE;
  } else s.backgroundColor = bg;
  if (url) s.url = url;
  return s;
}
function dot(parent, color, size = 8) {
  const d = parent.addStack();
  d.size = new Size(size, size);
  d.cornerRadius = size / 2;
  d.backgroundColor = hex(color);
  return d;
}
function bar(parent, color, h = 26) {
  const b = parent.addStack();
  b.size = new Size(3, h);
  b.cornerRadius = 1.5;
  b.backgroundColor = hex(color);
  return b;
}
function symbol(parent, name, size = 14, color = C.accent) {
  const i = parent.addImage(SFSymbol.named(name).image);
  i.imageSize = new Size(size, size);
  i.tintColor = color;
  return i;
}
function pill(parent, label, { bg = C.accent, fg = C.white, url, icon, size = 11 } = {}) {
  const s = parent.addStack();
  s.layoutHorizontally();
  s.centerAlignContent();
  s.setPadding(5, 9, 5, 9);
  s.cornerRadius = 10;
  if (GLASS) {
    s.borderWidth = 1;
    s.borderColor = GLASS_LINE;
    fg = C.text;
  } else s.backgroundColor = bg;
  s.spacing = 4;
  if (url) s.url = url;
  if (icon) symbol(s, icon, size, fg);
  txt(s, label, { size, weight: "semibold", color: fg });
  return s;
}
function header(w, title, { icon = "graduationcap.fill", right } = {}) {
  const h = row(w, 5);
  symbol(h, icon, 12, C.accent);
  txt(h, title.toUpperCase(), { size: 10, weight: "heavy", color: C.accent });
  h.addSpacer();
  if (right) txt(h, right, { size: 10, weight: "semibold", color: C.muted });
  return h;
}
function base(urlPath = "/") {
  const w = new ListWidget();
  const g = new LinearGradient();
  g.colors = DARK ? [new Color("#121A2E"), new Color("#0B0F1A")] : [new Color("#FFFFFF"), new Color("#EEF2FA")];
  g.locations = [0, 1];
  g.startPoint = new Point(0, 0);
  g.endPoint = new Point(1, 1);
  w.backgroundGradient = g;
  w.setPadding(12, 12, 12, 12);
  w.url = app(urlPath);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  return w;
}
const fmtMin = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`);
const pctColor = (p) => (p === null || p === undefined ? C.muted : p >= 0.66 ? C.ok : p >= 0.33 ? C.warn : C.danger);
const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

// ── Widgets ─────────────────────────────────────────────────────────────────
function examTile(parent, e, { label, size = 58, showGauge = true } = {}) {
  const s = row(parent, 8);
  const ev = e.countdown ? e.countdown.evenings : Math.max(0, e.daysLeft);
  addImg(s, ring({ size, pct: e.gauge ?? 0, color: hex(e.color || "#7C9CE0"), big: ev, small: ev > 1 ? "soirs" : "soir" }));
  const t = col(s, 1);
  if (label) txt(t, label.toUpperCase(), { size: 8.5, weight: "heavy", color: C.muted });
  txt(t, e.short, { size: 12.5, weight: "bold", lines: 2 });
  txt(t, `${e.dayLabel} · ${e.time}`, { size: 10, color: C.muted });
  txt(t, e.countdown ? `${e.countdown.weekends} WE${e.countdown.holidayDays ? ` · ${e.countdown.holidayDays} j vac.` : ""}` : e.countdownText, { size: 10.5, weight: "semibold", color: C.accent, rounded: true });
  if (showGauge && e.gauge !== null && e.gauge !== undefined) txt(t, `Prépa ${Math.round(e.gauge * 100)} %`, { size: 9, weight: "semibold", color: pctColor(e.gauge) });
  return s;
}

/** Petite tuile à anneau (C1) pour les rangées compactes. */
function ringTile(parent, { pct, color, big, small, label, title, url, size = 46 }) {
  const c = card(parent, { pad: 7, url });
  const r = row(c, 6);
  addImg(r, ring({ size, pct: pct ?? 0, color: hex(color || "#7C9CE0"), big, small, width: 5 }));
  const t = col(r, 0);
  txt(t, label.toUpperCase(), { size: 7.5, weight: "heavy", color: C.muted });
  txt(t, title, { size: 10.5, weight: "bold", lines: 2 });
  return c;
}

/** Barre de remplissage segmentée par matière (C2), dessinée. */
function segmentBar(items, slot, { w = 300, h = 10, track = new Color("#FFFFFF", 0.16) } = {}) {
  const c = ctx(w, h);
  const p0 = new Path();
  p0.addRoundedRect(new Rect(0, 0, w, h), h / 2, h / 2);
  c.addPath(p0);
  c.setFillColor(track);
  c.fillPath();
  const total = Math.max(slot, items.reduce((a, i) => a + i.minutes, 0)) || 1;
  let x = 0;
  for (const i of items) {
    const iw = (w * i.minutes) / total;
    c.setFillColor(GLASS ? new Color("#FFFFFF", i.done ? 0.35 : 0.9) : new Color(i.color || "#9FB8F0", i.done ? 0.4 : 1));
    c.fillRect(new Rect(x, 0, Math.max(0, iw - 1.5), h));
    x += iw;
  }
  return done(c);
}

/** Bande de la journée avec la ligne « maintenant » (EDT en temps réel). */
function dayStrip(day, { w = 300, h = 22, nowMin }) {
  const c = ctx(w, h + 10);
  const all = [...day.events, ...day.sessions];
  const start = Math.min(8 * 60, ...all.map((e) => e.startMin));
  const end = Math.max(22 * 60, ...all.map((e) => e.endMin));
  const x = (m) => ((m - start) / (end - start)) * w;
  const bg = new Path();
  bg.addRoundedRect(new Rect(0, 0, w, h), 6, 6);
  c.addPath(bg);
  c.setFillColor(gw(new Color(DARK ? "#1C2436" : "#EEF1F7"), 0.12));
  c.fillPath();
  for (const s of day.sessions) {
    const p = new Path();
    p.addRoundedRect(new Rect(x(s.startMin), 3, Math.max(3, x(s.endMin) - x(s.startMin)), h - 6), 3, 3);
    c.addPath(p);
    c.setFillColor(gw(new Color(DARK ? "#7C9CE0" : "#1B2A4A", 0.3), 0.25));
    c.fillPath();
  }
  for (const e of day.events) {
    const past = e.endMin <= nowMin;
    const p = new Path();
    p.addRoundedRect(new Rect(x(e.startMin), 3, Math.max(3, x(e.endMin) - x(e.startMin) - 1), h - 6), 3, 3);
    c.addPath(p);
    c.setFillColor(gw(new Color(e.color || "#8A93A6", past ? 0.35 : 0.85), past ? 0.3 : 0.75));
    c.fillPath();
  }
  if (nowMin > start && nowMin < end) {
    c.setFillColor(new Color("#D93025"));
    c.fillRect(new Rect(x(nowMin) - 1, 0, 2, h));
  }
  c.setFont(Font.mediumSystemFont(7));
  c.setTextColor(gw(new Color(DARK ? "#95A0B8" : "#667089"), 0.7));
  for (let k = 0; k <= 4; k++) {
    const m = start + ((end - start) * k) / 4;
    c.setTextAlignedLeft();
    c.drawTextInRect(`${Math.floor(m / 60)}h`, new Rect(Math.min(w - 16, x(m)), h + 1, 18, 9));
  }
  return done(c);
}

/** Maintenant / ensuite en une ligne compacte (grand tableau de bord). */
function nowNext(parent, d) {
  const r = row(parent, 8);
  const block = (b, label) => {
    const c = card(r, { pad: 7, bg: C.card2 });
    const h = row(c, 4);
    txt(h, label, { size: 8, weight: "heavy", color: C.muted });
    h.addSpacer();
    const dt = h.addDate(new Date(label === "MAINTENANT" ? b.end : b.start));
    dt.applyTimerStyle();
    dt.font = Font.boldRoundedSystemFont(8.5);
    dt.textColor = label === "MAINTENANT" ? C.danger : C.accent;
    const t = row(c, 4);
    bar(t, b.color || "#1B2A4A", 14);
    txt(t, b.short, { size: 10.5, weight: b.kind === "ds" || b.kind === "kholle" ? "heavy" : "semibold" });
  };
  if (d.current) block(d.current, "MAINTENANT");
  if (d.next) block(d.next, "ENSUITE");
  if (!d.current && !d.next) {
    const c = card(r, { pad: 7, bg: C.card2 });
    txt(c, "Plus de cours aujourd'hui", { size: 10.5, weight: "semibold" });
  }
}

/** « Ce soir » en grand (direction A) : fond bleu marine, barre par matière, boutons. */
function tonightBlock(parent, t, { buttons = true, maxItems = 3, width = 300 } = {}) {
  const c = parent.addStack();
  c.layoutVertically();
  c.setPadding(10, 11, 10, 11);
  c.cornerRadius = 16;
  const g = new LinearGradient();
  g.colors = [new Color(DARK ? "#1D2C52" : "#1B2A4A"), new Color(DARK ? "#2B4170" : "#2C4478")];
  g.locations = [0, 1];
  g.startPoint = new Point(0, 0);
  g.endPoint = new Point(1, 1);
  if (GLASS) {
    c.borderWidth = 1;
    c.borderColor = GLASS_LINE;
  } else c.backgroundGradient = g;
  c.url = app(`/planner/${t.id}`);
  const white = Color.white();
  const soft = new Color("#FFFFFF", 0.72);
  const h = row(c, 5);
  symbol(h, t.mode === "maison" ? "house.fill" : "moon.stars.fill", 10, soft);
  txt(h, `CE SOIR · ${t.mode === "maison" ? "MAISON" : "ÉTUDE"} ${t.startLabel}–${t.endLabel}`, { size: 9, weight: "heavy", color: soft });
  h.addSpacer();
  txt(h, t.status === "bilan_fait" ? "bilan fait ✓" : `${fmtMin(t.plannedMinutes)}/${fmtMin(t.slotMinutes)}`, { size: 9, weight: "semibold", color: soft });
  c.addSpacer(5);
  addImg(c, segmentBar(t.items, t.slotMinutes, { w: width, h: 9 }));
  c.addSpacer(5);
  if (!t.items.length) txt(c, "Rien de prévu · touche pour remplir", { size: 11, color: soft });
  for (const i of t.items.slice(0, maxItems)) {
    const r = row(c, 5);
    dot(r, i.color || "#9FB8F0", 6);
    txt(r, i.label, { size: 11, color: i.done ? soft : white });
    r.addSpacer();
    txt(r, fmtMin(i.minutes), { size: 9.5, color: soft });
  }
  if (t.items.length > maxItems) txt(c, `+ ${t.items.length - maxItems} autre(s)`, { size: 9.5, color: soft });
  if (buttons) {
    c.addSpacer(7);
    const b = row(c, 5);
    if (t.ended && t.status !== "bilan_fait") pill(b, "Bilan", { url: app(`/planner/${t.id}/bilan`), icon: "checklist", size: 10, bg: white, fg: NAVY });
    else pill(b, "Focus", { url: app(`/planner/${t.id}/focus`), icon: "play.fill", size: 10, bg: white, fg: NAVY });
    pill(b, t.mode === "maison" ? "Étude 20h" : "Maison 21h", { url: act("mode", { id: t.id }), icon: "arrow.left.arrow.right", size: 10, bg: new Color("#FFFFFF", 0.16), fg: white });
  }
  return c;
}

function homeworkRow(parent, h, { check = true, size = 11.5 } = {}) {
  const r = row(parent, 6);
  if (check) {
    const b = r.addStack();
    b.url = act("done", { id: h.id, title: h.title });
    symbol(b, "circle", 15, hex(h.color || "#8A93A6"));
  } else dot(r, h.color, 7);
  const t = col(r, 0);
  t.url = app(`/devoirs?id=${h.id}`);
  txt(t, h.title, { size, weight: h.priority === "haute" ? "bold" : "medium" });
  if (h.subject) txt(t, h.subject, { size: size - 2.5, color: C.muted });
  r.addSpacer();
  txt(r, h.dueLabel, { size: size - 1.5, weight: "semibold", color: h.overdue ? C.danger : h.dueToday ? C.warn : C.muted });
  return r;
}

function wTableau(d, family) {
  const w = base("/");
  const nextDs = d.ds[0];
  if (family === "small") {
    header(w, "Planning+", { right: `Sem. ${d.week}` });
    w.addSpacer(6);
    if (nextDs) {
      const r = row(w, 8);
      addImg(r, ring({ size: 62, pct: nextDs.gauge ?? 0, color: hex(nextDs.color), big: nextDs.countdown.evenings, small: "soirs" }));
      const t = col(r, 1);
      txt(t, nextDs.short, { size: 12, weight: "bold", lines: 3 });
      txt(t, nextDs.dayLabel, { size: 9.5, color: C.muted });
    }
    w.addSpacer();
    const b = row(w, 4);
    symbol(b, "checklist", 11, d.homeworkCounts.overdue ? C.danger : C.accent);
    txt(b, `${d.homeworkCounts.today + d.homeworkCounts.overdue} devoir(s) à rendre`, { size: 10, weight: "semibold", color: d.homeworkCounts.overdue ? C.danger : C.text });
    if (d.tonight) {
      const t = row(w, 4);
      symbol(t, "moon.stars.fill", 11);
      txt(t, `Ce soir ${d.tonight.startLabel} · ${d.tonight.items.length} él.`, { size: 10, color: C.muted });
    }
    return w;
  }

  header(w, `${d.todayLabel} · semaine ${d.week}`, { right: d.streak ? `🔥 ${d.streak} j` : undefined });
  w.addSpacer(8);

  const kh = d.kholles[0];
  const ww = d.weekWork;
  const rings = (parent, n) => {
    const r = row(parent, 6);
    if (nextDs) ringTile(r, { pct: nextDs.gauge, color: nextDs.color, big: nextDs.countdown.evenings, small: "soirs", label: "DS", title: nextDs.short, url: app(`/ds/${nextDs.id}`) });
    if (kh) ringTile(r, { pct: Math.min(1, (kh.worked7dMinutes || 0) / 120), color: kh.color, big: kh.countdown.evenings, small: "soirs", label: "Khôlle", title: kh.short.replace(/^Khôlle /, ""), url: app(`/kholles/${kh.id}`) });
    if (n > 2 && d.cb) ringTile(r, { pct: 0, color: "#7C9CE0", big: d.cb.daysLeft, small: "jours", label: "CB", title: d.cb.name, url: app(`/ds/cb/${d.cb.id}`) });
    if (n > 2 || !kh) ringTile(r, { pct: ww.plannedMinutes ? ww.realMinutes / ww.plannedMinutes : 0, color: "#1E8E3E", big: fmtMin(ww.realMinutes), small: "", label: "Semaine", title: `/ ${fmtMin(ww.plannedMinutes)}`, url: app("/stats") });
  };

  if (family === "medium") {
    // Moyen : Ce soir en grand si une session existe, sinon les anneaux.
    if (d.tonight) tonightBlock(w, d.tonight, { maxItems: PAD ? 1 : 2, buttons: true, width: 300 });
    else rings(w, 2);
    return w;
  }

  // Très grand (iPad) : deux colonnes — journée et Ce soir à gauche, anneaux et À rendre à droite.
  if (family === "extraLarge") {
    const cols = row(w, 12);
    cols.topAlignContent();
    const left = col(cols, 6);
    left.size = new Size(330, 0);
    nowNext(left, d);
    addImg(left, dayStrip(d.days[0], { w: 330, h: 16, nowMin: nowMinutes() }));
    if (d.tonight) tonightBlock(left, d.tonight, { maxItems: 3, width: 308 });
    else {
      const c = card(left, { pad: 8, bg: C.card2, url: app("/planner") });
      txt(c, "Pas de session ce soir · touche pour en créer une", { size: 10.5, color: C.muted });
    }
    const right = col(cols, 6);
    rings(right, 2);
    const r2 = row(right, 6);
    if (d.cb) ringTile(r2, { pct: 0, color: "#7C9CE0", big: d.cb.daysLeft, small: "jours", label: "CB", title: d.cb.name, url: app(`/ds/cb/${d.cb.id}`) });
    ringTile(r2, { pct: ww.plannedMinutes ? ww.realMinutes / ww.plannedMinutes : 0, color: "#1E8E3E", big: fmtMin(ww.realMinutes), small: "", label: "Semaine", title: `/ ${fmtMin(ww.plannedMinutes)}`, url: app("/stats") });
    const hw = col(right, 3);
    txt(hw, `À RENDRE · ${d.homeworkCounts.week} cette semaine`, { size: 8.5, weight: "heavy", color: d.homeworkCounts.overdue ? C.danger : C.muted });
    for (const h of d.homework.slice(0, 3)) homeworkRow(hw, h, { size: 10.5 });
    if (!d.homework.length) txt(hw, "Tout est fait 🎉", { size: 11, color: C.ok });
    return w;
  }

  // Grand : direction A — maintenant/ensuite, Ce soir, anneaux, À rendre.
  nowNext(w, d);
  w.addSpacer(4);
  addImg(w, dayStrip(d.days[0], { w: family === "extraLarge" ? 680 : 310, h: 16, nowMin: nowMinutes() }));
  w.addSpacer(6);
  if (d.tonight) tonightBlock(w, d.tonight, { maxItems: PAD ? 1 : 2, width: family === "extraLarge" ? 660 : 290 });
  else {
    const c = card(w, { pad: 8, bg: C.card2, url: app("/planner") });
    txt(c, "Pas de session ce soir · touche pour en créer une", { size: 10.5, color: C.muted });
  }
  w.addSpacer(6);
  rings(w, family === "extraLarge" ? 4 : 2);
  w.addSpacer(6);
  const hw = col(w, 3);
  txt(hw, `À RENDRE · ${d.homeworkCounts.week} cette semaine`, { size: 8.5, weight: "heavy", color: d.homeworkCounts.overdue ? C.danger : C.muted });
  for (const h of d.homework.slice(0, PAD ? 1 : 2)) homeworkRow(hw, h, { size: 10.5 });
  if (!d.homework.length) txt(hw, "Tout est fait 🎉", { size: 11, color: C.ok });
  return w;
}

function wEdt(d, family) {
  const w = base("/calendrier");
  if (family === "small") return wMaintenant(d, family);
  if (family === "medium") {
    header(w, `Aujourd'hui · ${d.todayLabel}`, { icon: "calendar" });
    w.addSpacer(6);
    const today = [...d.days[0].events, ...d.days[0].sessions.map((s) => ({ ...s, short: "Session", color: "#1B2A4A" }))].sort((a, b) => a.startMin - b.startMin);
    const upcoming = today.filter((e) => e.endMin > nowMinutes());
    const list = (upcoming.length ? upcoming : d.days[1]?.events ?? []).slice(0, 4);
    if (!upcoming.length) txt(w, "Fini pour aujourd'hui · demain :", { size: 10, color: C.muted });
    for (const e of list) {
      const r = row(w, 6);
      bar(r, e.color, 22);
      const t = col(r, 0);
      txt(t, e.short, { size: 11.5, weight: e.kind === "ds" || e.kind === "kholle" ? "heavy" : "semibold" });
      txt(t, `${e.startLabel}–${e.endLabel}${e.location ? ` · ${e.location}` : ""}`, { size: 9.5, color: C.muted });
      r.addSpacer();
      if (e.kind === "ds") pill(r, "DS", { bg: C.danger, size: 9 });
      if (e.kind === "kholle") pill(r, "Khôlle", { bg: C.accent, size: 9 });
    }
    return w;
  }
  const n = family === "extraLarge" ? 5 : 3;
  // Ancienne vue : jours en colonnes, dessinée (paramètre « edt colonnes »).
  if (PARAM_WORDS.includes("colonnes")) {
    header(w, `Emploi du temps · ${n} jours`, { icon: "calendar", right: `Sem. ${d.week}` });
    w.addSpacer(6);
    const width = family === "extraLarge" ? 690 : 320;
    addImg(w, timeline(d.days.slice(0, n), { w: width, h: 300, nowMin: nowMinutes() }));
    return w;
  }
  // Paramètre « edt liste » : les 3 jours empilés les uns sous les autres.
  if (PARAM_WORDS.includes("liste")) return edtAgenda(w, d, { days: 3, budget: family === "extraLarge" ? 13 : PAD ? 15 : 16, side: family === "extraLarge" });
  // Par défaut : une colonne par jour, côte à côte, les cours de haut en bas.
  const colW = family === "extraLarge" ? 215 : PAD ? 100 : 106;
  return edtAgenda(w, d, { days: 3, budget: family === "extraLarge" ? 13 : PAD ? 9 : 10, side: true, colW });
}

/**
 * EDT sur 3 jours, les jours empilés verticalement : pour chaque jour, ses cours en lignes
 * (heure, barre de couleur de la matière, titre, salle). Les cours déjà finis aujourd'hui sont résumés.
 */
function edtAgenda(w, d, { days = 3, budget = 16, side = false, colW = 215 }) {
  const narrow = side && colW < 150;
  const nowMin = nowMinutes();
  header(w, "Emploi du temps", { icon: "calendar", right: `Sem. ${d.week}` });
  w.addSpacer(5);

  const list = d.days.slice(0, days).map((day, i) => {
    const all = [
      ...day.events,
      ...day.sessions.map((x) => ({ ...x, short: `Session ${x.kind === "maison" ? "maison" : x.kind === "etude" ? "étude" : x.kind}`, color: null, isSession: true, location: null })),
    ].sort((a, b) => a.startMin - b.startMin);
    const done = i === 0 ? all.filter((e) => e.endMin <= nowMin) : [];
    const rest = i === 0 ? all.filter((e) => e.endMin > nowMin) : all;
    return { day, i, rest, done };
  });

  // Répartit le nombre de lignes disponibles entre les jours (au moins 1 chacun) ; côte à côte, chaque jour a tout le budget.
  const quota = list.map(() => (side ? budget : 1));
  let left = side ? 0 : budget - list.length;
  while (left > 0 && list.some((x, k) => x.rest.length > quota[k])) {
    for (let k = 0; k < list.length && left > 0; k++) {
      if (list[k].rest.length > quota[k]) {
        quota[k]++;
        left--;
      }
    }
  }

  let cols = null;
  if (side) {
    cols = row(w, narrow ? 8 : 14);
    cols.topAlignContent();
  }
  list.forEach(({ day, i, rest, done }, k) => {
    let w0 = w;
    if (side) {
      w = col(cols, 0);
      w.size = new Size(colW, 0);
    } else if (k > 0) w.addSpacer(5);
    if (narrow) {
      // Colonne étroite : en-tête court, puis chaque cours sur deux lignes (heure, titre).
      const h = row(w, 3);
      h.size = new Size(colW, 15);
      txt(h, (i === 0 ? "Auj." : day.short).toUpperCase(), { size: 9, weight: "heavy", color: i === 0 ? C.accent : C.muted });
      h.addSpacer();
      if (rest.some((e) => e.kind === "ds")) pill(h, "DS", { bg: C.danger, size: 7.5 });
      else if (rest.some((e) => e.kind === "kholle")) pill(h, "K", { bg: C.accent, size: 7.5 });
      if (done.length) {
        w.addSpacer(1);
        txt(w, `${done.length} fini${done.length > 1 ? "s" : ""} ✓`, { size: 8, color: C.muted });
      }
      w.addSpacer(4);
      if (!rest.length) txt(w, i === 0 && done.length ? "Plus rien" : "Pas de cours", { size: 10, color: C.muted });
      const shown = rest.slice(0, quota[k]);
      for (const e of shown) {
        const live = i === 0 && e.startMin <= nowMin && e.endMin > nowMin;
        const r = row(w, 4);
        bar(r, e.isSession ? "#7C9CE0" : e.color, 24);
        const t = col(r, 0);
        txt(t, live ? `now → ${e.endLabel}` : e.isSession ? `${e.startLabel}→${e.endLabel}` : e.startLabel, { size: 8.5, weight: live ? "heavy" : "semibold", color: live ? C.danger : C.muted, rounded: true });
        const strong = e.kind === "ds" || e.kind === "kholle";
        txt(t, e.short, { size: 10, weight: strong ? "heavy" : e.isSession ? "medium" : "semibold", color: e.isSession ? C.accent : C.text });
        w.addSpacer(3);
      }
      if (rest.length > shown.length) txt(w, `+ ${rest.length - shown.length}`, { size: 8.5, color: C.muted });
      w = w0;
      return;
    }
    const h = row(w, 5);
    txt(h, (i === 0 ? "Aujourd'hui" : day.label).toUpperCase(), { size: 9, weight: "heavy", color: i === 0 ? C.accent : C.muted });
    if (i !== 0) txt(h, day.short, { size: 9, color: C.muted });
    h.addSpacer();
    if (rest.some((e) => e.kind === "ds")) pill(h, "DS", { bg: C.danger, size: 8 });
    if (rest.some((e) => e.kind === "kholle")) pill(h, "Khôlle", { bg: C.accent, size: 8 });
    if (done.length) txt(h, `${done.length} fini${done.length > 1 ? "s" : ""} ✓`, { size: 8.5, color: C.muted });
    w.addSpacer(2);

    if (!rest.length) {
      txt(w, i === 0 && done.length ? "Plus rien aujourd'hui" : "Pas de cours", { size: 10.5, color: C.muted });
      if (side) w = w0;
      return;
    }
    const shown = rest.slice(0, quota[k]);
    for (const e of shown) {
      const live = i === 0 && e.startMin <= nowMin && e.endMin > nowMin;
      const r = row(w, 5);
      const tl = r.addStack();
      tl.size = new Size(34, 0);
      txt(tl, live ? "now" : e.startLabel, { size: 9.5, weight: live ? "heavy" : "semibold", color: live ? C.danger : C.muted, rounded: true });
      bar(r, e.isSession ? "#7C9CE0" : e.color, 13);
      const strong = e.kind === "ds" || e.kind === "kholle";
      txt(r, e.short, { size: 10.5, weight: strong ? "heavy" : e.isSession ? "medium" : "semibold", color: e.isSession ? C.accent : C.text });
      r.addSpacer();
      txt(r, e.isSession ? `→ ${e.endLabel}` : (e.location || "").replace(/^Salle /, "S"), { size: 9, color: C.muted });
    }
    if (rest.length > shown.length) txt(w, `+ ${rest.length - shown.length} autre(s)`, { size: 8.5, color: C.muted });
    if (side) w = w0;
  });
  w.addSpacer();
  return w;
}

function wMaintenant(d, family) {
  const w = base("/calendrier?view=jour");
  header(w, "Maintenant", { icon: "clock.fill" });
  w.addSpacer(6);
  const show = (e, label) => {
    const r = row(w, 6);
    bar(r, e.color || "#1B2A4A", family === "small" ? 34 : 30);
    const t = col(r, 0);
    txt(t, label, { size: 8.5, weight: "heavy", color: C.muted });
    txt(t, e.short, { size: family === "small" ? 12.5 : 13, weight: "bold", lines: 2 });
    txt(t, `${e.startLabel}–${e.endLabel}${e.location ? ` · ${e.location}` : ""}`, { size: 9.5, color: C.muted });
  };
  if (d.current) {
    show(d.current, "EN COURS");
    const r = row(w, 3);
    txt(r, "fin dans", { size: 9.5, color: C.muted });
    const dt = r.addDate(new Date(d.current.end));
    dt.applyTimerStyle();
    dt.font = Font.boldRoundedSystemFont(10);
    dt.textColor = C.accent;
  }
  w.addSpacer(4);
  if (d.next) {
    show(d.next, "ENSUITE");
    const r = row(w, 3);
    txt(r, "dans", { size: 9.5, color: C.muted });
    const dt = r.addDate(new Date(d.next.start));
    dt.applyTimerStyle();
    dt.font = Font.boldRoundedSystemFont(10);
    dt.textColor = C.accent;
  } else if (!d.current) {
    txt(w, "Plus rien aujourd'hui", { size: 12, weight: "semibold" });
    const tomorrow = d.days[1]?.events[0];
    if (tomorrow) txt(w, `Demain ${tomorrow.startLabel} · ${tomorrow.short}`, { size: 10, color: C.muted, lines: 2 });
  }
  return w;
}

function wDevoirs(d, family) {
  const w = base("/devoirs");
  const c = d.homeworkCounts;
  if (family === "small") {
    header(w, "Devoirs", { icon: "checklist" });
    w.addSpacer(4);
    const r = row(w, 8);
    addImg(r, ring({ size: 58, pct: c.open ? 1 - c.week / Math.max(c.open, c.week, 1) : 1, color: c.overdue ? new Color("#D93025") : NAVY_LIGHT, big: c.week, small: "semaine" }));
    const t = col(r, 2);
    txt(t, `${c.today} aujourd'hui`, { size: 10.5, weight: "semibold", color: c.today ? C.warn : C.text });
    txt(t, `${c.overdue} en retard`, { size: 10.5, weight: "semibold", color: c.overdue ? C.danger : C.muted });
    txt(t, `${c.open} au total`, { size: 10, color: C.muted });
    w.addSpacer();
    const h = d.homework[0];
    if (h) {
      const r2 = row(w, 4);
      dot(r2, h.color, 6);
      txt(r2, `${h.title} · ${h.dueLabel}`, { size: 9.5, color: C.muted });
    }
    w.url = act("newhw");
    return w;
  }
  header(w, "Devoirs à venir", { icon: "checklist", right: `${c.open} · ${c.overdue ? `${c.overdue} en retard` : "à jour"}` });
  w.addSpacer(6);
  const max = family === "medium" ? (PAD ? 3 : 4) : family === "extraLarge" ? 14 : PAD ? 8 : 9;
  if (!d.homework.length) txt(w, "Aucun devoir en attente 🎉", { size: 13, weight: "semibold", color: C.ok });
  let lastGroup = null;
  for (const h of d.homework.slice(0, max)) {
    if (family !== "medium") {
      const g = h.overdue ? "En retard" : h.dueToday ? "Aujourd'hui" : h.dueLabel === "demain" ? "Demain" : "Plus tard";
      if (g !== lastGroup) {
        w.addSpacer(3);
        txt(w, g.toUpperCase(), { size: 8.5, weight: "heavy", color: g === "En retard" ? C.danger : C.muted });
        lastGroup = g;
      }
    }
    homeworkRow(w, h);
    w.addSpacer(2);
  }
  w.addSpacer();
  const b = row(w, 6);
  pill(b, "Devoir", { icon: "plus", url: act("newhw"), size: 10 });
  if (family !== "medium") pill(b, "Tout voir", { url: app("/devoirs"), bg: C.card2, fg: C.accent, size: 10 });
  return w;
}

function wKholles(d, family) {
  const w = base("/kholles");
  const list = d.kholles;
  if (!list.length) {
    header(w, "Khôlles", { icon: "person.2.wave.2.fill" });
    txt(w, "Aucune khôlle à venir", { size: 12, color: C.muted });
    return w;
  }
  const k = list[0];
  if (family === "small") {
    header(w, "Khôlle", { icon: "person.2.wave.2.fill" });
    w.addSpacer(4);
    const r = row(w, 6);
    addImg(r, ring({ size: 50, pct: Math.min(1, (k.worked7dMinutes || 0) / 120), color: hex(k.color), big: k.daysLeft === 0 ? "J" : `J-${k.daysLeft}`, bigSize: 13 }));
    const t = col(r, 0);
    txt(t, k.short.replace(/^Khôlle /, ""), { size: 12, weight: "bold", lines: 2 });
    txt(t, k.prep ? `prépa ${k.prep}` : k.time, { size: 11, weight: "semibold", color: C.accent });
    w.addSpacer();
    if (k.location) txt(w, `📍 ${k.location}`, { size: 10, color: C.muted });
    if (k.info) txt(w, k.info.replace(/ — /g, " · "), { size: 8.5, color: C.muted, lines: 2 });
    w.url = app(`/kholles/${k.id}`);
    return w;
  }
  header(w, "Prochaines khôlles", { icon: "person.2.wave.2.fill" });
  w.addSpacer(6);
  const max = family === "medium" ? 2 : family === "extraLarge" ? 6 : 4;
  for (const x of list.slice(0, max)) {
    const c = card(w, { pad: 8, bg: C.card2, url: app(`/kholles/${x.id}`) });
    const r = row(c, 8);
    bar(r, x.color, family === "medium" ? 30 : 40);
    const t = col(r, 1);
    txt(t, x.short, { size: 12, weight: "bold" });
    txt(t, `${x.dayLabel} · ${x.prep ? `prépa ${x.prep}` : x.time}${x.location ? ` · ${x.location}` : ""}${x.teacher ? ` · ${x.teacher}` : ""}`, { size: 9.5, color: C.muted });
    if (family !== "medium" && x.info) txt(t, x.info, { size: 9, color: C.muted, lines: 1 });
    r.addSpacer();
    const s = col(r, 1);
    txt(s, x.daysLeft === 0 ? "Aujourd'hui" : `J-${x.daysLeft}`, { size: 12, weight: "heavy", color: C.accent, rounded: true });
    txt(s, `${fmtMin(x.worked7dMinutes)} prépa`, { size: 8.5, color: C.muted });
    if (x.questionsToReview) txt(s, `${x.questionsToReview} q. à revoir`, { size: 8.5, weight: "semibold", color: C.warn });
    w.addSpacer(5);
  }
  return w;
}

function wDs(d, family) {
  const w = base("/ds");
  const e = d.ds[0];
  if (!e) {
    header(w, "DS", { icon: "pencil.and.list.clipboard" });
    txt(w, "Aucun DS à venir", { size: 12, color: C.muted });
    return w;
  }
  if (family === "small") {
    w.url = app(`/ds/${e.id}`);
    const r = row(w, 0);
    r.addSpacer();
    addImg(r, ring({ size: 84, pct: e.gauge ?? 0, color: hex(e.color), big: e.countdown.evenings, small: e.countdown.evenings > 1 ? "soirs" : "soir", width: 9 }));
    r.addSpacer();
    w.addSpacer(4);
    const t = txt(w, e.short, { size: 11.5, weight: "bold", lines: 1 });
    t.centerAlignText();
    const s = txt(w, `${e.dayLabel} · ${e.countdown.weekends} WE`, { size: 9.5, color: C.muted });
    s.centerAlignText();
    return w;
  }
  header(w, "DS & concours blanc", { icon: "pencil.and.list.clipboard", right: d.cb ? `🏆 J-${d.cb.daysLeft}` : undefined });
  w.addSpacer(8);
  if (family === "medium") {
    const r = row(w, 10);
    const c1 = card(r, { url: app(`/ds/${e.id}`) });
    examTile(c1, e, { size: 54 });
    if (d.ds[1]) {
      const c2 = card(r, { pad: 8, url: app(`/ds/${d.ds[1].id}`) });
      txt(c2, "ENSUITE", { size: 8, weight: "heavy", color: C.muted });
      txt(c2, d.ds[1].short, { size: 11, weight: "bold", lines: 2 });
      txt(c2, `${d.ds[1].dayLabel}`, { size: 9.5, color: C.muted });
      txt(c2, d.ds[1].countdownText, { size: 10, weight: "semibold", color: C.accent });
    }
    return w;
  }
  const c1 = card(w, { url: app(`/ds/${e.id}`) });
  examTile(c1, e, { label: "Prochain", size: 70 });
  w.addSpacer(8);
  for (const x of d.ds.slice(1, family === "extraLarge" ? 7 : 5)) {
    const r = row(w, 8);
    r.url = app(`/ds/${x.id}`);
    bar(r, x.color, 24);
    const t = col(r, 0);
    txt(t, x.short, { size: 11.5, weight: "bold" });
    txt(t, `${x.dayLabel} · ${x.countdownText}`, { size: 9.5, color: C.muted });
    r.addSpacer();
    addImg(r, ring({ size: 26, pct: x.gauge ?? 0, color: hex(x.color), width: 4, big: x.gauge === null ? "–" : Math.round(x.gauge * 100), bigSize: 8 }));
    w.addSpacer(4);
  }
  if (d.cb) {
    w.addSpacer();
    const cb = card(w, { pad: 8, bg: C.card2, url: app(`/ds/cb/${d.cb.id}`) });
    txt(cb, `🏆 ${d.cb.name} · ${d.cb.exams} épreuves`, { size: 11, weight: "bold" });
    txt(cb, `Première épreuve dans ${d.cb.countdownText}`, { size: 10, color: C.accent, weight: "semibold" });
  }
  return w;
}

function wSoir(d, family) {
  const w = base("/planner");
  const t = d.tonight;
  if (!t) {
    header(w, "Ce soir", { icon: "moon.stars.fill" });
    w.addSpacer(6);
    txt(w, "Pas de session ce soir", { size: 13, weight: "semibold" });
    w.addSpacer();
    pill(w, "Créer une session", { url: app("/?nouveau=session"), icon: "plus", size: 10 });
    return w;
  }
  if (family === "small") {
    w.url = app(`/planner/${t.id}`);
    header(w, t.mode === "maison" ? "Maison" : "Étude", { icon: t.mode === "maison" ? "house.fill" : "books.vertical.fill" });
    w.addSpacer(4);
    const r = row(w, 8);
    addImg(r, ring({ size: 56, pct: t.slotMinutes ? t.plannedMinutes / t.slotMinutes : 0, color: NAVY_LIGHT, big: t.items.length, small: "éléments" }));
    const c = col(r, 1);
    txt(c, `${t.startLabel}`, { size: 15, weight: "heavy", rounded: true });
    txt(c, `→ ${t.endLabel}`, { size: 11, color: C.muted });
    w.addSpacer();
    txt(w, t.items[0] ? t.items.map((i) => i.label).join(" · ") : "Rien de prévu", { size: 9.5, color: C.muted, lines: 2 });
    return w;
  }
  header(w, "Ce soir", { icon: "moon.stars.fill", right: t.status === "bilan_fait" ? "bilan fait ✓" : undefined });
  w.addSpacer(6);
  tonightBlock(w, t, { maxItems: family === "medium" ? (PAD ? 1 : 2) : 8 });
  return w;
}

function wSemaine(d, family) {
  const w = base("/stats");
  const ww = d.weekWork;
  const pct = ww.plannedMinutes ? ww.realMinutes / ww.plannedMinutes : 0;
  if (family === "small") {
    header(w, "Semaine", { icon: "chart.bar.fill", right: d.streak ? `🔥${d.streak}` : undefined });
    w.addSpacer(4);
    const r = row(w, 0);
    r.addSpacer();
    addImg(r, ring({ size: 70, pct, color: NAVY_LIGHT, big: fmtMin(ww.realMinutes), small: `/ ${fmtMin(ww.plannedMinutes)}`, bigSize: 14 }));
    r.addSpacer();
    w.addSpacer();
    addImg(w, stacked(ww.bySubject.map((s) => ({ value: s.minutes, color: s.color })), { w: 130, h: 7 }));
    return w;
  }
  header(w, `Semaine ${d.week}`, { icon: "chart.bar.fill", right: d.streak ? `🔥 ${d.streak} jour(s) d'affilée` : undefined });
  w.addSpacer(6);
  const r = row(w, 12);
  addImg(r, ring({ size: 64, pct, color: NAVY_LIGHT, big: `${Math.round(pct * 100)}%`, small: "du prévu", bigSize: 15 }));
  const c = col(r, 2);
  txt(c, `${fmtMin(ww.realMinutes)} réels`, { size: 14, weight: "heavy", rounded: true });
  txt(c, `sur ${fmtMin(ww.plannedMinutes)} prévus`, { size: 10.5, color: C.muted });
  txt(c, `Semaine écoulée à ${Math.round(ww.weekElapsed * 100)} %`, { size: 10, color: C.muted });
  r.addSpacer();
  addImg(r, bars(ww.byDay.map((x) => x.minutes), { w: family === "medium" ? 110 : 130, h: 56, color: NAVY_LIGHT, labels: ww.byDay.map((x) => x.short), highlight: ww.byDay.findIndex((x) => x.isToday) }));
  if (family !== "medium") {
    w.addSpacer(10);
    txt(w, "PAR MATIÈRE", { size: 9, weight: "heavy", color: C.muted });
    w.addSpacer(4);
    addImg(w, stacked(ww.bySubject.map((s) => ({ value: s.minutes, color: s.color })), { w: 300, h: 10 }));
    w.addSpacer(6);
    // Objectifs hebdomadaires si définis, sinon le temps par matière.
    const list = (ww.goals && ww.goals.length ? ww.goals : ww.bySubject).slice(0, 5);
    for (const s of list) {
      const l = row(w, 6);
      dot(l, s.color, 7);
      txt(l, s.name, { size: 11 });
      l.addSpacer();
      if (s.goal) {
        addImg(l, stacked([{ value: Math.min(s.minutes, s.goal), color: s.color }, { value: Math.max(0, s.goal - s.minutes), color: DARK ? "#2A3348" : "#E3E7EF" }], { w: 60, h: 6 }));
        txt(l, `${fmtMin(s.minutes)}/${fmtMin(s.goal)}`, { size: 10, weight: "semibold", color: s.minutes >= s.goal ? C.ok : C.muted });
      } else txt(l, fmtMin(s.minutes), { size: 11, weight: "semibold", color: C.muted });
    }
    if (d.neglected.length) {
      w.addSpacer(6);
      const n = row(w, 5);
      symbol(n, "exclamationmark.triangle.fill", 11, C.warn);
      txt(n, `Délaissées : ${d.neglected.map((x) => `${x.name} (${x.days === null ? "jamais" : `${x.days} j`})`).join(", ")}`, { size: 10, color: C.warn, lines: 2 });
    }
  }
  return w;
}

function wPostits(d, family) {
  const w = base("/");
  header(w, "Post-its", { icon: "note.text" });
  w.addSpacer(6);
  const max = family === "small" ? 1 : family === "medium" ? 2 : 6;
  const perRow = family === "small" ? 1 : 2;
  const notes = d.notes.slice(0, max);
  if (!notes.length) txt(w, "Aucun post-it", { size: 12, color: C.muted });
  for (let i = 0; i < notes.length; i += perRow) {
    const r = row(w, 6);
    for (const n of notes.slice(i, i + perRow)) {
      const c = card(r, { pad: 8, radius: 10, bg: new Color(NOTE_BG[n.color] || NOTE_BG.yellow), url: act("notedone", { id: n.id }) });
      c.size = new Size(family === "small" ? 0 : 0, family === "large" || family === "extraLarge" ? 84 : 0);
      txt(c, n.content, { size: 11, color: GLASS ? C.text : new Color("#1B1B1B"), lines: family === "small" ? 5 : 4 });
      c.addSpacer();
    }
    w.addSpacer(6);
  }
  w.addSpacer();
  if (family !== "small") pill(w, "Post-it", { icon: "plus", url: act("newnote"), size: 10 });
  else w.url = act("newnote");
  return w;
}

function wActions(d, family) {
  const w = base("/");
  header(w, "Raccourcis", { icon: "bolt.fill", right: d.homeworkCounts.overdue ? `${d.homeworkCounts.overdue} en retard` : undefined });
  w.addSpacer(PAD ? 4 : 8);
  const buttons = [
    ["Devoir", "plus.circle.fill", act("newhw")],
    ["Focus libre", "timer", act("focus")],
    ["Post-it", "note.text.badge.plus", act("newnote")],
    d.tonight ? [d.tonight.mode === "maison" ? "→ Étude" : "→ Maison", "arrow.left.arrow.right", act("mode", { id: d.tonight.id })] : ["Session", "calendar.badge.plus", app("/?nouveau=session")],
    d.tonight ? ["Focus", "play.circle.fill", app(`/planner/${d.tonight.id}/focus`)] : ["Planner", "timer", app("/planner")],
    d.tonight ? ["Bilan", "checklist", app(`/planner/${d.tonight.id}/bilan?force=1`)] : ["Devoirs", "checklist", app("/devoirs")],
    ["Synchro", "arrow.triangle.2.circlepath", act("sync")],
    ["Calendrier", "calendar", app("/calendrier")],
  ];
  const n = family === "small" ? 4 : family === "medium" ? 4 : 8;
  const perRow = family === "small" ? 2 : 4;
  const list = buttons.slice(0, n);
  for (let i = 0; i < list.length; i += perRow) {
    const r = row(w, 6);
    for (const [label, icon, url] of list.slice(i, i + perRow)) {
      const c = card(r, { pad: 8, radius: 14, bg: C.card2, url });
      const ic = row(c, 0);
      ic.addSpacer();
      symbol(ic, icon, PAD && family === "small" ? 17 : 20, C.accent);
      ic.addSpacer();
      c.addSpacer(3);
      const lt = row(c, 0);
      lt.addSpacer();
      txt(lt, label, { size: 9.5, weight: "semibold" });
      lt.addSpacer();
    }
    if (i + perRow < list.length) w.addSpacer(6);
  }
  return w;
}

// Écran verrouillé.
function wAccessory(d, family) {
  const w = new ListWidget();
  const e = d.ds[0];
  if (family === "accessoryCircular") {
    w.addAccessoryWidgetBackground = true;
    w.setPadding(0, 0, 0, 0);
    if (!e) {
      txt(w, "DS", { size: 12, weight: "bold" });
      return w;
    }
    addImg(w, ring({ size: 60, pct: e.gauge ?? 0, color: Color.white(), track: new Color("#FFFFFF", 0.25), big: e.countdown.evenings, small: "soirs", textColor: Color.white(), width: 6 }));
    w.url = app(`/ds/${e.id}`);
    return w;
  }
  if (family === "accessoryInline") {
    txt(w, e ? `${e.short} · ${e.countdownText}` : "Aucun DS");
    return w;
  }
  // Rectangulaire : chrono Focus en cours en priorité (minuteur en direct).
  if (d.focus && d.focus.running) {
    txt(w, "⏱ Focus en cours", { size: 11, weight: "bold", color: Color.white() });
    txt(w, d.focus.label, { size: 13, weight: "heavy", color: Color.white() });
    const t = w.addDate(new Date(d.focus.startedAt));
    t.applyTimerStyle();
    t.font = Font.boldRoundedSystemFont(13);
    t.textColor = Color.white();
    w.url = act("focus");
    return w;
  }
  // Sinon : en cours / ensuite, sinon ce soir, sinon DS.
  const b = d.current || d.next;
  if (b) {
    txt(w, `${d.current ? "Maintenant" : "Ensuite"} · ${b.startLabel}`, { size: 11, weight: "bold", color: Color.white() });
    txt(w, b.short, { size: 13, weight: "heavy", color: Color.white() });
    txt(w, b.location || (d.tonight ? `Ce soir ${d.tonight.startLabel}` : ""), { size: 11, color: Color.white() });
  } else if (d.tonight) {
    txt(w, `Ce soir · ${d.tonight.mode} ${d.tonight.startLabel}`, { size: 11, weight: "bold", color: Color.white() });
    txt(w, d.tonight.items.map((i) => i.label).join(" · ") || "Rien de prévu", { size: 11, color: Color.white(), lines: 2 });
  } else if (e) {
    txt(w, e.short, { size: 12, weight: "bold", color: Color.white() });
    txt(w, e.countdownText, { size: 12, color: Color.white() });
  }
  return w;
}

function errorWidget(message) {
  const w = base("/");
  header(w, "Planning+");
  w.addSpacer(6);
  txt(w, message, { size: 11, color: C.muted, lines: 4 });
  return w;
}

const BUILDERS = {
  tableau: wTableau,
  dashboard: wTableau,
  edt: wEdt,
  maintenant: wMaintenant,
  devoirs: wDevoirs,
  kholles: wKholles,
  ds: wDs,
  soir: wSoir,
  semaine: wSemaine,
  postits: wPostits,
  actions: wActions,
};

async function buildWidget(type, family) {
  if (!cfg().token) return errorWidget("Lance le script dans Scriptable pour saisir ton token.");
  let data;
  try {
    data = await loadData(type === "edt" && family === "extraLarge" ? 5 : 3);
  } catch (e) {
    return errorWidget(`Hors ligne : ${e.message}`);
  }
  const w = family.startsWith("accessory") ? wAccessory(data.d, family) : (BUILDERS[type] || wTableau)(data.d, family);
  if (data.stale && !family.startsWith("accessory")) {
    w.addSpacer(2);
    txt(w, "hors ligne · données en cache", { size: 8, color: C.muted });
  }
  return w;
}

// ── Actions (boutons des widgets) ───────────────────────────────────────────
async function notify(title, body) {
  const n = new Notification();
  n.title = title;
  n.body = body || "";
  await n.schedule();
}

async function runAction(q) {
  try {
    switch (q.action) {
      case "done":
        await api(`/api/v1/homework/${q.id}/done`, "POST");
        await notify("Devoir fait ✓", q.title);
        break;
      case "mode": {
        const r = await api(`/api/v1/sessions/${q.id}/mode`, "POST");
        await notify("Session mise à jour", r.kind === "maison" ? "Ce soir : maison (21h00–23h00)" : "Ce soir : étude (20h00–21h50)");
        break;
      }
      case "notedone":
        await api(`/api/v1/notes/${q.id}/done`, "POST");
        await notify("Post-it rangé ✓");
        break;
      case "sync": {
        const r = await api("/api/v1/sync", "POST");
        await notify(r.ok ? "Synchro terminée" : "Synchro incomplète", r.error || "");
        break;
      }
      case "newhw": {
        const a = new Alert();
        a.title = "Nouveau devoir";
        a.addTextField("Titre");
        a.addTextField("Matière (maths, eco, droit…)");
        a.addTextField("Pour le (AAAA-MM-JJ)", new Date(Date.now() + 86400000).toISOString().slice(0, 10));
        a.addAction("Ajouter");
        a.addCancelAction("Annuler");
        if ((await a.presentAlert()) === -1) return;
        const title = fieldOf(a, 0);
        if (!title) return;
        await api("/api/v1/homework", "POST", { title, subject: fieldOf(a, 1) || null, dueDate: fieldOf(a, 2) || null });
        await notify("Devoir ajouté", title);
        break;
      }
      case "focus": {
        // Focus libre : arrête le chrono s'il tourne, sinon matière → chrono ou minutes déjà faites.
        const st = await api("/api/v1/focus");
        if (st.running) {
          const r = await api("/api/v1/focus/stop", "POST");
          await notify("Chrono arrêté", r.text);
          break;
        }
        const m = new Alert();
        m.title = "Focus libre";
        m.message = "Quelle matière ?";
        for (const n of st.subjectNames) m.addAction(n);
        m.addAction("Sans matière");
        m.addCancelAction("Annuler");
        const k = await m.presentSheet();
        if (k === -1) return;
        const subject = k < st.subjects.length ? st.subjects[k].key : null;
        const how = new Alert();
        how.title = k < st.subjects.length ? st.subjectNames[k] : "Focus libre";
        how.addTextField("Quoi (Anki, fiche…) — facultatif");
        how.addTextField("Minutes déjà faites (sinon chrono)");
        how.addAction("▶ Démarrer le chrono");
        how.addAction("+ Ajouter les minutes");
        how.addCancelAction("Annuler");
        const choice = await how.presentAlert();
        if (choice === -1) return;
        const description = fieldOf(how, 0) || null;
        if (choice === 1) {
          const minutes = Number(fieldOf(how, 1).replace(/[^0-9]/g, ""));
          if (!minutes) {
            await notify("Planning+", "Indique un nombre de minutes.");
            return;
          }
          const r = await api("/api/v1/focus/log", "POST", { subject, minutes, description });
          await notify("Travail ajouté ✓", r.text);
        } else {
          const r = await api("/api/v1/focus/start", "POST", { subject, description });
          await notify("Chrono lancé ⏱", r.text);
        }
        break;
      }
      case "newnote": {
        const a = new Alert();
        a.title = "Nouveau post-it";
        a.addTextField("Penser à…");
        a.addAction("Ajouter");
        a.addCancelAction("Annuler");
        if ((await a.presentAlert()) === -1) return;
        const content = fieldOf(a, 0);
        if (!content) return;
        await api("/api/v1/notes", "POST", { content });
        await notify("Post-it ajouté");
        break;
      }
    }
  } catch (e) {
    await notify("Planning+ : erreur", e.message);
  }
}

// ── Point d'entrée ──────────────────────────────────────────────────────────
const q = args.queryParameters || {};
if (q.action) {
  await runAction(q);
  if (fm.fileExists(cachePath)) fm.remove(cachePath);
  Script.complete();
} else if (config.runsInWidget) {
  const words = (args.widgetParameter || "tableau").trim().toLowerCase().split(/[\s,;:]+/);
  PARAM_WORDS = words;
  const type = words.find((x) => BUILDERS[x]) || "tableau";
  const style = words.includes("verre") || words.includes("transparent") ? "verre" : words.includes("normal") ? "normal" : Keychain.contains(KC_STYLE) ? Keychain.get(KC_STYLE) : "normal";
  GLASS = style === "verre";
  Script.setWidget(await buildWidget(type, config.widgetFamily || "medium"));
  Script.complete();
} else {
  // Dans l'app : réglages + aperçu de tous les widgets.
  if (!cfg().token) await setup();
  const menu = new Alert();
  menu.title = "Planning+";
  menu.message = "Aperçu des widgets";
  const types = Object.keys(BUILDERS).filter((k) => k !== "dashboard");
  for (const t of types) menu.addAction(t);
  GLASS = Keychain.contains(KC_STYLE) && Keychain.get(KC_STYLE) === "verre";
  menu.addAction("⚙️ URL et token");
  menu.addAction(GLASS ? "🎨 Style : verre → passer en normal" : "🪟 Style : normal → passer en verre (écran transparent)");
  menu.addCancelAction("Fermer");
  const i = await menu.presentSheet();
  if (i === types.length) await setup();
  else if (i === types.length + 1) {
    Keychain.set(KC_STYLE, GLASS ? "normal" : "verre");
    const a = new Alert();
    a.title = GLASS ? "Style normal" : "Style verre activé";
    a.message = "Appliqué à tous tes widgets Planning+ (au prochain rafraîchissement). Un widget peut forcer son style avec le paramètre, ex. « tableau verre » ou « tableau normal ».";
    a.addAction("OK");
    await a.presentAlert();
  }
  else if (i >= 0) {
    const size = new Alert();
    size.title = types[i];
    ["small", "medium", "large", "extraLarge"].forEach((s) => size.addAction(s));
    const s = await size.presentSheet();
    const fam = ["small", "medium", "large", "extraLarge"][s] || "medium";
    const w = await buildWidget(types[i], fam);
    if (fam === "small") await w.presentSmall();
    else if (fam === "medium") await w.presentMedium();
    else if (fam === "large") await w.presentLarge();
    else await w.presentExtraLarge();
  }
  Script.complete();
}
