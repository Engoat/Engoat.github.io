import { PROJECTS } from "../../content/profile";
import { wrapLines } from "../demo/hud";

/* L'écran de navigation, au centre de la planche : la liste des projets, sur le modèle des
   afficheurs d'avionique (ambre sur noir, à plat). Cinq lignes visibles, la sélection au
   milieu quand il y en a plus ; chaque ligne porte la couleur de la marque du projet. En
   dessous, la description du projet choisi. Le tout est dessiné dans un canevas, relu par
   l'écran 3D. */
export const NAV = { w: 1200, h: 518, rows: 5, rowH: 64, top: 72 };

const AMBER = "#ffb143", DIM = "rgba(255,177,67,.62)", FOND = "#0b0d0c", TEXTE = "#f1ede2";

/** première ligne de la fenêtre de cinq lignes, pour que la sélection reste visible */
export const premiereLigne = (index: number, n: number) => Math.max(0, Math.min(index - 2, n - NAV.rows));

/** ligne du projet touchée en (x, y) pixels du canevas, ou null */
export function ligneEn(y: number, index: number, n: number): number | null {
  const r = Math.floor((y - NAV.top) / NAV.rowH);
  if (r < 0 || r >= Math.min(NAV.rows, n)) return null;
  return premiereLigne(index, n) + r;
}

export function dessinerNav(g: CanvasRenderingContext2D, index: number) {
  const n = PROJECTS.length, { w, h, rowH, top } = NAV;
  g.fillStyle = FOND; g.fillRect(0, 0, w, h);

  // en-tête : le titre, et le rang du projet choisi
  g.textBaseline = "middle";
  g.fillStyle = DIM; g.font = '600 28px "IBM Plex Mono"'; g.letterSpacing = "6px"; g.textAlign = "left";
  g.fillText("NAVIGATION", 28, 30);
  g.letterSpacing = "0px"; g.fillStyle = AMBER; g.font = '600 34px "IBM Plex Mono"'; g.textAlign = "right";
  g.fillText(`${String(index + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`, w - 28, 30);
  g.fillStyle = "rgba(255,177,67,.28)"; g.fillRect(24, 58, w - 48, 2);

  // la liste
  const first = premiereLigne(index, n), rows = Math.min(NAV.rows, n);
  for (let r = 0; r < rows; r++) {
    const i = first + r, p = PROJECTS[i], y = top + r * rowH, sel = i === index;
    if (sel) { g.fillStyle = AMBER; g.beginPath(); g.roundRect(20, y, w - 40, rowH - 8, 8); g.fill(); }
    // le carré de la couleur de la marque, cerné pour rester lisible sur l'ambre
    g.fillStyle = p.color; g.fillRect(44, y + (rowH - 8) / 2 - 17, 34, 34);
    g.strokeStyle = sel ? FOND : DIM; g.lineWidth = 3; g.strokeRect(44, y + (rowH - 8) / 2 - 17, 34, 34);
    g.textAlign = "left";
    g.fillStyle = sel ? FOND : DIM; g.font = '700 52px "Barlow Condensed"'; g.letterSpacing = "4px";
    g.fillText(p.name.toUpperCase(), 106, y + (rowH - 8) / 2 + 3);
    g.letterSpacing = "0px"; g.font = '500 28px "IBM Plex Mono"'; g.textAlign = "right";
    g.fillText(p.stack.slice(0, 3).join(" · "), w - 44, y + (rowH - 8) / 2 + 2);
  }
  // flèches quand la liste continue au-dessus ou en dessous
  g.fillStyle = AMBER;
  if (first > 0) { g.beginPath(); g.moveTo(w - 40, 66); g.lineTo(w - 30, 54); g.lineTo(w - 50, 54); g.fill(); }
  if (first + rows < n) { const y = top + rows * rowH + 6; g.beginPath(); g.moveTo(w - 40, y + 12); g.lineTo(w - 30, y); g.lineTo(w - 50, y); g.fill(); }

  // la description du projet choisi
  g.fillStyle = "rgba(255,177,67,.28)"; g.fillRect(24, 404, w - 48, 2);
  g.fillStyle = TEXTE; g.font = '500 32px "IBM Plex Mono"'; g.textAlign = "left"; g.textBaseline = "top";
  wrapLines(g, PROJECTS[index].slip, w - 56).slice(0, 3).forEach((l, i) => g.fillText(l, 28, 418 + i * 38));
}
