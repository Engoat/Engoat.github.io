/// <reference lib="webworker" />
import { createPainter, type ToPainter } from "./painter";

/* Le worker de l'écran de chargement : il reçoit le canevas (OffscreenCanvas) et dessine
   sans dépendre du fil principal, occupé à construire le cockpit. */
declare const self: DedicatedWorkerGlobalScope;

let painter: ReturnType<typeof createPainter> | null = null;
// les messages arrivés pendant le chargement de la police attendent leur tour
const waiting: ToPainter[] = [];

self.onmessage = async (e: MessageEvent<ToPainter & { fontUrl?: string }>) => {
  const m = e.data;
  if (m.type !== "init" || !m.canvas) { if (painter) painter.receive(m); else waiting.push(m); return; }
  const canvas = m.canvas;
  // la police du pourcentage, chargée dans le worker (il n'a pas celles de la page)
  if (m.fontUrl && "fonts" in self) {
    try {
      const face = new FontFace("Barlow Condensed", `url(${m.fontUrl})`, { weight: "600" });
      self.fonts.add(await face.load());
    } catch { /* police de secours */ }
  }
  const g = canvas.getContext("2d")!;
  painter = createPainter(g, (w, h) => { canvas.width = w; canvas.height = h; }, (msg) => self.postMessage(msg));
  painter.receive(m);
  for (const w of waiting.splice(0)) painter.receive(w);
};
