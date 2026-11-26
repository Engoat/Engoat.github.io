import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { Ctx, UiBridge } from "./types";
import type { ProjectKey } from "../content/profile";
import { Animator } from "./util/tween";
import { TextureFactory, createMaterials } from "./util/textures";
import { buildSpace } from "./world/space";
import { buildLights, updateLights } from "./world/lights";
import { buildCabin } from "./world/cabin";
import { buildPanel, updatePanel } from "./world/panel";
import { buildConsoles } from "./world/console";
import { buildHands, placeHandsAtRest, updateArm } from "./world/hands";
import { applyWear, exportWearable } from "./world/wear";
import { buildDetails } from "./world/details";
import { createSlip } from "./actions/slip";
import { createTravel } from "./actions/travel";
import { createCommands } from "./actions/commands";
import { createOrrery } from "./actions/orrery";
import { createDirector } from "./demo/director";
import { createHead } from "./camera";

/** ce que l'interface React peut demander au cockpit */
export interface Cockpit {
  act(key: string): void;
  /** lance la séquence d'allumage (une seule fois) */
  boot(): void;
  siteClosed(): void;
  dispose(): void;
}

/* hooks de capture d'écran (scripts Playwright) : temps figé et avancé pas à pas */
declare global {
  interface Window { __manual?: boolean; __pending?: number; __ready?: boolean; __dbg?: unknown }
}

const FONTS = ['600 40px "Barlow Condensed"', '700 40px "Barlow Condensed"', '500 40px "IBM Plex Mono"',
  '600 40px "IBM Plex Mono"', '600 40px "Instrument Sans"', '700 40px "Instrument Sans"'];

