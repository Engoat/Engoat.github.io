import { useEffect, useRef, useState } from "react";
import { EMAIL, GITHUB, IN_PROGRESS, PERSON, PROJECTS, SKILLS, bare } from "../content/profile";
import { BACK, FRONT, SATELLITE, svgPath } from "./logo";

/* Le portfolio classique : ce qui sort du cockpit au bouton ÉJECTION (ou de l'écran de
   chargement, ou directement par l'adresse #classique). Une page qui défile, pour lire
   vite ou sur un appareil modeste : présentation, projets avec une capture de chacun,
   compétences, contact. Tout le texte vient de content/profile.ts. */

const BASE = import.meta.env.BASE_URL;

/** le logo de la marque Enzo Dylan, en blanc sur le bleu Klein */
function Orbit({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={svgPath(BACK)} stroke="#fff" strokeWidth="3" />
        <circle cx="50" cy="50" r="21" fill="#fff" />
        <path d={svgPath(FRONT)} stroke="var(--klein)" strokeWidth="8" />
        <path d={svgPath(FRONT)} stroke="#fff" strokeWidth="3" />
        <circle cx={SATELLITE[0]} cy={SATELLITE[1]} r="6" fill="#fff" stroke="var(--klein)" strokeWidth="3" />
      </g>
    </svg>
  );
}

interface Props {
  open: boolean;
  /** retour au cockpit ; absent quand la 3D ne peut pas tourner */
  onClose?: () => void;
  /** libellé du retour : « Retour au cockpit » ou « Entrer dans le cockpit » */
  closeLabel: string;
}

export function ClassicSite({ open, onClose, closeLabel }: Props) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const page = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  // la page monte depuis le bas (on vient d'être éjecté), et redescend au retour
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
    const id = setTimeout(() => setMounted(false), 700);
    return () => clearTimeout(id);
  }, [open]);

  // Échap ramène au cockpit
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // les liens du menu font défiler la page elle-même (elle a sa propre barre de défilement)
  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    page.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: "smooth" });
  };

  if (!mounted) return null;
  return (
    <div ref={page} className="site" data-on={visible} role="region" aria-label="Portfolio classique">
      <header className="site__bar">
        <a className="site__brand" href="#haut" onClick={go("haut")}>
          <Orbit className="site__brand-logo" />
          <span>{PERSON.name}</span>
        </a>
        <nav className="site__nav" aria-label="Sections">
          <a href="#projets" onClick={go("projets")}>Projets</a>
          <a href="#competences" onClick={go("competences")}>Compétences</a>
          <a href="#contact" onClick={go("contact")}>Contact</a>
        </nav>
        {onClose && <button type="button" className="site__cockpit" onClick={onClose}>{closeLabel}</button>}
      </header>

      <section id="haut" className="site__hero" aria-labelledby="site-title">
        <div className="site__hero-text">
          <p className="site__kicker site__kicker--light">Portfolio</p>
          <h1 id="site-title" ref={title} tabIndex={-1}>{PERSON.name}</h1>
          <p className="site__lead">{PERSON.lead} {PERSON.place}.</p>
          <p className="site__profile">{PERSON.profile}</p>
          <p className="site__actions">
            <a className="site__btn site__btn--white" href="#projets" onClick={go("projets")}>Voir les projets</a>
            <a className="site__btn site__btn--line" href={GITHUB}>GitHub</a>
          </p>
        </div>
        <Orbit className="site__hero-logo" />
      </section>

      <section id="projets" className="site__section" aria-labelledby="site-projets">
        <h2 id="site-projets" className="site__kicker">Projets</h2>
        {PROJECTS.map((p) => (
          <article key={p.key} className="site__project" style={{ "--brand": p.color } as React.CSSProperties}>
            <header className="site__project-head">
              <img src={`${BASE}assets/projects/${p.key}-icone.svg`} alt="" width="44" height="44" />
              <h3>{p.name}</h3>
              <ul className="site__stack" aria-label="Technologies">
                {p.stack.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </header>
            <figure className="site__shot">
              <img
                src={`${BASE}assets/projects/${p.shot.src}.webp`}
                srcSet={`${BASE}assets/projects/${p.shot.src}-680.webp 680w, ${BASE}assets/projects/${p.shot.src}.webp 1360w`}
                sizes="(max-width: 1100px) 100vw, 1040px"
                width="1360" height="540" loading="lazy" alt={p.shot.alt} />
            </figure>
            <div className="site__project-body">
              <p>{p.text}</p>
              <a className="site__repo" href={p.repo}>Code : {bare(p.repo)}</a>
            </div>
          </article>
        ))}
        <aside className="site__wip" aria-labelledby="site-wip">
          <p className="site__wip-tag">En cours</p>
          <h3 id="site-wip">{IN_PROGRESS.name}</h3>
          <p>{IN_PROGRESS.text}</p>
        </aside>
      </section>

      <section id="competences" className="site__section site__section--tint" aria-labelledby="site-competences">
        <h2 id="site-competences" className="site__kicker">Compétences</h2>
        <ul className="site__skills">
          {SKILLS.map((s) => (
            <li key={s.key}>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="contact" className="site__contact" aria-labelledby="site-contact">
        <h2 id="site-contact" className="site__kicker site__kicker--light">Contact</h2>
        <a className="site__mail" href={`mailto:${EMAIL}`}>{EMAIL}</a>
        <p><a href={GITHUB}>{bare(GITHUB)}</a></p>
        {onClose && <button type="button" className="site__btn site__btn--white" onClick={onClose}>{closeLabel}</button>}
      </section>
    </div>
  );
}
