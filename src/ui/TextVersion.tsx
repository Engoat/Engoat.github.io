import { useEffect, useRef, useState } from "react";
import { EMAIL, GITHUB, PERSON, PROJECTS, SKILLS, bare } from "../content/profile";

/* La version texte du portfolio, pour lire vite ou sur un appareil modeste : le même
   contenu que les rubans du cockpit, sur une page de cahier. */
export function TextVersion({ open, onClose }: { open: boolean; onClose?: () => void }) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const page = useRef<HTMLElement>(null);

  // apparition et disparition en fondu
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => {
        setVisible(true);
        if (page.current) page.current.scrollTop = 0;
        title.current?.focus({ preventScroll: true });
      }));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const id = setTimeout(() => setMounted(false), 500);
    return () => clearTimeout(id);
  }, [open]);

  if (!mounted) return null;
  return (
    <section ref={page} className="eject" data-on={visible} aria-labelledby="ej-title">
      <article className="eject__page">
        <p className="eject__kicker">Portfolio · version texte</p>
        <h1 id="ej-title" ref={title} tabIndex={-1}>{PERSON.name}</h1>
        <p className="eject__lead">{PERSON.lead} {PERSON.place}.</p>
        <h2>Profil</h2>
        <p>{PERSON.profile}</p>
        <h2>Compétences</h2>
        <dl>
          {SKILLS.map((s) => <div key={s.key}><dt>{s.title}</dt><dd>{s.text}</dd></div>)}
        </dl>
        <h2>Projets</h2>
        {PROJECTS.map((p) => (
          <div key={p.key}>
            <h3>{p.name}</h3>
            <p>{p.text}</p>
            <p>Code : <a href={p.repo}>{bare(p.repo)}</a></p>
          </div>
        ))}
        <h2>Contact</h2>
        <p><a href={`mailto:${EMAIL}`}>{EMAIL}</a></p>
        <p><a href={GITHUB}>{bare(GITHUB)}</a></p>
        {onClose && <button type="button" className="eject__back" onClick={onClose}>Retour au cockpit</button>}
      </article>
    </section>
  );
}
