// Mini-runtime Scriptable pour navigateur : exécute le vrai script des widgets et rend
// ListWidget / WidgetStack / DrawContext en HTML + canvas. Sert à prévisualiser toutes les
// tailles sans iPhone. Approximation fidèle de la mise en page, pas du rendu pixel près.
(function () {
  const SYMBOLS = {
    "graduationcap.fill": "🎓︎", calendar: "▦", "clock.fill": "◷", checklist: "☰", "moon.stars.fill": "☾", "house.fill": "⌂",
    "play.fill": "▶", "arrow.left.arrow.right": "⇄", plus: "+", "plus.circle.fill": "⊕", timer: "⏱︎", "note.text": "▤",
    "bolt.fill": "ϟ", circle: "○", "exclamationmark.triangle.fill": "⚠︎", "person.2.wave.2.fill": "☺", "pencil.and.list.clipboard": "✎",
    "chart.bar.fill": "▮", "books.vertical.fill": "▥", "arrow.triangle.2.circlepath": "⟳", "calendar.badge.plus": "▦",
    "list.clipboard.fill": "☰", "note.text.badge.plus": "▤",
  };

  function parseHex(h) {
    h = String(h || "000000").replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length === 8) h = h.slice(0, 6);
    return h.toUpperCase();
  }

  class Color {
    constructor(hex, alpha = 1) {
      this.hex = parseHex(hex);
      this.alpha = alpha;
      const n = parseInt(this.hex, 16);
      this.red = ((n >> 16) & 255) / 255;
      this.green = ((n >> 8) & 255) / 255;
      this.blue = (n & 255) / 255;
    }
    resolve() {
      return this._dyn ? (RT.dark ? this._dyn[1] : this._dyn[0]).resolve() : this;
    }
    css() {
      const c = this.resolve();
      return `rgba(${Math.round(c.red * 255)},${Math.round(c.green * 255)},${Math.round(c.blue * 255)},${c.alpha})`;
    }
    static white() { return new Color("FFFFFF"); }
    static black() { return new Color("000000"); }
    static clear() { return new Color("000000", 0); }
    static gray() { return new Color("8E8E93"); }
    static dynamic(l, d) { const c = new Color(l.hex, l.alpha); c._dyn = [l, d]; return c; }
  }

  const WEIGHTS = { ultraLight: 200, thin: 250, light: 300, regular: 400, medium: 500, semibold: 600, bold: 700, heavy: 800, black: 900 };
  const Font = new Proxy({}, {
    get: (_, name) => (size) => {
      const n = String(name);
      const w = Object.keys(WEIGHTS).find((k) => n.toLowerCase().startsWith(k.toLowerCase()));
      return { size, weight: w ? WEIGHTS[w] : 400, rounded: /Rounded/.test(n), mono: /Monospaced/.test(n) };
    },
  });
  const fontCss = (f) => f ? `${f.weight} ${f.size}px ${f.mono ? "ui-monospace, Menlo, monospace" : f.rounded ? "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif" : "-apple-system, system-ui, 'Segoe UI', sans-serif"}` : "400 15px system-ui";

  class Size { constructor(w, h) { this.width = w; this.height = h; } }
  class Point { constructor(x, y) { this.x = x; this.y = y; } }
  class Rect {
    constructor(x, y, w, h) { this.x = x; this.y = y; this.width = w; this.height = h; }
    get minX() { return this.x; } get minY() { return this.y; } get maxX() { return this.x + this.width; } get maxY() { return this.y + this.height; }
  }
  class LinearGradient { constructor() { this.colors = []; this.locations = []; this.startPoint = new Point(0, 0); this.endPoint = new Point(0, 1); } }

  class Img { constructor(src, w, h, symbol) { this.src = src; this.size = new Size(w, h); this.symbol = symbol; } }
  const SFSymbol = { named: (n) => ({ image: new Img(null, 16, 16, n) }) };

  class Path {
    constructor() { this.p = new Path2D(); }
    move(pt) { this.p.moveTo(pt.x, pt.y); }
    addLine(pt) { this.p.lineTo(pt.x, pt.y); }
    addRect(r) { this.p.rect(r.x, r.y, r.width, r.height); }
    addEllipse(r) { this.p.ellipse(r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2, 0, 0, Math.PI * 2); }
    addRoundedRect(r, cw, ch) { this.p.roundRect(r.x, r.y, r.width, r.height, Math.min(cw, r.width / 2, r.height / 2)); }
    closeSubpath() { this.p.closePath(); }
  }

  class DrawContext {
    constructor() { this.size = new Size(100, 100); this.opaque = true; this.respectScreenScale = false; this._ops = []; }
    _ctx() {
      if (!this._c) {
        const s = 2;
        this._canvas = document.createElement("canvas");
        this._canvas.width = Math.ceil(this.size.width * s);
        this._canvas.height = Math.ceil(this.size.height * s);
        this._c = this._canvas.getContext("2d");
        this._c.scale(s, s);
        this._fill = "#000"; this._stroke = "#000"; this._lw = 1; this._font = Font.systemFont(12); this._tc = "#000"; this._align = "left";
        this._path = null;
      }
      return this._c;
    }
    setFillColor(c) { this._ctx(); this._fill = c.css(); }
    setStrokeColor(c) { this._ctx(); this._stroke = c.css(); }
    setLineWidth(w) { this._ctx(); this._lw = w; }
    fillRect(r) { const c = this._ctx(); c.fillStyle = this._fill; c.fillRect(r.x, r.y, r.width, r.height); }
    strokeRect(r) { const c = this._ctx(); c.strokeStyle = this._stroke; c.lineWidth = this._lw; c.strokeRect(r.x, r.y, r.width, r.height); }
    fillEllipse(r) { const c = this._ctx(); c.fillStyle = this._fill; c.beginPath(); c.ellipse(r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2, 0, 0, Math.PI * 2); c.fill(); }
    strokeEllipse(r) { const c = this._ctx(); c.strokeStyle = this._stroke; c.lineWidth = this._lw; c.beginPath(); c.ellipse(r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2, 0, 0, Math.PI * 2); c.stroke(); }
    addPath(p) { this._ctx(); this._path = p.p; }
    fillPath() { const c = this._ctx(); if (this._path) { c.fillStyle = this._fill; c.fill(this._path); } }
    strokePath() { const c = this._ctx(); if (this._path) { c.strokeStyle = this._stroke; c.lineWidth = this._lw; c.lineJoin = "round"; c.stroke(this._path); } }
    setFont(f) { this._ctx(); this._font = f; }
    setTextColor(col) { this._ctx(); this._tc = col.css(); }
    setTextAlignedLeft() { this._ctx(); this._align = "left"; }
    setTextAlignedCenter() { this._ctx(); this._align = "center"; }
    setTextAlignedRight() { this._ctx(); this._align = "right"; }
    drawText(t, pt) { const c = this._ctx(); c.font = fontCss(this._font); c.fillStyle = this._tc; c.textBaseline = "top"; c.textAlign = "left"; c.fillText(String(t), pt.x, pt.y); }
    drawTextInRect(t, r) {
      const c = this._ctx();
      c.save();
      c.beginPath(); c.rect(r.x, r.y, r.width, r.height); c.clip();
      c.font = fontCss(this._font); c.fillStyle = this._tc; c.textBaseline = "top"; c.textAlign = this._align;
      const lh = this._font.size * 1.2;
      const words = String(t).split(/\s+/);
      const lines = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        if (c.measureText(test).width > r.width && cur) { lines.push(cur); cur = w; } else cur = test;
      }
      if (cur) lines.push(cur);
      const x = this._align === "center" ? r.x + r.width / 2 : this._align === "right" ? r.x + r.width : r.x;
      lines.forEach((l, i) => { if (i * lh < r.height) c.fillText(l, x, r.y + i * lh); });
      c.restore();
    }
    drawImageInRect(img, r) { /* non utilisé */ }
    getImage() { this._ctx(); return new Img(this._canvas.toDataURL(), this.size.width, this.size.height); }
  }

  // ── Éléments de widget ──────────────────────────────────────────────────
  class Base {
    constructor() { this.children = []; this.spacing = 0; this.pad = null; this.url = null; }
    setPadding(t, l, b, r) { this.pad = [t, l, b, r]; }
    useDefaultPadding() { this.pad = null; }
    addStack() { const s = new WidgetStack(); this.children.push(s); return s; }
    addText(t) { const x = new WidgetText(t); this.children.push(x); return x; }
    addImage(i) { const x = new WidgetImage(i); this.children.push(x); return x; }
    addSpacer(l) { const x = { type: "spacer", length: l ?? null }; this.children.push(x); return x; }
    addDate(d) { const x = new WidgetDate(d); this.children.push(x); return x; }
  }
  class ListWidget extends Base {
    constructor() { super(); this.type = "widget"; this.backgroundColor = null; this.backgroundGradient = null; this.addAccessoryWidgetBackground = false; }
    async presentSmall() {} async presentMedium() {} async presentLarge() {} async presentExtraLarge() {}
  }
  class WidgetStack extends Base {
    constructor() { super(); this.type = "stack"; this.dir = "row"; this.align = "start"; this.cornerRadius = 0; this.borderWidth = 0; this.borderColor = null; this.size = null; }
    layoutHorizontally() { this.dir = "row"; }
    layoutVertically() { this.dir = "column"; }
    centerAlignContent() { this.align = "center"; }
    topAlignContent() { this.align = "start"; }
    bottomAlignContent() { this.align = "end"; }
  }
  class WidgetText {
    constructor(t) { this.type = "text"; this.text = String(t); this.font = null; this.textColor = null; this.lineLimit = 0; this.textOpacity = 1; this.align = "left"; this.minimumScaleFactor = 1; }
    leftAlignText() { this.align = "left"; } centerAlignText() { this.align = "center"; } rightAlignText() { this.align = "right"; }
  }
  class WidgetImage {
    constructor(i) { this.type = "image"; this.image = i; this.imageSize = null; this.tintColor = null; this.cornerRadius = 0; this.imageOpacity = 1; }
    leftAlignImage() {} centerAlignImage() {} rightAlignImage() {}
  }
  class WidgetDate {
    constructor(d) { this.type = "date"; this.date = d; this.style = "date"; this.font = null; this.textColor = null; }
    applyTimerStyle() { this.style = "timer"; } applyRelativeStyle() { this.style = "relative"; } applyTimeStyle() { this.style = "time"; }
    applyDateStyle() { this.style = "date"; } applyOffsetStyle() { this.style = "timer"; }
    leftAlignText() {} centerAlignText() {} rightAlignText() {}
  }

  // ── Rendu HTML ──────────────────────────────────────────────────────────
  const RT = { dark: false, glass: false, now: Date.now(), family: "medium" };

  function gradientCss(g) {
    const ang = Math.atan2(g.endPoint.y - g.startPoint.y, g.endPoint.x - g.startPoint.x) * 180 / Math.PI + 90;
    const stops = g.colors.map((c, i) => `${c.css()} ${Math.round((g.locations[i] ?? i / Math.max(1, g.colors.length - 1)) * 100)}%`);
    return `linear-gradient(${ang}deg, ${stops.join(", ")})`;
  }
  const textColor = (c) => (RT.glass ? `rgba(255,255,255,${c ? Math.max(0.55, c.resolve().alpha) : 1})` : c ? c.css() : RT.dark ? "#fff" : "#000");

  function renderChildren(parent, el, dir) {
    for (const ch of parent.children) el.appendChild(render(ch, dir));
  }

  function render(node, parentDir) {
    if (node.type === "spacer") {
      const d = document.createElement("div");
      if (node.length === null) d.style.flex = "1 1 0";
      else d.style[parentDir === "row" ? "width" : "height"] = `${node.length}px`;
      d.style.flexShrink = "0";
      return d;
    }
    if (node.type === "text") {
      const d = document.createElement("div");
      d.className = "t";
      d.textContent = node.text;
      d.style.font = fontCss(node.font || Font.systemFont(15));
      d.style.color = textColor(node.textColor);
      d.style.textAlign = node.align;
      if (node.lineLimit === 1) { d.style.whiteSpace = "nowrap"; d.style.overflow = "hidden"; d.style.textOverflow = "ellipsis"; }
      else if (node.lineLimit > 1) { d.style.display = "-webkit-box"; d.style.webkitBoxOrient = "vertical"; d.style.webkitLineClamp = String(node.lineLimit); d.style.overflow = "hidden"; }
      return d;
    }
    if (node.type === "date") {
      const d = document.createElement("div");
      d.className = "t";
      const ms = Math.abs(node.date.getTime() - RT.now);
      const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
      d.textContent = node.style === "timer" ? `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s).padStart(2, "0")}` : node.style === "relative" ? `${h ? `${h} h ` : ""}${m} min` : node.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      d.style.font = fontCss(node.font || Font.systemFont(15));
      d.style.color = textColor(node.textColor);
      d.style.whiteSpace = "nowrap";
      return d;
    }
    if (node.type === "image") {
      const i = node.image;
      const w = node.imageSize ? node.imageSize.width : i.size.width;
      const h = node.imageSize ? node.imageSize.height : i.size.height;
      if (i.symbol) {
        const d = document.createElement("div");
        d.textContent = SYMBOLS[i.symbol] ?? "•";
        d.style.cssText = `width:${w}px;height:${h}px;font:600 ${Math.round(h * 0.9)}px system-ui;line-height:${h}px;text-align:center;flex-shrink:0;color:${node.tintColor ? textColor(node.tintColor) : textColor(null)}`;
        return d;
      }
      const im = document.createElement("img");
      im.src = i.src;
      im.style.width = `${w}px`;
      im.style.height = `${h}px`;
      im.style.flexShrink = "0";
      im.style.maxWidth = "100%";
      im.style.objectFit = "contain";
      if (!node.imageSize) im.dataset.noSize = "1"; // signalé : sur iPad, une image sans taille est agrandie
      if (RT.glass) { im.style.filter = "grayscale(1) brightness(1.15)"; im.style.mixBlendMode = "screen"; im.style.opacity = "0.85"; }
      return im;
    }
    // stack / widget
    const d = document.createElement("div");
    const dir = node.type === "widget" ? "column" : node.dir;
    d.style.display = "flex";
    d.style.flexDirection = dir;
    d.style.gap = `${node.spacing || 0}px`;
    d.style.minWidth = "0";
    d.style.minHeight = "0";
    if (node.type === "widget") {
      d.className = "w";
      d.style.alignItems = "flex-start";
      d.style.justifyContent = "center";
      const p = node.pad ?? (RT.family.startsWith("accessory") ? [0, 0, 0, 0] : [16, 16, 16, 16]);
      d.style.padding = `${p[0]}px ${p[3]}px ${p[2]}px ${p[1]}px`;
      if (!RT.glass) d.style.background = node.backgroundGradient ? gradientCss(node.backgroundGradient) : node.backgroundColor ? node.backgroundColor.css() : RT.dark ? "#1c1c1e" : "#fff";
      for (const ch of node.children) {
        const c = render(ch, "column");
        if (ch.type === "stack" || ch.type === "text") c.style.alignSelf = "stretch";
        if (ch.type !== "spacer") c.style.flexShrink = "0"; // comme iOS : pas de compression, le surplus déborde
        d.appendChild(c);
      }
      return d;
    }
    d.className = "s";
    d.style.alignItems = node.align === "center" ? "center" : node.align === "end" ? "flex-end" : "flex-start";
    if (node.pad) d.style.padding = `${node.pad[0]}px ${node.pad[3]}px ${node.pad[2]}px ${node.pad[1]}px`;
    if (node.cornerRadius) d.style.borderRadius = `${node.cornerRadius}px`;
    if (node.backgroundGradient) d.style.background = RT.glass ? "#fff" : gradientCss(node.backgroundGradient);
    else if (node.backgroundColor) d.style.background = RT.glass && node.backgroundColor.resolve().alpha > 0.02 ? "#fff" : node.backgroundColor.css();
    if (node.borderWidth) d.style.border = `${node.borderWidth}px solid ${RT.glass ? "rgba(255,255,255,.45)" : node.borderColor ? node.borderColor.css() : "transparent"}`;
    if (node.size) {
      if (node.size.width > 0) { d.style.width = `${node.size.width}px`; d.style.flexShrink = "0"; }
      if (node.size.height > 0) { d.style.height = `${node.size.height}px`; d.style.flexShrink = "0"; }
    }
    if (node.url) d.title = node.url;
    for (const ch of node.children) {
      const c = render(ch, dir);
      if (dir === "row" && ch.type === "text") c.style.flexShrink = "1";
      if (dir === "row" && ch.type === "stack") c.style.flexShrink = "1";
      if (dir === "column" && (ch.type === "stack" || ch.type === "text") && !(ch.size && ch.size.width > 0)) c.style.alignSelf = "stretch";
      if (dir === "column" && ch.type !== "spacer") c.style.flexShrink = "0";
      d.appendChild(c);
    }
    return d;
  }

  /** Exécute le script pour un type / une taille, retourne l'élément HTML du widget. */
  async function runWidget({ source, data, param, family, dark, glass, now, device = "iphone", keychain = {} }) {
    RT.dark = dark;
    RT.glass = glass;
    RT.now = now;
    RT.family = family;
    const RealDate = Date;
    class FakeDate extends RealDate {
      constructor(...a) { if (a.length) super(...a); else super(now); }
      static now() { return now; }
    }
    let widget = null;
    const store = { "planning-plus-url": "https://planning-plus-two.vercel.app", "planning-plus-token": "pp_apercu", ...keychain };
    const g = {
      Date: FakeDate,
      ListWidget, DrawContext, Path, Point, Rect, Size, LinearGradient, SFSymbol, Font, Color,
      Alert: class { addTextField() {} addSecureTextField() {} addAction() {} addCancelAction() {} async presentAlert() { return -1; } async presentSheet() { return -1; } textFieldValue() { return ""; } },
      Notification: class { async schedule() {} },
      Device: { isUsingDarkAppearance: () => dark, isPad: () => device === "ipad", isPhone: () => device !== "ipad" },
      Keychain: { contains: (k) => k in store, get: (k) => store[k], set: (k, v) => (store[k] = v) },
      Pasteboard: { pasteString: () => "" },
      FileManager: { local: () => ({ joinPath: (a, b) => `${a}/${b}`, cacheDirectory: () => "/cache", fileExists: () => false, writeString() {}, readString() { return "{}"; }, remove() {} }) },
      Request: function () { return { loadJSON: async () => data, response: { statusCode: 200 } }; },
      Script: { name: () => "Planning+", setWidget: (w) => (widget = w), complete() {} },
      args: { widgetParameter: param, queryParameters: {} },
      config: { runsInWidget: true, widgetFamily: family },
    };
    await new Function(...Object.keys(g), `return (async () => {\n${source}\n})();`)(...Object.values(g));
    if (!widget) throw new Error("Aucun widget produit");
    return render(widget);
  }

  window.ScriptablePreview = { runWidget };
})();
