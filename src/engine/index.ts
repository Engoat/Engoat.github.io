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
import { createSlip } from "./actions/slip";
import { createTravel } from "./actions/travel";
import { createCommands } from "./actions/commands";
import { createDirector } from "./demo/director";
import { createHead } from "./camera";

/** ce que l'interface React peut demander au cockpit */
export interface Cockpit {
  act(key: string): void;
  textClosed(): void;
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

  // les textures écrites au canevas ont besoin des polices
  await Promise.all(FONTS.map((f) => document.fonts.load(f)));

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
  buildLights(ctx);
  buildCabin(ctx);
  buildPanel(ctx);
  buildConsoles(ctx);
  const [gR, gL] = await handsP;
  buildHands(ctx, gR, gL);
  // matières usées calculées dans Blender (sans elles, le cockpit garde ses couleurs unies)
  if (params.has("export")) (window as unknown as Record<string, unknown>).__exportWear = () => exportWearable(ctx);
  else if (!params.has("nowear")) await applyWear(ctx);

  const slip = createSlip(ctx);
  let commands: ReturnType<typeof createCommands>;
  const director = createDirector(ctx, { back: () => commands.act("engage_" + travel.state.target) });
  const travel = createTravel(ctx, {
    arrived: (t) => { void director.start(t); },
    leaving: () => director.stop(),
  });
  commands = createCommands(ctx, slip, travel);
  const head = createHead(ctx);

  /* --- clics : commandes du cockpit, ruban, ou planète vue par le hublot --- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const caps: THREE.Object3D[] = Object.values(ctx.buttons).map((b) => b.cap);
  slip.mesh.userData.button = { key: "tear" };
  caps.push(slip.mesh);
  const planetMeshes = Object.values(ctx.planets).map((p) => p.mesh);
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
  // une planète n'est cliquable qu'au repos, et si rien du cockpit ne la cache
  function pickPlanet(): ProjectKey | null {
    if (travel.state.state !== "home") return null;
    const hit = ray.intersectObjects(planetMeshes, false)[0];
    if (!hit) return null;
    const wall = ray.intersectObjects(blockers, false)[0];
    return wall && wall.distance < hit.distance ? null : hit.object.userData.planet;
  }
  const onMove = (e: PointerEvent) => { aim(e); canvas.classList.toggle("hot", !!pickButton() || !!pickPlanet()); };
  const onClick = (e: MouseEvent) => {
    aim(e);
    const key = pickButton();
    if (key) { commands.act(key); return; }
    const planet = pickPlanet();
    if (planet) commands.act("engage_" + planet);
  };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("click", onClick);

  const onResize = () => { head.resize(innerWidth, innerHeight); placeHandsAtRest(ctx); };
  addEventListener("resize", onResize);
  head.resize(innerWidth, innerHeight);

  /* --- boucle de rendu --- */
  const timer = new THREE.Timer();
  let raf = 0;
  function frame(now: number) {
    timer.update(now);
    const t = timer.getElapsed();
    let dt = Math.min(timer.getDelta(), 0.05);
    if (window.__manual) { dt = window.__pending ?? 0; window.__pending = 0; }
    ctx.anim.step(dt);
    updatePanel(ctx, t, dt);
    travel.update(dt);
    head.update(t, dt, travel.state.thrust);
    updateLights(ctx, dt);
    for (const h of Object.values(ctx.hands)) updateArm(h);
    director.update(dt);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  // les shaders sont compilés pendant l'écran de chargement, pas à la première image
  await renderer.compileAsync(scene, camera);
  raf = requestAnimationFrame(frame);
  window.__ready = true;
  window.__dbg = { ctx, act: commands.act, travel, director };
  if (ctx.boot) void commands.boot();

  return {
    act: commands.act,
    textClosed: commands.textClosed,
    dispose() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("click", onClick);
      removeEventListener("resize", onResize);
      renderer.dispose();
    },
  };
}
