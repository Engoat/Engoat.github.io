import { PROJECTS, SKILLS } from "../content/profile";

/* Les commandes du cockpit au clavier et pour les lecteurs d'écran : invisibles,
   elles apparaissent dès qu'on y entre avec Tab. */
const COMMANDS: [string, string][] = [
  ["dossier", "Dossier"],
  ["contact", "Contact"],
  ["nav_prev", "Projet précédent"],
  ["nav_next", "Projet suivant"],
  ["engage", "Engager vers le projet choisi"],
  ...PROJECTS.map((p): [string, string] => ["engage_" + p.key, "Engager vers " + p.name]),
  ...SKILLS.map((s): [string, string] => [s.key, s.title]),
  ["next", "Visite : phrase suivante"],
  ["lights", "Feux cabine"],
  ["eject", "Éjection : portfolio classique"],
];

export function KeyboardNav({ onAct }: { onAct: (key: string) => void }) {
  return (
    <nav className="sr" aria-label="Commandes du cockpit">
      {COMMANDS.map(([key, label]) => (
        <button key={key} type="button" onClick={() => onAct(key)}>{label}</button>
      ))}
    </nav>
  );
}
