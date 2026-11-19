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


/* Aléa : la page de l'application, enroulée en planète. Le papier et l'encre de l'interface
   (palette provisoire de l'appli : papier #f6f5f1, encre #1b1a17), des tuiles de dés avec
   leur chiffre (celles écartées sont barrées, en pointillés, comme dans l'appli), des roues de
   tirage au sort, et, autour de l'équateur, la loi de probabilité exacte de 4d6kh3 : les vraies
   valeurs calculées par le moteur de l'appli (totaux de 3 à 18), le 14 en encre. */
const AL = { papier: "#f6f5f1", carte: "#ffffff", encre: "#1b1a17", encre2: "#5a5750", filet: "#d8d5cb", roue: "#e9e6dc" };
const LOI_4D6KH3 = [0.000772, 0.003086, 0.007716, 0.016204, 0.029321, 0.04784, 0.070216, 0.094136, 0.114198, 0.128858, 0.132716, 0.123457, 0.10108, 0.072531, 0.041667, 0.016204];
const NOMS = ["Ana", "Bo", "Cécile", "Dylan", "Elie", "Fatou", "Gaël"];

export function paintAlea(g: CanvasRenderingContext2D, W: number, H: number) {
  const rnd = seeded(41);
  g.fillStyle = AL.papier; g.fillRect(0, 0, W, H);

  // la loi de 4d6kh3, quatre fois autour de l'équateur
  const rep = W / 4, slot = rep / 16, base = H * 0.565, haut = 250;
  const max = Math.max(...LOI_4D6KH3);
  for (let r = 0; r < 4; r++) {
    LOI_4D6KH3.forEach((p, i) => {
      const x = r * rep + i * slot + slot * 0.1, h = (p / max) * haut, total = i + 3;
      g.fillStyle = total === 14 ? AL.encre : AL.filet;
      g.fillRect(x, base - h, slot * 0.8, h);
      g.fillStyle = AL.encre2; g.font = '600 30px "Instrument Sans"'; g.textAlign = "center"; g.textBaseline = "top";
      g.fillText(String(total), x + slot * 0.4, base + 16);
    });
    g.fillStyle = AL.encre; g.fillRect(r * rep, base, rep, 5);
  }

  // une rangée au nord, une au sud : des tuiles de dés, et une roue tous les quatre éléments
  const faces = [4, 6, 8, 10, 12, 20];
  for (const row of [0.255, 0.795]) {
    const y = H * row, pas = 330, decal = row < 0.5 ? 40 : 200;
    for (let i = 0; i < W / pas; i++) {
      const x = decal + i * pas + (rnd() - 0.5) * 30, yy = y + (rnd() - 0.5) * 50;
      g.save(); g.translate(x, yy);
      if ((i + (row < 0.5 ? 0 : 2)) % 4 === 2) {
        // roue de tirage au sort : une part par nom, alternées
        const n = 5 + Math.floor(rnd() * 3), R = 150;
        g.rotate(rnd() * 6.28);
        for (let k = 0; k < n; k++) {
          const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
          g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a0, a1); g.closePath();
          g.fillStyle = k % 2 ? AL.roue : AL.carte; g.fill();
          g.strokeStyle = AL.encre; g.lineWidth = 6; g.stroke();
          g.save(); g.rotate((a0 + a1) / 2); g.fillStyle = AL.encre; g.font = '600 25px "Instrument Sans"';
          g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(NOMS[k % NOMS.length], R * 0.58, 0); g.restore();
        }
        g.fillStyle = AL.encre; g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.fill();
      } else {
        const f = faces[Math.floor(rnd() * faces.length)], v = 1 + Math.floor(rnd() * f), ecarte = rnd() < 0.2;
        g.rotate((rnd() - 0.5) * 0.3);
        const S = 164;
        g.globalAlpha = ecarte ? 0.45 : 1;
        g.beginPath(); g.roundRect(-S / 2, -S / 2, S, S, 24);
        g.fillStyle = AL.carte; g.fill();
        g.strokeStyle = AL.encre; g.lineWidth = 7; if (ecarte) g.setLineDash([18, 12]); g.stroke(); g.setLineDash([]);
        g.fillStyle = AL.encre2; g.font = '500 27px "Instrument Sans"'; g.textAlign = "left"; g.textBaseline = "top";
        g.fillText(`d${f}`, -S / 2 + 14, -S / 2 + 10);
        g.fillStyle = AL.encre; g.font = '800 92px "Instrument Sans"'; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(String(v), 0, 12);
        if (ecarte) { g.fillRect(-34, 12, 68, 7); }
        g.globalAlpha = 1;
      }
      g.restore();
    }
  }
}
