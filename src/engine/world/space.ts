import * as THREE from "three";
import type { Ctx, Planet } from "../types";
import type { ProjectKey } from "../../content/profile";
import { PROJECTS } from "../../content/profile";
import { paintCrible, paintNexus } from "./painters";
import { GLSL_NOISE } from "./noise.glsl";

/** direction initiale du soleil dans les shaders (recalculée à chaque image pour chaque planète) */
export const SUN_DIR = new THREE.Vector3(-0.95, 0.35, 0.12).normalize();

export function buildStars() {
  const n = 5000, p = new Float32Array(n * 3), c = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.randomDirection().multiplyScalar(900 + Math.random() * 600);
    p.set([v.x, v.y, v.z], i * 3);
    const k = Math.pow(Math.random(), 2.2) * 0.85 + 0.15, warm = Math.random();
    c.set([k, k * (0.93 + warm * 0.07), k * (0.86 + (1 - warm) * 0.14)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true, depthWrite: false }));
}

/* Les planètes, comme sur une photo prise en orbite. L'identité du projet reste la
   géographie ; s'y ajoutent ce qu'on voit sur une vraie planète :
   - des variations de teinte, tirées d'un bruit 3D sur la sphère (pas de couture) ;
   - un terminateur doux et une lueur de crépuscule ;
   - la face de nuit, où l'encre colorée (sommets du graphe, cellules en défaut) luit
     comme des villes ;
   - une atmosphère : voile sur le limbe côté jour et couronne autour du disque.
   Tout est calculé dans le shader : aucune texture de plus à télécharger. */
interface Look { atmo: number; lights: number; seed: number }

