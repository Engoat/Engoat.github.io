import { useEffect, useRef, useState } from "react";
import { PERSON } from "../content/profile";
import { createPainter, type FromPainter, type Layout, type ToPainter } from "./loading/painter";

/* L'écran de chargement : le logo d'Enzo Dylan (l'orbite) se trace au rythme du vrai
   chargement, sur le bleu Klein de la marque, et chaque étape réelle est nommée. Une fois
   tout prêt, le satellite fait un dernier tour, puis la planète du logo s'ouvre comme un
   iris sur le cockpit, encore éteint, juste avant son allumage.

   Le dessin se fait dans un worker (voir loading/painter.ts) : il reste fluide pendant que
   le fil principal construit le cockpit. Le texte reste dans la page, pour l'accessibilité. */

interface Props {
  progress: number; step: string; done: boolean; failed: boolean; onClassic: () => void;
  /** l'iris est ouvert : le cockpit peut s'allumer */
  onOpened: () => void;
}

const FONT = '600 1px "Barlow Condensed", sans-serif';

export function Loading({ progress, step, done, failed, onClassic, onOpened }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const orbit = useRef<HTMLDivElement>(null);
  const send = useRef<(m: ToPainter) => void>(() => {});
  const opened = useRef(onOpened);
  opened.current = onOpened;
  const finished = useRef(false);
  const [pct, setPct] = useState(0);
  const [opening, setOpening] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const c = canvas.current!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const layout = (): Layout => {
      const r = orbit.current!.getBoundingClientRect();
      return { w: innerWidth, h: innerHeight, dpr: Math.min(devicePixelRatio, 2), logo: { x: r.left, y: r.top, size: r.width } };
    };
    const finish = () => {
      if (finished.current) return;
      finished.current = true;
      setGone(true);
      opened.current();
    };
    const receive = (m: FromPainter) => {
      if (m.type === "pct") setPct(m.v);
      else if (m.type === "opening") setOpening(true);
      // sans animation, l'écran s'efface en fondu (CSS) avant de disparaître
      else setTimeout(finish, reduced ? 400 : 0);
    };

    let worker: Worker | null = null;
    if (typeof c.transferControlToOffscreen === "function") {
      worker = new Worker(new URL("./loading/loadingWorker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (e: MessageEvent<FromPainter>) => receive(e.data);
      const off = c.transferControlToOffscreen();
      const fontUrl = new URL(`${import.meta.env.BASE_URL}assets/fonts/barlow-condensed-latin-600.woff2`, location.href).href;
      worker.postMessage({ type: "init", reduced, font: FONT, fontUrl, canvas: off, ...layout() }, [off]);
      send.current = (m) => worker!.postMessage(m);
    } else {
      // navigateur sans OffscreenCanvas : le même dessin, sur le fil principal
      const p = createPainter(c.getContext("2d")!, (w, h) => { c.width = w; c.height = h; }, receive);
      p.receive({ type: "init", reduced, font: FONT, ...layout() });
      send.current = p.receive;
    }

    // le logo bouge quand la page change de taille ou quand les polices arrivent
    const relayout = () => { if (orbit.current) send.current({ type: "layout", ...layout() }); };
    const ro = new ResizeObserver(relayout);
    ro.observe(orbit.current!.parentElement!);
    addEventListener("resize", relayout);
    void document.fonts.ready.then(relayout);
    return () => { ro.disconnect(); removeEventListener("resize", relayout); worker?.terminate(); };
  }, []);

  useEffect(() => { send.current({ type: "progress", k: progress }); }, [progress]);
  useEffect(() => { if (done) send.current({ type: "done" }); }, [done]);
  useEffect(() => { if (failed) send.current({ type: "fail" }); }, [failed]);

  // filet de sécurité : si le dessin n'a pas pu tourner, l'écran s'efface quand même
  useEffect(() => {
    if (!done && !failed) return;
    const id = setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      setGone(true);
      opened.current();
    }, 6000);
    return () => clearTimeout(id);
  }, [done, failed]);

  if (gone) return null;
  return (
    <div className="loading" data-open={opening}>
      <canvas ref={canvas} className="loading__canvas" aria-hidden="true" />
      <div className="loading__card" role="progressbar" aria-label="Chargement du cockpit"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div ref={orbit} className="loading__orbit" />
        <p className="loading__name">{PERSON.name}</p>
        <p className="loading__lead">{PERSON.lead}</p>
        <p className="loading__state">{failed ? "La 3D ne peut pas démarrer ici" : step}</p>
        <button type="button" className="loading__text" onClick={onClassic}>Voir le portfolio classique</button>
      </div>
    </div>
  );
}
