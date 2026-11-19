import * as THREE from "three";
import type { Ctx } from "../types";

export function wrapLines(g: CanvasRenderingContext2D, text: string, maxW: number) {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const w of para.split(" ")) {
      const t = line ? line + " " + w : w;
      if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

/* L'affichage sur la vitre : à gauche la voix de la tour de contrôle, à droite la
   fiche de la démo en cours (dessinée par la démo elle-même). */
export function createHud(ctx: Ctx) {
  const WIN = ctx.window;
  const canvas = document.createElement("canvas");
  canvas.width = 1600; canvas.height = Math.round(1600 * WIN.h / WIN.w);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w, WIN.h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  mesh.position.set(0, WIN.cy, -1.012);
  mesh.renderOrder = 5;
  mesh.visible = false;
  ctx.cockpit.add(mesh);

  // skipped : numéro de la dernière étape sautée par « Suivant » (on ne la laisse pas affichée)
  const state = { title: "", text: "", shown: 0, dirty: true, step: 0, skipped: 0 };
  /** appelé à chaque nouvelle phrase (compteur d'étapes de la barre du bas) */
  let onStep: (step: number) => void = () => {};

  /** la tour parle : le texte s'écrit, puis reste affiché holdAfter secondes */
  async function say(text: string, holdAfter = 0) {
    // espace insécable devant ? : ; ! pour qu'ils ne partent jamais seuls à la ligne
    text = text.replace(/ ([?:;!])/g, " $1");
    state.text = text; state.shown = 0; state.dirty = true;
    const step = ++state.step;
    onStep(step);
    ctx.ui.announce(text);
    await ctx.anim.tween(Math.min(1.6, 0.018 * text.length + 0.3), (k) => { state.shown = text.length * k; state.dirty = true; });
    if (holdAfter && state.skipped !== step) await ctx.anim.wait(holdAfter);
  }

  function draw(card: ((g: CanvasRenderingContext2D, W: number) => void) | null) {
    const g = canvas.getContext("2d")!, W = canvas.width, H = canvas.height;
    g.clearRect(0, 0, W, H);
    // la voix de la tour : panneau sombre en haut à gauche
    const px = 70, pw = 780, py = 112;
    g.font = '500 38px "IBM Plex Mono"';
    const lines = wrapLines(g, state.text.slice(0, Math.floor(state.shown)), pw - 64);
    const ph = 96 + Math.max(lines.length, 1) * 52;
    g.fillStyle = "rgba(6,8,10,.76)"; g.beginPath(); g.roundRect(px, py, pw, ph, 14); g.fill();
    g.strokeStyle = "rgba(255,177,67,.55)"; g.lineWidth = 2; g.stroke();
    g.fillStyle = "#ffb143"; g.font = '600 26px "IBM Plex Mono"'; g.letterSpacing = "5px"; g.textBaseline = "top";
    g.fillText(state.title, px + 32, py + 28);
    g.letterSpacing = "0px"; g.fillStyle = "#f1ede2"; g.font = '500 38px "IBM Plex Mono"';
    lines.forEach((l, i) => g.fillText(l, px + 32, py + 78 + i * 52));
    if (card) { g.save(); card(g, W); g.restore(); }
    tex.needsUpdate = true;
    state.dirty = false;
  }

  return { mesh, state, say, draw, set onStep(f: (step: number) => void) { onStep = f; } };
}
export type Hud = ReturnType<typeof createHud>;
