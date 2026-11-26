import type * as THREE from "three";
import type { Animator } from "./util/tween";
import type { Materials, TextureFactory } from "./util/textures";
import type { ProjectKey } from "../content/profile";

/* --- ce que le moteur demande à l'interface React -------------------------- */

export type CaptionItem =
  | { kind: "text"; text: string }
  | { kind: "link"; label: string; href: string }
  | { kind: "button"; label: string; onClick: () => void | Promise<void> };

export interface UiBridge {
  /** barre du bas : texte, liens et boutons ; null la cache */
  setCaption(items: CaptionItem[] | null): void;
  /** ouvre le portfolio classique (bouton ÉJECTION) */
  openSite(): void;
  /** phrase lue par les lecteurs d'écran (voix de la tour de contrôle) */
  announce(text: string): void;
  /** avancement réel du chargement (0 à 1) et étape en cours */
  progress(k: number, step: string): void;
}

/* --- pièces du cockpit ----------------------------------------------------- */

export interface PushButton {
  key: string; kind?: undefined;
  group: THREE.Group; cap: THREE.Mesh; capMat: THREE.MeshStandardMaterial;
  depth: number; on: boolean;
}
export interface SwitchButton {
  key: string; kind: "toggle" | "guard";
  cap: THREE.Mesh; lever: THREE.Mesh; hinge?: THREE.Group;
}
/** une pièce qu'on touche du doigt sans rien actionner (une miniature de la maquette) */
export interface PadButton { key: string; kind: "pad"; cap: THREE.Mesh }
export type Button = PushButton | SwitchButton | PadButton;

export interface Needle { nd: THREE.Mesh; base: number; phase: number; speed: number }

export interface Hand {
  side: 1 | -1;
  rig: THREE.Group;
  bones: Record<string, THREE.Bone>;
  rest: Record<string, THREE.Quaternion>;
  forearm: THREE.Mesh; upper: THREE.Mesh; elbowBall: THREE.Mesh; cuff: THREE.Mesh; ring: THREE.Mesh;
  tape: THREE.Mesh | null;
  curl: number[]; thumb: number;
  shoulder: THREE.Vector3;
}
export interface Pose { curl: number[]; thumb: number }
export type PoseName = "grip" | "point" | "relaxed";
export interface RestPose { pos: THREE.Vector3; rot: THREE.Euler; pose: PoseName }

export interface Planet {
  key: ProjectKey; name: string;
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  shell: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  /** carte légère, portée au repos ; carte détaillée, fabriquée seulement pour la visite */
  map: THREE.CanvasTexture; detail: THREE.CanvasTexture | null;
  /** place actuelle sur l'orbite (repère de l'espace), et arrêt pendant la visite */
  home: THREE.Vector3; frozen: boolean;
  /** orbite autour du soleil : rayon, phase, vitesse angulaire */
  orbitR: number; phase: number; omega: number;
  /** à l'arrivée : position au centre du hublot, et rotation de l'extérieur qui l'y amène */
  approach: THREE.Vector3;
  qAlign: THREE.Quaternion; approachLocal: THREE.Vector3;
  radius: number;
}

export interface CameraTarget { pos: THREE.Vector3; look: THREE.Vector3; lean: number; fov: number }

/* --- le contexte partagé par tous les modules du moteur --------------------- */

export interface Ctx {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  ui: UiBridge;
  params: URLSearchParams;
  reduced: boolean;
  /** séquence d'allumage au démarrage */
  boot: boolean;
  anim: Animator;
  tex: TextureFactory;
  M: Materials;

  space: THREE.Group;
  /** toutes les planètes du ciel ; `planet(key)` en donne une */
  planets: Partial<Record<ProjectKey, Planet>>;
  planet(key: ProjectKey): Planet;
  /** le système tourne : à appeler à chaque image */
  systemUpdate(dt: number): void;
  freezePlanet(key: ProjectKey): void;
  releasePlanet(key: ProjectKey): void;
  detailPlanet(key: ProjectKey): void;
  lightPlanet(key: ProjectKey): void;
  /** le gros bouton cherche à attirer l'œil (maquette rentrée, vaisseau au repos) */
  attract: boolean;
  attractLeds: THREE.MeshStandardMaterial[];
  /** éclairage propre de l'interrupteur FEUX CABINE et de l'éjection, pour les trouver dans le noir */
  switchGlow: { labels: THREE.MeshStandardMaterial[]; leds: THREE.MeshStandardMaterial[] };

  sun: THREE.DirectionalLight;
  dome: THREE.PointLight;
  hemi: THREE.HemisphereLight;
  /** k = 0 cabine allumée, k = 1 vol de nuit (plafonnier éteint, cadrans rétroéclairés) */
  night: { on: boolean; k: number };
  /** état d'allumage : k (alimentation), dome (plafonnier, avec ses hésitations), test des aiguilles, voyant testé */
  power: { k: number; dome: number; test: number; lamp: string | null };

  cockpit: THREE.Group;
  panel: THREE.Group;
  printer: THREE.Group;
  printerLed: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  plateMat: THREE.MeshStandardMaterial;
  buttons: Record<string, Button>;
  needles: Needle[];
  gaugeFaces: THREE.MeshStandardMaterial[];
  window: { w: number; h: number; r: number; cy: number };

  hands: { right: Hand; left: Hand };
  camTarget: CameraTarget;
  camHome: { pos: THREE.Vector3; look: THREE.Vector3 };
}
