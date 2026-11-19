/* Tout le contenu du portfolio, en un seul endroit : le portfolio classique, l'écran de
   chargement, les rubans imprimés du cockpit et la version sans JavaScript le lisent ici.
   Rien n'est dupliqué. */

export const GITHUB = "https://github.com/Engoat";
export const EMAIL = "enzoprog25@gmail.com";

export const PERSON = {
  name: "Enzo Dylan",
  lead: "Élève ingénieur en informatique, 4e année.",
  place: "Cameroun",
  profile: "Je construis des outils qui montrent un calcul pendant qu'il se fait.",
};

export type SkillKey = "claude" | "python" | "sql" | "ml" | "web" | "java";
export interface Skill { key: SkillKey; title: string; text: string }

export const SKILLS: Skill[] = [
  { key: "claude", title: "Claude", text: "Claude est mon binôme de développement : Claude Code pour écrire et relire du code, l'API Claude dans mes applications. Ce cockpit a été construit avec lui." },
  { key: "python", title: "Python", text: "Back-end et données : API web avec FastAPI, analyse avec pandas, pipelines de collecte et de nettoyage." },
  { key: "sql", title: "SQL", text: "PostgreSQL pour les applications, DuckDB pour l'analyse : Crible fait tourner DuckDB dans le navigateur. Jointures, agrégations, conception de schémas." },
  { key: "ml", title: "Machine learning", text: "Apprentissage supervisé avec scikit-learn : régression, classification, validation croisée, choix des métriques." },
  { key: "web", title: "TypeScript · React", text: "Interfaces en React et TypeScript, construites avec Vite. Nexus, Crible et ce portfolio en sont des exemples." },
  { key: "java", title: "Java", text: "Back-end en Java 21 avec Spring Boot 3 : API REST, extraction de texte depuis des fichiers Word et PDF." },
];

/* lignes courtes pour le ruban du dossier */
export const SKILL_LINES = ["TypeScript · React · Vite", "Python · FastAPI · pandas", "Java · Spring Boot", "SQL · PostgreSQL", "Git"];

export type ProjectKey = "nexus" | "crible" | "alea";
export interface Project {
  key: ProjectKey; name: string; text: string; slip: string; repo: string;
  /** bibliothèques réellement utilisées (package.json du projet) */
  stack: string[];
  /** couleur signature de la marque du projet */
  color: string;
  /** la marque a-t-elle un logo (public/assets/projects/<clé>-icone.svg) ? */
  icon: boolean;
  /** capture de l'application (public/assets/projects) et sa description */
  shot: { src: string; alt: string };
}

export const PROJECTS: Project[] = [
  {
    key: "nexus",
    name: "Nexus",
    text: "Atelier d'algorithmes de graphes et de files d'attente : on dessine un graphe, on choisit un algorithme parmi huit et on le suit étape par étape. Un second atelier simule une file d'attente et en calcule les mesures.",
    slip: "Atelier pour apprendre les algorithmes de graphes (8 algorithmes) et simuler des files d'attente.",
    repo: `${GITHUB}/nexus`,
    stack: ["TypeScript", "React", "Vite"],
    color: "#6b2bd9",
    icon: true,
    shot: { src: "nexus", alt: "Nexus : l'algorithme de Dijkstra en cours sur un graphe de cinq sommets, étape 7 sur 22, avec les invariants vérifiés à cette étape." },
  },
  {
    key: "crible",
    name: "Crible",
    text: "Contrôle de la qualité d'un fichier CSV ou Excel, dans le navigateur : on écrit des règles (douze types), on remonte aux lignes en défaut et on exporte un rapport. Des contrôles pour le machine learning (fuite de cible, écart entre entraînement et test) complètent l'outil.",
    slip: "Contrôle de la qualité d'un fichier CSV ou Excel : règles, lignes en défaut, rapport.",
    repo: `${GITHUB}/crible`,
    stack: ["TypeScript", "React", "Vite", "DuckDB-WASM", "SheetJS"],
    color: "#e8432a",
    icon: true,
    shot: { src: "crible", alt: "Crible : tableau de bord sur titanic.csv (891 lignes) ; la règle « Age ≥ 0 et ≤ 60 » échoue sur 22 lignes, listées en dessous." },
  },
  {
    key: "alea",
    name: "Aléa",
    text: "Application mobile de hasard, écrite en React Native. Des dés pour les jeux de rôle, avec la notation complète (3d6+2, 4d6kh3, d6!) et la probabilité exacte de chaque résultat ; des tirages au sort (roue, cartes, équipes équilibrées, sans remise) que n'importe qui peut vérifier pour s'assurer qu'ils ne sont pas truqués.",
    slip: "Application mobile : dés de jeu de rôle avec probabilité exacte, et tirages au sort vérifiables.",
    repo: `${GITHUB}/alea`,
    stack: ["TypeScript", "React Native", "Expo"],
    // pas encore de couleur signature (séance logo à venir) : l'encre de l'application
    color: "#1b1a17",
    icon: false,
    shot: { src: "alea", alt: "Aléa, trois écrans : le lancer 4d6kh3 avec ses dés, son total et sa loi de probabilité ; la roue d'un tirage au sort avec sa preuve ; la vérification d'un tirage." },
  },
];

/* « github.com/Engoat/nexus » : l'adresse sans le protocole, pour l'affichage */
export const bare = (url: string) => url.replace(/^https?:\/\//, "");
