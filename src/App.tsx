import { useCallback, useEffect, useRef, useState } from "react";
import type { CaptionItem } from "./engine/types";
import type { Cockpit } from "./engine";
import { Loading } from "./ui/Loading";
import { CaptionBar } from "./ui/CaptionBar";
import { KeyboardNav } from "./ui/KeyboardNav";
import { TextVersion } from "./ui/TextVersion";

/* L'application : le cockpit 3D (moteur three.js, monté une fois) et, autour de lui,
   l'interface en React — écran de chargement, barre du bas, commandes au clavier et
   version texte. Le moteur ne touche jamais au DOM : il passe par le pont « ui ». */
export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cockpit = useRef<Cockpit | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [caption, setCaption] = useState<CaptionItem[] | null>(null);
  const [textOpen, setTextOpen] = useState(false);
  const [voice, setVoice] = useState("");

  useEffect(() => {
    let cancelled = false;
    import("./engine")
      .then(({ createCockpit }) => createCockpit(canvasRef.current!, {
        setCaption,
        openText: () => setTextOpen(true),
        announce: setVoice,
      }))
      .then((c) => {
        if (cancelled) { c.dispose(); return; }
        cockpit.current = c;
        setReady(true);
      })
      .catch((e: unknown) => {
        // sans WebGL (ou en cas d'erreur), la version texte reste accessible
        console.error(e);
        if (!cancelled) { setFailed(true); setTextOpen(true); }
      });
    return () => { cancelled = true; cockpit.current?.dispose(); cockpit.current = null; };
  }, []);

  const act = useCallback((key: string) => {
    if (key === "eject" && !cockpit.current) { setTextOpen(true); return; }
    cockpit.current?.act(key);
  }, []);

  const closeText = useCallback(() => {
    setTextOpen(false);
    cockpit.current?.textClosed();
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="cockpit" aria-label="Cockpit du vaisseau, vu depuis le siège du pilote" />
      <Loading done={ready} failed={failed} onText={() => setTextOpen(true)} />
      <KeyboardNav onAct={act} />
      <CaptionBar items={caption} />
      <TextVersion open={textOpen} onClose={failed ? undefined : closeText} />
      <p className="sr" aria-live="polite">{voice}</p>
    </>
  );
}
