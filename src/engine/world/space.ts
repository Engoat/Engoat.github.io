import * as THREE from "three";
import type { Ctx, Planet } from "../types";
import type { ProjectKey } from "../../content/profile";
import { paintCrible, paintNexus } from "./painters";
import { GLSL_NOISE } from "./noise.glsl";

/** soleil des planètes, venu de la gauche : on les voit à moitié éclairées (premier quartier) */
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

/* Les planètes se fabriquent à la demande : une carte de 4096 × 2048 pèse 32 Mo, et le
   portfolio peut compter beaucoup de projets. La planète choisie est seule dans le hublot ;
   celles qui s'en éloignent sont libérées (voir actions/nav.ts). */
interface PlanetSpec { name: string; paint: (g: CanvasRenderingContext2D, W: number, H: number) => void; look: Look; radius: number; tilt: [number, number, number] }

// atmosphère de Nexus : violet de l'arbre (#6B2BD9) éclairci par la diffusion ; Crible : une poussière
// chaude tirée de son vermillon (#E8432A), comme le ciel de Mars.
// Lumières de nuit : sodium (l'encre colorée de Nexus et de Crible).
const SPECS: Record<ProjectKey, PlanetSpec> = {
  nexus: { name: "NEXUS", paint: paintNexus, look: { atmo: 0x9a86e8, lights: 0xffb35c, seed: 1.7 }, radius: 24, tilt: [0.32, 2.2, 0.18] },
  crible: { name: "CRIBLE", paint: paintCrible, look: { atmo: 0xe9a07e, lights: 0xffa35a, seed: 7.3 }, radius: 19, tilt: [0.2, 0.7, -0.1] },
};

/** là où se pose la planète choisie : à droite du centre du hublot */
const STAGE_DIR = new THREE.Vector3(0.22, 0.19, -1), STAGE_DIST = 150;

function makePlanet(space: THREE.Group, key: ProjectKey, spec: PlanetSpec, map: THREE.CanvasTexture): Planet {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 120), surfaceMaterial(map, spec.look));
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1.035, 96, 64), atmosphereMaterial(spec.look));
  shell.raycast = () => {};       // la couronne ne bloque pas les clics sur la planète
  mesh.add(shell);
  const home = STAGE_DIR.clone().normalize().multiplyScalar(STAGE_DIST);
  mesh.position.copy(home);
  mesh.scale.setScalar(spec.radius);
  mesh.rotation.set(...spec.tilt);
  mesh.userData.planet = key;
  mesh.visible = false;
  space.add(mesh);
  // à l'arrivée, la planète est au centre du hublot, à une distance qui lui donne la même taille apparente
  const approach = new THREE.Vector3(0.04, 0.12, -1).normalize().multiplyScalar(52 * spec.radius / 21);
  const qAlign = new THREE.Quaternion().setFromUnitVectors(home.clone().normalize(), approach.clone().normalize());
  const approachLocal = approach.clone().applyQuaternion(qAlign.clone().invert());
  return { key, name: spec.name, mesh, shell, map, offset: new THREE.Vector3(), home, approach, qAlign, approachLocal, radius: spec.radius };
}

export function buildSpace(ctx: Ctx) {
  const space = new THREE.Group();
  ctx.scene.add(space);
  space.add(buildStars());
  ctx.space = space;
  ctx.planets = {};
  ctx.planet = (key) => {
    const known = ctx.planets[key];
    if (known) return known;
    const spec = SPECS[key];
    const map = ctx.tex.canvas(4096, 2048, spec.paint);
    ctx.renderer.initTexture(map);          // l'envoi à la carte graphique se fait ici, pas à l'affichage
    return (ctx.planets[key] = makePlanet(space, key, spec, map));
  };
  ctx.releasePlanet = (key) => {
    const p = ctx.planets[key];
    if (!p) return;
    space.remove(p.mesh);
    for (const m of [p.mesh, p.shell]) { m.geometry.dispose(); m.material.dispose(); }
    p.map.dispose();
    delete ctx.planets[key];
  };
}
