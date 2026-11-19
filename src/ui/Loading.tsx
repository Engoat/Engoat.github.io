import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PERSON } from "../content/profile";

/* L'écran de chargement : le logo d'Enzo Dylan (l'orbite) se trace au rythme du vrai
   chargement, sur le bleu Klein de la marque. Le satellite suit la pointe du trait, et
   chaque étape réelle est nommée. Une fois tout prêt, la planète du logo s'ouvre comme
   un iris sur le cockpit, encore éteint, juste avant son allumage. */

// les deux moitiés de l'orbite (derrière puis devant la planète), tracés du logo
const BACK = "M7.71,65.39 L7.45,64.03 L7.59,62.53 L8.14,60.91 L9.10,59.18 L10.45,57.37 L12.18,55.49 L14.27,53.55 L16.71,51.58 L19.47,49.59 L22.53,47.61 L25.84,45.65 L29.39,43.74 L33.14,41.88 L37.05,40.10 L41.09,38.42 L45.21,36.84 L49.38,35.40 L53.55,34.09 L57.69,32.94 L61.76,31.96 L65.71,31.14 L69.51,30.51 L73.12,30.07 L76.52,29.81 L79.65,29.76 L82.50,29.89 L85.04,30.22 L87.23,30.75 L89.08,31.45 L90.54,32.34 L91.61,33.39 L92.29,34.61";
const FRONT = "M92.29,34.61 L92.55,35.97 L92.41,37.47 L91.86,39.09 L90.90,40.82 L89.55,42.63 L87.82,44.51 L85.73,46.45 L83.29,48.42 L80.53,50.41 L77.47,52.39 L74.16,54.35 L70.61,56.26 L66.86,58.12 L62.95,59.90 L58.91,61.58 L54.79,63.16 L50.62,64.60 L46.45,65.91 L42.31,67.06 L38.24,68.04 L34.29,68.86 L30.49,69.49 L26.88,69.93 L23.48,70.19 L20.35,70.24 L17.50,70.11 L14.96,69.78 L12.77,69.25 L10.92,68.55 L9.46,67.66 L8.39,66.61 L7.71,65.39";

interface Props {
  progress: number; step: string; done: boolean; failed: boolean; onText: () => void;
  /** l'iris est ouvert : le cockpit peut s'allumer */
  onOpened: () => void;
}

export function Loading({ progress, step, done, failed, onText, onOpened }: Props) {
  const back = useRef<SVGPathElement>(null);
  const front = useRef<SVGPathElement>(null);
  const planet = useRef<SVGCircleElement>(null);
  const root = useRef<HTMLDivElement>(null);
  // la valeur affichée rattrape la vraie progression en douceur
  const [shown, setShown] = useState(0);
  const current = useRef(0);
  const [sat, setSat] = useState({ x: 7.71, y: 65.39 });
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = current.current, n = Math.abs(progress - s) < 0.004 ? progress : s + (progress - s) * 0.14;
      current.current = n;
      setShown(n);
      if (n !== progress) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progress]);

  /* l'orbite fermée et le cockpit prêt, le satellite fait un dernier tour jusqu'à sa
     place dans le logo (à 10 % du trait de devant) ; l'iris s'ouvre ensuite */
  const [lap, setLap] = useState(0);
  const closed = done && shown >= 1;
  useEffect(() => {
    if (!closed) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 900);
      setLap(1 - (1 - k) ** 3);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [closed]);

  // le satellite : à la pointe du trait, puis pendant le dernier tour
  useLayoutEffect(() => {
    if (!back.current || !front.current) return;
    // position sur l'orbite entière : 0 → 0,5 derrière la planète, 0,5 → 1 devant
    const u = closed ? (lap < 0.83 ? lap * 1.2 * 0.5 + 0 : 0.5 + (lap - 0.83) / 0.17 * 0.05) : shown;
    const onFront = u >= 0.5;
    const path = onFront ? front.current : back.current;
    const along = Math.min(onFront ? (u - 0.5) * 2 : u * 2, 1);
    const p = path.getPointAtLength(path.getTotalLength() * along);
    setSat({ x: p.x, y: p.y });
  }, [shown, lap, closed]);

  // l'iris s'ouvre depuis le centre de la planète du logo
  const opening = (closed && lap >= 1) || failed;
  useLayoutEffect(() => {
    if (!opening || !planet.current || !root.current) return;
    const r = planet.current.getBoundingClientRect();
    root.current.style.setProperty("--cx", `${r.left + r.width / 2}px`);
    root.current.style.setProperty("--cy", `${r.top + r.height / 2}px`);
    const id = setTimeout(() => { setGone(true); onOpened(); }, 1500);
    return () => clearTimeout(id);
  }, [opening, onOpened]);

  if (gone) return null;
  const backK = Math.min(shown * 2, 1), frontK = Math.max(0, shown * 2 - 1);
  return (
    <div ref={root} className="loading" data-open={opening} role="status" aria-label={`Chargement du cockpit, ${Math.round(shown * 100)} %`}>
      <div className="loading__card">
        <svg className="loading__orbit" viewBox="0 0 100 100" aria-hidden="true">
          <path ref={back} d={BACK} pathLength={1} className="loading__arc" style={{ strokeDashoffset: 1 - backK }} />
          <circle ref={planet} cx="50" cy="50" r="21" className="loading__planet" />
          {/* le trait de devant passe sur la planète : un liseré bleu l'en détache */}
          <path d={FRONT} pathLength={1} className="loading__gap" style={{ strokeDashoffset: 1 - frontK }} />
          <path ref={front} d={FRONT} pathLength={1} className="loading__arc" style={{ strokeDashoffset: 1 - frontK }} />
          <circle cx={sat.x} cy={sat.y} r="6" className="loading__sat" />
        </svg>
        <p className="loading__name">{PERSON.name}</p>
        <p className="loading__lead">{PERSON.lead}</p>
        <p className="loading__state">
          <span>{failed ? "La 3D ne peut pas démarrer ici" : step}</span>
          <span className="loading__pct">{Math.round(shown * 100)} %</span>
        </p>
        <button type="button" className="loading__text" onClick={onText}>Lire la version texte</button>
      </div>
    </div>
  );
}
