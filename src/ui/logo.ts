/* Le logo d'Enzo Dylan : une orbite (deux moitiés, derrière puis devant la planète) et
   un satellite. Repère 100 × 100, tracés des fichiers de design/logo. Partagé par l'écran
   de chargement (dessin au canevas, dans un worker) et le portfolio classique (SVG). */

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

// les deux moitiés de l'orbite (derrière puis devant la planète), tracés du logo (repère 100 × 100)
export const BACK = "7.71,65.39 7.45,64.03 7.59,62.53 8.14,60.91 9.10,59.18 10.45,57.37 12.18,55.49 14.27,53.55 16.71,51.58 19.47,49.59 22.53,47.61 25.84,45.65 29.39,43.74 33.14,41.88 37.05,40.10 41.09,38.42 45.21,36.84 49.38,35.40 53.55,34.09 57.69,32.94 61.76,31.96 65.71,31.14 69.51,30.51 73.12,30.07 76.52,29.81 79.65,29.76 82.50,29.89 85.04,30.22 87.23,30.75 89.08,31.45 90.54,32.34 91.61,33.39 92.29,34.61";
export const FRONT = "92.29,34.61 92.55,35.97 92.41,37.47 91.86,39.09 90.90,40.82 89.55,42.63 87.82,44.51 85.73,46.45 83.29,48.42 80.53,50.41 77.47,52.39 74.16,54.35 70.61,56.26 66.86,58.12 62.95,59.90 58.91,61.58 54.79,63.16 50.62,64.60 46.45,65.91 42.31,67.06 38.24,68.04 34.29,68.86 30.49,69.49 26.88,69.93 23.48,70.19 20.35,70.24 17.50,70.11 14.96,69.78 12.77,69.25 10.92,68.55 9.46,67.66 8.39,66.61 7.71,65.39";

/** une polyligne et ses longueurs cumulées, pour en tracer une fraction */
export function polyline(src: string) {
  const pts = src.split(" ").map((p) => p.split(",").map(Number) as [number, number]);
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = acc[acc.length - 1];
  /** point à la fraction f du trait */
  const at = (f: number): [number, number] => {
    const d = Math.max(0, Math.min(1, f)) * total;
    let i = 1;
    while (i < acc.length - 1 && acc[i] < d) i++;
    const k = (d - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
  };
  /** trace le trait de 0 à f */
  const trace = (g: Ctx2D, f: number) => {
    if (f <= 0) return;
    const d = Math.min(1, f) * total;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length && acc[i - 1] < d; i++) {
      if (acc[i] <= d) g.lineTo(pts[i][0], pts[i][1]);
      else { const p = at(f); g.lineTo(p[0], p[1]); }
    }
    g.stroke();
  };
  return { at, trace };
}

/** place du satellite dans le logo : à 10 % du trait de devant */
export const SATELLITE = polyline(FRONT).at(0.1);

/** les tracés au format SVG */
export const svgPath = (src: string) => "M" + src.split(" ").join(" L");
