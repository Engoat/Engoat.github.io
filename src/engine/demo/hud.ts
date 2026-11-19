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
   fiche de la démo en cours (dessinée par la démo elle-même).
   La visite va au rythme du visiteur : chaque phrase s'écrit, puis attend qu'on clique
   sur « Suivant », dessiné juste sous le texte avec le compteur d'étapes. */
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

  const state = {
    title: "", text: "", shown: 0, dirty: true,
    /** numéro de la phrase en cours, et nombre total (0 : pas de compteur) */
    step: 0, steps: 0,
    typing: false,
    /** la phrase est écrite et attend « Suivant » */
    waiting: false,
  };
  let release: (() => void) | null = null;
  /** le bouton « Suivant », en pixels du canevas (pour le clic) */
  let nextRect = { x: 0, y: 0, w: 0, h: 0 };

  /** la tour parle : le texte s'écrit ; avec wait, il reste là jusqu'au clic sur « Suivant » */
  async function say(text: string, wait = true) {
    // espace insécable devant ? : ; ! pour qu'ils ne partent jamais seuls à la ligne
    text = text.replace(/ ([?:;!])/g, " $1");
    state.text = text; state.shown = 0; state.dirty = true;
    state.step++;
    ctx.ui.announce(text);
    state.typing = true;
    await ctx.anim.tween(Math.min(1.6, 0.018 * text.length + 0.3), (k) => { state.shown = text.length * k; state.dirty = true; });
    state.typing = false;
    state.shown = text.length; state.dirty = true;
    if (!wait) return;
    state.waiting = true; state.dirty = true;
    await new Promise<void>((r) => { release = r; });
    state.waiting = false; state.dirty = true;
  }

  /** « Suivant » : finit d'écrire la phrase, ou passe à la suivante */
  function next() {
    if (state.typing) { ctx.anim.rush(); return; }
    if (release) { const r = release; release = null; r(); }
  }
  /** abandon de la visite : la phrase en attente est libérée */
  function cancel() { if (release) { const r = release; release = null; r(); } state.waiting = false; }

  /** le point de la vitre (coordonnées de texture) tombe-t-il sur « Suivant » ? */
  function hitsNext(uv: THREE.Vector2) {
    if (!state.waiting && !state.typing) return false;
    const x = uv.x * canvas.width, y = (1 - uv.y) * canvas.height;
    return x >= nextRect.x && x <= nextRect.x + nextRect.w && y >= nextRect.y && y <= nextRect.y + nextRect.h;
  }

  function draw(card: ((g: CanvasRenderingContext2D, W: number) => void) | null) {
    const g = canvas.getContext("2d")!, W = canvas.width, H = canvas.height;
    g.clearRect(0, 0, W, H);
    // la voix de la tour : panneau sombre en haut à gauche, à la taille de la phrase entière
    const px = 70, pw = 780, py = 112;
    g.font = '500 38px "IBM Plex Mono"';
    const full = wrapLines(g, state.text, pw - 64);
    const lines = wrapLines(g, state.text.slice(0, Math.floor(state.shown)), pw - 64);
    const row = state.steps ? 84 : 0;
    const ph = 96 + Math.max(full.length, 1) * 52 + row;
    g.fillStyle = "rgba(6,8,10,.8)"; g.beginPath(); g.roundRect(px, py, pw, ph, 14); g.fill();
    g.strokeStyle = "rgba(255,177,67,.55)"; g.lineWidth = 2; g.stroke();
    g.fillStyle = "#ffb143"; g.font = '600 26px "IBM Plex Mono"'; g.letterSpacing = "5px"; g.textBaseline = "top";
    g.fillText(state.title, px + 32, py + 28);
    g.letterSpacing = "0px"; g.fillStyle = "#f1ede2"; g.font = '500 38px "IBM Plex Mono"';
    lines.forEach((l, i) => g.fillText(l, px + 32, py + 78 + i * 52));

    if (state.steps) {
      // compteur à gauche, « Suivant » à droite, juste sous le texte
      const by = py + ph - row + 6;
      g.fillStyle = "#b8b2a2"; g.font = '500 28px "IBM Plex Mono"'; g.textBaseline = "middle";
      g.fillText(`${Math.min(state.step, state.steps)} / ${state.steps}`, px + 32, by + 32);
      const bw = 250, bh = 60, bx = px + pw - 32 - bw;
      nextRect = { x: bx, y: by + 2, w: bw, h: bh };
      const ready = state.waiting;
      g.fillStyle = ready ? "#ffb143" : "rgba(255,177,67,.18)";
      g.beginPath(); g.roundRect(bx, by + 2, bw, bh, 8); g.fill();
      g.fillStyle = ready ? "#16120a" : "#ffb143";
      g.font = '600 32px "IBM Plex Mono"'; g.textAlign = "center";
      g.fillText("Suivant  ›", bx + bw / 2, by + 2 + bh / 2 + 1);
      g.textAlign = "left"; g.textBaseline = "top";
    }
    if (card) { g.save(); card(g, W); g.restore(); }
    tex.needsUpdate = true;
    state.dirty = false;
  }

  return { mesh, state, say, next, cancel, hitsNext, draw };
}
export type Hud = ReturnType<typeof createHud>;
