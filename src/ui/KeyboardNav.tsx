import { SKILLS } from "../content/profile";

/* Les commandes du cockpit au clavier et pour les lecteurs d'écran : invisibles,
   elles apparaissent dès qu'on y entre avec Tab. */
const COMMANDS: [string, string][] = [
  ["dossier", "Dossier"],
  ["contact", "Contact"],
  ["engage_nexus", "Engager vers Nexus"],
  ["engage_crible", "Engager vers Crible"],
  ...SKILLS.map((s): [string, string] => [s.key, s.title]),
  ["next", "Visite : phrase suivante"],
  ["lights", "Feux cabine"],
  ["eject", "Version texte"],
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