const surfaceMaterial = (map: THREE.Texture, look: Look) => new THREE.ShaderMaterial({
  uniforms: {
    map: { value: map }, sunDir: { value: SUN_DIR.clone() },
    atmo: { value: new THREE.Color(look.atmo) }, lights: { value: new THREE.Color(look.lights) },
    seed: { value: look.seed },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vP;
    void main(){
      vUv = uv;
      vP = position;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vW = wp.xyz;
      vN = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D map; uniform vec3 sunDir;
    uniform vec3 atmo; uniform vec3 lights; uniform float seed;
    varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vP;
    ${GLSL_NOISE}
    void main(){
      vec3 p = normalize(vP);
      vec3 ng = normalize(vN);
      vec3 v = normalize(cameraPosition - vW);
      vec4 tex = texture2D(map, vUv);
      // la nuit, seule l'encre colorée luit, floutée ; le seuil écarte les fines lignes de la grille
      vec3 blur = texture2D(map, vUv, 5.0).rgb;
      float inkSoft = smoothstep(0.28, 0.55, max(max(blur.r, blur.g), blur.b) - min(min(blur.r, blur.g), blur.b));

      // teinte : le papier n'est plus imprimé à plat, il varie comme un sol
      float mottle = fbm(p * 2.5 + seed * 3.0);
      vec3 albedo = tex.rgb * (0.86 + 0.16 * mottle);
      albedo = mix(albedo, vec3(dot(albedo, vec3(0.333))), 0.12);

      float ndl = dot(ng, sunDir);
      // Lambert adouci au terminateur (la diffusion atmosphérique éclaire un peu au-delà)
      float diffuse = smoothstep(-0.18, 0.85, ndl);
      vec3 col = albedo * diffuse * 2.1;

      // face de nuit : l'encre colorée luit faiblement, comme des villes vues de loin
      float night = smoothstep(0.02, -0.3, ndl);
      col += lights * inkSoft * night * 0.16;

      // atmosphère : voile vers le limbe côté jour, et liseré de crépuscule au terminateur
      float fres = pow(1.0 - max(dot(ng, v), 0.0), 2.2);
      col = mix(col, atmo * smoothstep(-0.25, 0.5, ndl), fres * 0.35);
      col += vec3(1.0, 0.48, 0.2) * exp(-pow(ndl * 5.0, 2.0)) * fres * 0.35;

      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});

// couronne d'atmosphère autour du disque : coque un peu plus grande, vue par l'intérieur
const atmosphereMaterial = (look: Look) => new THREE.ShaderMaterial({
  uniforms: { sunDir: { value: SUN_DIR.clone() }, atmo: { value: new THREE.Color(look.atmo) } },
  side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */ `
    varying vec3 vN; varying vec3 vW;
    void main(){
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vW = wp.xyz;
      vN = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 sunDir; uniform vec3 atmo;
    varying vec3 vN; varying vec3 vW;
    void main(){
      vec3 n = normalize(vN);
      vec3 v = normalize(cameraPosition - vW);
      // 0 au bord extérieur de la coque, environ 0,25 au ras de la planète
      float k = smoothstep(0.0, 0.24, max(dot(n, -v), 0.0));
      k = k * k;
      float lit = smoothstep(-0.35, 0.45, dot(n, sunDir));
      float dusk = exp(-pow(dot(n, sunDir) * 4.0, 2.0));
      gl_FragColor = vec4((atmo * lit + vec3(1.0, 0.5, 0.25) * dusk * 0.35) * k * 1.3, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});

/* Le système : un soleil devant le vaisseau, légèrement à gauche, et les planètes qui tournent
   autour de lui sur des orbites inclinées, en tournant aussi sur elles-mêmes. La maquette de la
   planche reprend les mêmes orbites, à la même phase : c'est le même ciel vu de dessus.
   Chaque planète est éclairée par le soleil : de face quand elle est derrière lui, en croissant ou
   en ombre quand elle passe devant.
   Au repos, chaque planète porte une carte légère (1024 × 512). La carte détaillée
   (4096 × 2048, 32 Mo) n'est fabriquée qu'au moment de partir, et libérée au retour. */
interface PlanetSpec { name: string; paint: (g: CanvasRenderingContext2D, W: number, H: number) => void; look: Look; radius: number; tilt: [number, number, number] }

// atmosphère de Nexus : violet de l'arbre (#6B2BD9) éclairci par la diffusion ; Crible : une poussière
// chaude tirée de son vermillon (#E8432A), comme le ciel de Mars.
// Lumières de nuit : sodium (l'encre colorée de Nexus et de Crible).
const SPECS: Record<ProjectKey, PlanetSpec> = {
  nexus: { name: "NEXUS", paint: paintNexus, look: { atmo: 0x9a86e8, lights: 0xffb35c, seed: 1.7 }, radius: 62, tilt: [0.32, 2.2, 0.18] },
  crible: { name: "CRIBLE", paint: paintCrible, look: { atmo: 0xe9a07e, lights: 0xffa35a, seed: 7.3 }, radius: 50, tilt: [0.2, 0.7, -0.1] },
};

export const planetRadius = (key: ProjectKey) => SPECS[key].radius;
export const planetName = (key: ProjectKey) => SPECS[key].name;

/** le soleil : devant le vaisseau, un peu à gauche et au-dessus de l'horizon (dans le hublot) */
const SUN_AZ = THREE.MathUtils.degToRad(-10), SUN_EL = THREE.MathUtils.degToRad(9), SUN_DIST = 520, SUN_RADIUS = 36;
export const SUN_POS = new THREE.Vector3(Math.sin(SUN_AZ) * Math.cos(SUN_EL), Math.sin(SUN_EL), -Math.cos(SUN_AZ) * Math.cos(SUN_EL)).multiplyScalar(SUN_DIST);
/** le plan de chaque orbite : un axe horizontal, un autre incliné (peu de hauteur, beaucoup de profondeur) */
const ORBIT_U = new THREE.Vector3(1, 0, 0), ORBIT_W = new THREE.Vector3(0, 0.22, -0.975).normalize();
export const ORBIT_TILT = Math.atan2(0.22, 0.975);

/** l'orbite d'un projet : de plus en plus large, de plus en plus lente, déphasée */
export function orbitOf(key: ProjectKey) {
  const i = Math.max(0, PROJECTS.findIndex((p) => p.key === key));
  // phases de départ : de part et d'autre du soleil, côté éloigné (éclairées de face)
  return { r: 105 + 60 * i, periode: 150 + 110 * i, phase: 2.55 - 2.1 * i };
}
const orbitPoint = (r: number, phase: number, out: THREE.Vector3) =>
  out.copy(SUN_POS).addScaledVector(ORBIT_U, r * Math.cos(phase)).addScaledVector(ORBIT_W, r * Math.sin(phase));
/** vitesse de rotation propre des planètes, la même dans le ciel et sur la maquette (rad/s) */
export const SPIN = 0.14;

/** la surface d'une planète à une taille donnée : le même peintre, à l'échelle */
function paintedMap(ctx: Ctx, key: ProjectKey, w: number, h: number) {
  const spec = SPECS[key];
  return ctx.tex.canvas(w, h, (g) => { g.scale(w / 4096, h / 2048); spec.paint(g, 4096, 2048); });
}
const skyMaps = new Map<ProjectKey, THREE.CanvasTexture>();
/** la carte légère d'une planète, partagée par le ciel et la miniature de la maquette */
export function skyMap(ctx: Ctx, key: ProjectKey) {
  let t = skyMaps.get(key);
  if (!t) { t = paintedMap(ctx, key, 1024, 512); skyMaps.set(key, t); }
  return t;
}

function makePlanet(space: THREE.Group, ctx: Ctx, key: ProjectKey): Planet {
  const spec = SPECS[key], o = orbitOf(key), map = skyMap(ctx, key);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), surfaceMaterial(map, spec.look));
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1.035, 96, 64), atmosphereMaterial(spec.look));
  shell.raycast = () => {};       // la couronne ne bloque pas les clics sur la planète
  mesh.add(shell);
  const home = orbitPoint(o.r, o.phase, new THREE.Vector3());
  mesh.position.copy(home);
  mesh.scale.setScalar(spec.radius);
  mesh.rotation.set(...spec.tilt);
  mesh.userData.planet = key;
  space.add(mesh);
  return {
    key, name: spec.name, mesh, shell, map, detail: null, home, frozen: false,
    orbitR: o.r, phase: o.phase, omega: (Math.PI * 2) / o.periode,
    approach: new THREE.Vector3(), qAlign: new THREE.Quaternion(), approachLocal: new THREE.Vector3(), radius: spec.radius,
  };
}

/** le soleil : un disque blanc chaud et sa couronne */
function makeSun() {
  const g = new THREE.Group();
  g.position.copy(SUN_POS);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(SUN_RADIUS, 48, 32), new THREE.MeshBasicMaterial({ color: 0xfff0cf, toneMapped: false })));
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d")!, grad = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(255,244,215,1)"); grad.addColorStop(0.14, "rgba(255,222,160,.9)");
  grad.addColorStop(0.3, "rgba(255,185,105,.42)"); grad.addColorStop(0.6, "rgba(255,150,70,.12)"); grad.addColorStop(1, "rgba(255,140,60,0)");
  x.fillStyle = grad; x.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  halo.scale.setScalar(SUN_RADIUS * 11);
  g.add(halo);
  return g;
}

export function buildSpace(ctx: Ctx) {
  const space = new THREE.Group();
  ctx.scene.add(space);
  space.add(buildStars());
  space.add(makeSun());
  ctx.space = space;
  ctx.planets = {};
  for (const p of PROJECTS) ctx.planets[p.key] = makePlanet(space, ctx, p.key);
  ctx.planet = (key) => ctx.planets[key]!;

  /** à chaque image : les planètes avancent sur leur orbite (sauf celle qu'on visite) */
  ctx.systemUpdate = (dt) => {
    for (const p of Object.values(ctx.planets)) {
      if (p.frozen) continue;
      p.phase += p.omega * dt;
      orbitPoint(p.orbitR, p.phase, p.home);
    }
  };
  /** on part vers une planète : elle s'arrête, et on calcule le virage et l'approche depuis sa place */
  ctx.freezePlanet = (key) => {
    const p = ctx.planets[key]!;
    p.frozen = true;
    // à l'arrivée, la planète est au centre du hublot, à une distance qui lui donne la même taille apparente
    p.approach.set(0.04, 0.12, -1).normalize().multiplyScalar(52 * p.radius / 21);
    p.qAlign.setFromUnitVectors(p.home.clone().normalize(), p.approach.clone().normalize());
    p.approachLocal.copy(p.approach).applyQuaternion(p.qAlign.clone().invert());
  };
  ctx.releasePlanet = (key) => { ctx.planets[key]!.frozen = false; };

  /** la carte détaillée : fabriquée quand on s'approche, libérée au retour */
  ctx.detailPlanet = (key) => {
    const p = ctx.planets[key]!;
    if (p.detail) return;
    p.detail = paintedMap(ctx, key, 4096, 2048);
    ctx.renderer.initTexture(p.detail);            // l'envoi à la carte graphique se fait ici, pas à l'affichage
    p.mesh.material.uniforms.map.value = p.detail;
  };
  ctx.lightPlanet = (key) => {
    const p = ctx.planets[key]!;
    if (!p.detail) return;
    p.mesh.material.uniforms.map.value = p.map;
    p.detail.dispose(); p.detail = null;
  };
}
