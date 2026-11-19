import { useCallback, useEffect, useRef, useState } from "react";
import type { CaptionItem } from "./engine/types";
import type { Cockpit } from "./engine";
import { Loading } from "./ui/Loading";
import { CaptionBar } from "./ui/CaptionBar";
import { KeyboardNav } from "./ui/KeyboardNav";
import { ClassicSite } from "./ui/ClassicSite";

/* L'application : le cockpit 3D (moteur three.js, monté une fois) et, autour de lui,
   l'interface en React — écran de chargement, barre du bas, commandes au clavier et
   portfolio classique. Le moteur ne touche jamais au DOM : il passe par le pont « ui ». */

const CLASSIC = "#classique";

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cockpit = useRef<Cockpit | null>(null);
  // arrivé par l'adresse #classique : la 3D n'est téléchargée que si on la demande
  const [want3d, setWant3d] = useState(() => location.hash !== CLASSIC);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [caption, setCaption] = useState<CaptionItem[] | null>(null);
  const [siteOpen, setSiteOpen] = useState(() => location.hash === CLASSIC);
  const [voice, setVoice] = useState("");
  // avant que le moteur ne parle, on télécharge son code (Three.js compris)
  const [load, setLoad] = useState({ k: 0.04, step: "Téléchargement du cockpit" });

  useEffect(() => {
    if (!want3d) return;
    let cancelled = false;
    import("./engine")
      .then(({ createCockpit }) => createCockpit(canvasRef.current!, {
        setCaption,
        openSite: () => setSiteOpen(true),
        announce: setVoice,
        progress: (k, step) => setLoad({ k, step }),
      }))
      .then((c) => {
        if (cancelled) { c.dispose(); return; }
        cockpit.current = c;
        setReady(true);
      })
      .catch((e: unknown) => {
        // sans WebGL (ou en cas d'erreur), le portfolio classique reste accessible
        console.error(e);
        if (!cancelled) { setFailed(true); setSiteOpen(true); }
      });
    return () => { cancelled = true; cockpit.current?.dispose(); cockpit.current = null; };
  }, [want3d]);

  // l'adresse suit la page affichée : #classique se partage tel quel
  useEffect(() => {
    const url = location.pathname + location.search + (siteOpen ? CLASSIC : "");
    if (url !== location.pathname + location.search + location.hash) history.replaceState(null, "", url);
  }, [siteOpen]);

  const act = useCallback((key: string) => {
    if (key === "eject" && !cockpit.current) { setSiteOpen(true); return; }
    cockpit.current?.act(key);
  }, []);

  // l'écran de chargement s'est ouvert sur le cockpit éteint : on l'allume
  const opened = useCallback(() => cockpit.current?.boot(), []);

  const closeSite = useCallback(() => {
    setSiteOpen(false);
    setWant3d(true);
    cockpit.current?.siteClosed();
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="cockpit" aria-label="Cockpit du vaisseau, vu depuis le siège du pilote" />
      {want3d && <Loading progress={load.k} step={load.step} done={ready} failed={failed}
        onClassic={() => setSiteOpen(true)} onOpened={opened} />}
      <KeyboardNav onAct={act} />
      <CaptionBar items={caption} />
      <ClassicSite open={siteOpen} onClose={failed ? undefined : closeSite}
        closeLabel={want3d ? "Retour au cockpit" : "Entrer dans le cockpit"} />
      <p className="sr" aria-live="polite">{voice}</p>
    </>
  );
}
