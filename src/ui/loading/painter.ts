/* Le dessin de l'écran de chargement : champ bleu Klein, orbite du logo qui se trace,
   satellite à la pointe du trait, pourcentage dans la planète, puis dernier tour du
   satellite et iris qui s'ouvre sur le cockpit.

   Il tourne dans un worker (loadingWorker.ts) : pendant que le cockpit se construit,
   le fil principal se fige par moments (textures, shaders), mais le worker continue de
   dessiner à son rythme. Sans OffscreenCanvas, le même code tourne sur le fil principal. */

import { BACK, FRONT, polyline, type Ctx2D } from "../logo";

export interface Box { x: number; y: number; size: number }
export interface Layout { w: number; h: number; dpr: number; logo: Box }

export type ToPainter =
  | ({ type: "init"; reduced: boolean; font?: string; canvas?: OffscreenCanvas } & Layout)
  | ({ type: "layout" } & Layout)
  | { type: "progress"; k: number }
  | { type: "done" }
  | { type: "fail" };

export type FromPainter = { type: "pct"; v: number } | { type: "opening" } | { type: "opened" };

const KLEIN = "#002fa7";

const back = polyline(BACK), front = polyline(FRONT);

/** position sur l'orbite entière : 0 → 0,5 derrière la planète, 0,5 → 1 devant */
const orbitAt = (u: number) => {
  const w = ((u % 1) + 1) % 1;
  return w < 0.5 ? back.at(w * 2) : front.at((w - 0.5) * 2);
};

const easeOut = (k: number) => 1 - (1 - k) ** 3;
const easeInOut = (k: number) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);

const LAP = 1.1, IRIS = 1.3;

export function createPainter(g: Ctx2D, resize: (w: number, h: number) => void, post: (m: FromPainter) => void) {
  let layout: Layout | null = null;
  let reduced = false, font = "600 1px sans-serif";
  let target = 0, shown = 0, done = false, failed = false;
  let lapT = -1, irisT = -1, pct = -1, last = 0, running = false;

  function setLayout(l: Layout) {
    layout = l;
    resize(Math.round(l.w * l.dpr), Math.round(l.h * l.dpr));
  }

  function receive(m: ToPainter) {
    if (m.type === "init") { reduced = m.reduced; if (m.font) font = m.font; setLayout(m); start(); }
    else if (m.type === "layout") setLayout(m);
    else if (m.type === "progress") target = Math.max(target, m.k);
    else if (m.type === "done") { done = true; target = 1; }
    else if (m.type === "fail") failed = true;
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function frame(now: number) {
    /* après un trou (le processus graphique du navigateur, partagé, compile un shader),
       le dessin reprend où il en était au lieu de sauter */
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 0;
    last = now;
    step(dt);
    draw();
    if (irisT >= IRIS) { post({ type: "opened" }); return; }
    requestAnimationFrame(frame);
  }

  /* La valeur affichée rattrape la vraie progression à vitesse mesurée, et continue
     d'avancer lentement entre deux étapes (sans jamais dépasser l'étape de 6 points) :
     le trait ne s'arrête pas net, ne saute pas non plus. */
  function step(dt: number) {
    if (failed) { if (irisT < 0) { irisT = 0; post({ type: "opening" }); if (reduced) irisT = IRIS; } else irisT += dt; return; }
    if (shown < target) shown = Math.min(target, shown + dt * Math.min(0.32, 0.06 + (target - shown) * 1.6));
    else if (!done) shown = Math.min(shown + dt * 0.012, Math.min(target + 0.06, 0.99));
    const v = Math.round(shown * 100);
    if (v !== pct) { pct = v; post({ type: "pct", v }); }
    if (!(done && shown >= 1)) return;
    if (reduced) { if (irisT < 0) { post({ type: "opening" }); irisT = IRIS; } return; }
    if (lapT < 0) lapT = 0;
    else if (lapT < LAP) lapT += dt;
    else if (irisT < 0) { irisT = 0; post({ type: "opening" }); }
    else irisT += dt;
  }

  function draw() {
    if (!layout) return;
    const { w, h, dpr, logo } = layout;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.fillStyle = KLEIN;
    g.fillRect(0, 0, w, h);

    // le logo, dans son repère 100 × 100
    const s = logo.size / 100;
    g.save();
    g.translate(logo.x, logo.y);
    g.scale(s, s);
    g.lineCap = "round"; g.lineJoin = "round";
    const backK = Math.min(shown * 2, 1), frontK = Math.max(0, shown * 2 - 1);
    g.strokeStyle = "#fff"; g.lineWidth = 3;
    back.trace(g, backK);
    g.fillStyle = "#fff";
    g.beginPath(); g.arc(50, 50, 21, 0, Math.PI * 2); g.fill();

    // le pourcentage, dans la planète ; il s'efface pendant le dernier tour
    const fade = lapT < 0 ? 1 : Math.max(0, 1 - lapT / 0.35);
    if (fade > 0 && !failed) {
      g.globalAlpha = fade;
      g.fillStyle = KLEIN;
      g.font = font.replace("1px", "15px");
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(String(pct < 0 ? 0 : pct), 50, 47);
      g.font = font.replace("1px", "6px");
      g.fillText("%", 50, 57);
      g.globalAlpha = 1;
    }

    // le trait de devant passe sur la planète : un liseré bleu l'en détache
    g.strokeStyle = KLEIN; g.lineWidth = 8;
    front.trace(g, frontK);
    g.strokeStyle = "#fff"; g.lineWidth = 3;
    front.trace(g, frontK);

    // le satellite : à la pointe du trait, puis un dernier tour jusqu'à sa place dans le logo
    const u = lapT < 0 ? shown : 0.55 * easeOut(Math.min(1, lapT / LAP));
    const [sx, sy] = orbitAt(u >= 1 ? 0.9999 : u);
    g.fillStyle = "#fff"; g.strokeStyle = KLEIN; g.lineWidth = 3;
    g.beginPath(); g.arc(sx, sy, 6, 0, Math.PI * 2); g.fill(); g.stroke();
    g.restore();

    // l'iris s'ouvre depuis le centre de la planète
    if (irisT > 0) {
      const cx = logo.x + 50 * s, cy = logo.y + 50 * s;
      const far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
      const r = far * easeInOut(Math.min(1, irisT / IRIS)) + 1;
      g.globalCompositeOperation = "destination-out";
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    }
  }

  return { receive };
}
