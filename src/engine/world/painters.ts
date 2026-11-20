import { seeded } from "../util/textures";

/* Les surfaces des planètes : l'interface réelle de chaque projet, peinte sur une carte
   équirectangulaire de 4096 × 2048. Une planète de plus = un peintre de plus ici. */

/* Nexus : une sphère de papier à grands carreaux, sur laquelle un graphe est tracé
   à l'encre — la page de l'application, enroulée en planète. */
const INK = { paper: "#fdfdfb", ink: "#1b3a6b", red: "#c62b22", blue: "#2a51a3", green: "#19683d" };

function nexusGraph(W: number, H: number) {
  const rnd = seeded(11);
  const nodes: { x: number; y: number }[] = [];
  while (nodes.length < 34) {
    const n = { x: 120 + rnd() * (W - 240), y: H * 0.22 + rnd() * H * 0.56 };
    if (nodes.every((m) => Math.hypot(m.x - n.x, m.y - n.y) > 230)) nodes.push(n);
  }
  // chaque sommet est relié à ses deux plus proches voisins
  const edges: [number, number][] = [], seen = new Set<string>();
  nodes.forEach((a, i) => {
    nodes.map((b, j) => [j, Math.hypot(b.x - a.x, b.y - a.y)] as const).filter(([j]) => j !== i)
      .sort((p, q) => p[1] - q[1]).slice(0, 2).forEach(([j]) => {
        const key = Math.min(i, j) + "-" + Math.max(i, j);
        if (!seen.has(key)) { seen.add(key); edges.push([i, j]); }
      });
  });
  return { nodes, edges };
}

export function paintNexus(g: CanvasRenderingContext2D, W: number, H: number) {
  const { nodes, edges } = nexusGraph(W, H);
  g.fillStyle = "#f1ede2"; g.fillRect(0, 0, W, H);
  const fine = 18;
  for (let y = 0; y <= H; y += fine) {
    const b = Math.round(y / fine) % 4 === 0;
    g.fillStyle = b ? "rgba(128,152,216,.85)" : "rgba(186,201,236,.7)";
    g.fillRect(0, y, W, b ? 3 : 1.5);
  }
  for (let x = 0; x <= W; x += fine * 4) { g.fillStyle = "rgba(186,201,236,.75)"; g.fillRect(x, 0, 1.5, H); }
  g.fillStyle = "rgba(198,43,34,.6)"; g.fillRect(W * 0.62, 0, 5, H);    // le filet de marge
  g.lineCap = "round";
  for (const [i, j] of edges) {
    g.strokeStyle = "rgba(27,58,107,.9)"; g.lineWidth = 9;
    g.beginPath(); g.moveTo(nodes[i].x, nodes[i].y); g.lineTo(nodes[j].x, nodes[j].y); g.stroke();
  }
  const inks = [INK.red, INK.blue, INK.green, INK.paper, INK.blue, INK.green];
  nodes.forEach((n, i) => {
    const fill = inks[i % inks.length];
    g.fillStyle = fill; g.strokeStyle = INK.ink; g.lineWidth = 8;
    g.beginPath(); g.arc(n.x, n.y, 34, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = fill === INK.paper ? INK.ink : INK.paper;
    g.font = '600 40px "IBM Plex Mono"'; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(String.fromCharCode(65 + (i % 26)), n.x, n.y + 2);
  });
}

/* Crible : un tableau de données enroulé autour de la planète. Des colonnes de
   largeurs inégales, des lignes régulières, quelques valeurs ; et, çà et là, une
   cellule vermillon : ce que l'outil retrouve. */
export function paintCrible(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = "#f6f1ec"; g.fillRect(0, 0, W, H);
  const rnd = seeded(23);
  const cols: [number, number][] = [];
  for (let x = 0; x < W;) { const w = 300 + Math.floor(rnd() * 300); cols.push([x, Math.min(w, W - x)]); x += w; }
  const y0 = 260, rowH = 128, rows = Math.floor((H - 2 * y0) / rowH);
  g.textBaseline = "middle";
  for (let r = 0; r < rows; r++) {
    const y = y0 + r * rowH;
    cols.forEach(([x, w], ci) => {
      if (r === 0) {
        g.fillStyle = "#1c1412"; g.fillRect(x, y, w, rowH);
        g.fillStyle = "#f6f1ec"; g.font = '600 52px "IBM Plex Mono"';
        g.fillText(`col_${String(ci + 1).padStart(2, "0")}`, x + 26, y + rowH / 2);
        return;
      }
      const roll = rnd();
      if (roll < 0.1) {
        g.fillStyle = "#e8432a"; g.fillRect(x, y, w, rowH);
        g.fillStyle = "#fff"; g.font = '600 54px "IBM Plex Mono"';
        g.fillText(rnd() < 0.5 ? "n/a" : String(-Math.floor(rnd() * 90)), x + 26, y + rowH / 2);
      } else if (roll < 0.22) {
        g.fillStyle = "#c9e2c4"; g.fillRect(x, y, w, rowH);
      } else if (roll < 0.66) {
        g.fillStyle = "rgba(28,20,18,.8)"; g.font = '400 54px "IBM Plex Mono"';
        g.fillText((rnd() * (rnd() < 0.5 ? 100 : 9999)).toFixed(rnd() < 0.5 ? 0 : 2), x + 26, y + rowH / 2);
      }
    });
  }
  g.strokeStyle = "rgba(28,20,18,.7)"; g.lineWidth = 5;
  for (let r = 0; r <= rows; r++) { g.beginPath(); g.moveTo(0, y0 + r * rowH); g.lineTo(W, y0 + r * rowH); g.stroke(); }
  cols.forEach(([x]) => { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + rows * rowH); g.stroke(); });
}