export async function createCockpit(canvas: HTMLCanvasElement, ui: UiBridge): Promise<Cockpit> {
  const params = new URLSearchParams(location.search);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // les mains (WebXR Input Profiles, W3C) se chargent pendant qu'on construit le reste
  const loader = new GLTFLoader();
  const base = import.meta.env.BASE_URL;
  const handsP = Promise.all([loader.loadAsync(base + "assets/hands/right.glb"), loader.loadAsync(base + "assets/hands/left.glb")]);

  /* Moteur WebGL classique. Le moteur WebGPU de Three.js a été essayé : sur une puce
     Intel UHD 620, il était 30 % plus lent, même dans son mode WebGL 2. */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.localClippingEnabled = true;     // la maquette est coupée au niveau de la planche
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010204);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.2;

  const camHome = { pos: new THREE.Vector3(0, 0.01, 0.05), look: new THREE.Vector3(0, -0.24, -1) };
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.02, 3000);
  camera.position.copy(camHome.pos);
  camera.lookAt(camHome.look);

  /* avancement réel, annoncé à l'écran de chargement ; la courte pause laisse le
     navigateur afficher l'étape avant le calcul suivant, qui bloque le fil */
  const step = async (k: number, label: string) => {
    ui.progress(k, label);
    await new Promise((r) => setTimeout(r, 40));
  };
  await step(0.12, "Polices de bord");
  // les textures écrites au canevas ont besoin des polices
  await Promise.all(FONTS.map((f) => document.fonts.load(f)));
  await step(0.2, "Peinture des planètes");

  const ctx = {
    canvas, renderer, scene, camera, ui, params, reduced,
    boot: !reduced && !params.has("noboot"),
    anim: new Animator(reduced),
    tex: new TextureFactory(renderer.capabilities.getMaxAnisotropy()),
    M: createMaterials(),
    camHome,
    camTarget: { pos: camHome.pos.clone(), look: camHome.look.clone(), lean: 0, fov: 52 },
  } as Ctx;

  buildSpace(ctx);
  await step(0.4, "Assemblage de la cabine");
  buildLights(ctx);
  buildCabin(ctx);
  buildPanel(ctx);
  buildConsoles(ctx);
  buildDetails(ctx);
  await step(0.5, "Maquette des planètes");
  const orrery = createOrrery(ctx);
  await step(0.55, "Gants et combinaison");
  const [gR, gL] = await handsP;
  buildHands(ctx, gR, gL);
  await step(0.68, "Usure des matières");
  // matières usées calculées dans Blender (sans elles, le cockpit garde ses couleurs unies)
  if (params.has("export")) (window as unknown as Record<string, unknown>).__exportWear = () => exportWearable(ctx);
  else if (!params.has("nowear")) await applyWear(ctx);
  await step(0.84, "Réglage des instruments");

  const slip = createSlip(ctx);
  let commands: ReturnType<typeof createCommands>;
  const director = createDirector(ctx, { back: () => commands.act("engage_" + travel.state.target) });
  const travel = createTravel(ctx, {
    arrived: (t) => { void director.start(t); },
    leaving: () => director.stop(),
  });
  commands = createCommands(ctx, slip, travel, orrery);
  const head = createHead(ctx);

  /* --- clics : commandes du cockpit, ruban, ou planète vue par le hublot --- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const caps: THREE.Object3D[] = Object.values(ctx.buttons).map((b) => b.cap);
  slip.mesh.userData.button = { key: "tear" };
  caps.push(slip.mesh);
  const blockers: THREE.Object3D[] = [];
  ctx.cockpit.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !o.userData.skip && o !== slip.mesh && o !== director.hud.mesh) blockers.push(o);
  });

  function aim(e: PointerEvent | MouseEvent) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  function pickButton(): string | null {
    const hit = ray.intersectObjects(caps, false).find((h) => h.object.visible);
    return hit ? hit.object.userData.button.key : null;
  }
  // une planète du hublot, si rien du cockpit ne la cache (au repos seulement)
  function pickPlanet(): ProjectKey | null {
    if (travel.state.state !== "home") return null;
    const meshes = Object.values(ctx.planets).map((p) => p.mesh);
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit) return null;
    const wall = ray.intersectObjects(blockers, false)[0];
    return wall && wall.distance < hit.distance ? null : hit.object.userData.planet;
  }
  // une miniature de la maquette (elles ne se touchent que maquette sortie, au repos)
  function pickMini(): ProjectKey | null {
    if (travel.state.state !== "home" || !orrery.state.open) return null;
    const hit = ray.intersectObjects(orrery.hits, false).find((h) => h.object.visible);
    return hit ? (hit.object.userData.button.key.slice(5) as ProjectKey) : null;
  }
  // « Suivant », dessiné sur la vitre sous le texte de la tour de contrôle
  function pickNext() {
    if (!director.hud.mesh.visible) return false;
    const hit = ray.intersectObject(director.hud.mesh, false)[0];
    return !!hit?.uv && director.hud.hitsNext(hit.uv);
  }
  const onMove = (e: PointerEvent) => {
    aim(e);
    const mini = pickMini();
    orrery.hover(mini);
    // la carte détaillée de la planète survolée se prépare à l'avance : le départ ne saccade pas
    if (mini && mini !== warmed) { warmed = mini; setTimeout(() => { if (travel.state.state === "home") ctx.detailPlanet(mini); }, 150); }
    canvas.classList.toggle("hot", pickNext() || !!pickButton() || mini !== null || !!pickPlanet());
  };
  let warmed: ProjectKey | null = null;
  const onClick = (e: MouseEvent) => {
    aim(e);
    if (pickNext()) { director.next(); return; }
    const key = pickButton();
    if (key && !key.startsWith("mini_")) { commands.act(key); return; }
    const target = pickMini() ?? pickPlanet();
    if (target) commands.act("engage_" + target);
  };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("click", onClick);
  // au clavier : → ou Entrée font avancer la visite (sauf si un bouton de la page a le focus)
  const onKey = (e: KeyboardEvent) => {
    if (!director.state.active || (e.key !== "ArrowRight" && e.key !== "Enter")) return;
    const el = document.activeElement;
    if (el && el !== document.body && el !== canvas) return;
    e.preventDefault();
    director.next();
  };
  addEventListener("keydown", onKey);
  const act = (key: string) => (key === "next" ? director.next() : commands.act(key));

  let held = true;
  const onResize = () => {
    head.resize(innerWidth, innerHeight); placeHandsAtRest(ctx);
    if (held) renderer.render(scene, camera);
  };
  addEventListener("resize", onResize);
  head.resize(innerWidth, innerHeight);

  /* --- boucle de rendu --- */
  const timer = new THREE.Timer();
  let raf = 0;
  function update(t: number, dt: number) {
    ctx.anim.step(dt);
    updatePanel(ctx, t, dt);
    orrery.update(dt);
    // le gros bouton attire l'œil quand la maquette est rentrée et que le vaisseau est au repos
    ctx.attract = !orrery.state.open && !orrery.state.busy && travel.state.state === "home";
    travel.update(dt);
    head.update(t, dt, travel.state.thrust);
    updateLights(ctx, dt);
    for (const h of Object.values(ctx.hands)) updateArm(h);
    director.update(dt);
  }
  function frame(now: number) {
    timer.update(now);
    const t = timer.getElapsed();
    let dt = Math.min(timer.getDelta(), 0.05);
    if (window.__manual) { dt = window.__pending ?? 0; window.__pending = 0; }
    update(t, dt);
    // pendant l'ouverture de l'iris, le cockpit éteint reste sur la première image
    if (!held) renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  /* Tout ce que la première image coûte est payé pendant l'écran de chargement (dont le
     dessin tourne dans un worker, il ne se fige pas) : shaders, puis textures envoyées
     une à une à la carte graphique, puis une première image. */
  update(0, 0);   // mains, aiguilles et caméra à leur place avant la première image
  await renderer.compileAsync(scene, camera);
  await step(0.92, "Envoi à la carte graphique");
  const textures = new Set<THREE.Texture>();
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    for (const mat of ([] as THREE.Material[]).concat(m))
      for (const v of Object.values(mat)) if ((v as THREE.Texture | null)?.isTexture) textures.add(v as THREE.Texture);
  });
  for (const t of textures) { renderer.initTexture(t); await new Promise((r) => setTimeout(r, 0)); }
  await step(0.97, "Première image");
  renderer.render(scene, camera);
  ui.progress(1, "Prêt");
  raf = requestAnimationFrame(frame);
  window.__ready = true;
  window.__dbg = { ctx, act, travel, director, orrery, boot: () => boot() };
  /* l'allumage part quand l'écran de chargement s'est ouvert sur le cockpit (l'interface
     appelle boot) ; s'il ne l'a pas fait au bout de 6 s, il part de lui-même */
  let booted = false;
  const boot = () => {
    held = false;
    if (!booted && ctx.boot) { booted = true; void commands.boot(); }
  };
  const bootTimer = setTimeout(boot, 6000);

  return {
    act,
    boot,
    siteClosed: commands.siteClosed,
    dispose() {
      cancelAnimationFrame(raf);
      clearTimeout(bootTimer);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("click", onClick);
      removeEventListener("keydown", onKey);
      removeEventListener("resize", onResize);
      renderer.dispose();
    },
  };
}
