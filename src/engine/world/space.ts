import * as THREE from "three";
import type { Ctx, Planet } from "../types";
import type { ProjectKey } from "../../content/profile";
import { seeded } from "../util/textures";
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

/* Nexus : une sphère de papier à grands carreaux, sur laquelle un graphe est tracé
   à l'encre — la page de l'application, enroulée en planète. */
const INK = { paper: "#fdfdfb", ink: "#1b3a6b", red: "#c62b22", blue: "#2a51a3", green: "#19683d" };

function nexusGraph(W: number, H: number) {
  const rnd = seeded(11);
  const nodes: { x: number; y: number }[] = [];
  while (nodes.length < 34) {
    const n = { x: 120 + rnd() * (W - 240), y: H * 0.22 + rnd() * H * 0.56 };
    if (nodes.every((m) => Math.hypot(m.x - n.x, m.y - n.y) > 230)) nodes.push(n);
  }
  // chaque sommet est relié à ses deux plus proches voisins
  const edges: [number, number][] = [], seen = new Set<string>();
  nodes.forEach((a, i) => {
    nodes.map((b, j) => [j, Math.hypot(b.x - a.x, b.y - a.y)] as const).filter(([j]) => j !== i)
      .sort((p, q) => p[1] - q[1]).slice(0, 2).forEach(([j]) => {
        const key = Math.min(i, j) + "-" + Math.max(i, j);
        if (!seen.has(key)) { seen.add(key); edges.push([i, j]); }
      });
  });
  return { nodes, edges };
}

function paintNexus(g: CanvasRenderingContext2D, W: number, H: number) {
  const { nodes, edges } = nexusGraph(W, H);
  g.fillStyle = "#f1ede2"; g.fillRect(0, 0, W, H);
  const fine = 18;
  for (let y = 0; y <= H; y += fine) {
    const b = Math.round(y / fine) % 4 === 0;
    g.fillStyle = b ? "rgba(128,152,216,.85)" : "rgba(186,201,236,.7)";
    g.fillRect(0, y, W, b ? 3 : 1.5);
  }
  for (let x = 0; x <= W; x += fine * 4) { g.fillStyle = "rgba(186,201,236,.75)"; g.fillRect(x, 0, 1.5, H); }
  g.fillStyle = "rgba(198,43,34,.6)"; g.fillRect(W * 0.62, 0, 5, H);    // le filet de marge
  g.lineCap = "round";
  for (const [i, j] of edges) {
    g.strokeStyle = "rgba(27,58,107,.9)"; g.lineWidth = 9;
    g.beginPath(); g.moveTo(nodes[i].x, nodes[i].y); g.lineTo(nodes[j].x, nodes[j].y); g.stroke();
  }
  const inks = [INK.red, INK.blue, INK.green, INK.paper, INK.blue, INK.green];
  nodes.forEach((n, i) => {
    const fill = inks[i % inks.length];
    g.fillStyle = fill; g.strokeStyle = INK.ink; g.lineWidth = 8;
    g.beginPath(); g.arc(n.x, n.y, 34, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = fill === INK.paper ? INK.ink : INK.paper;
    g.font = '600 40px "IBM Plex Mono"'; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(String.fromCharCode(65 + (i % 26)), n.x, n.y + 2);
  });
}

/* Crible : un tableau de données enroulé autour de la planète. Des colonnes de
   largeurs inégales, des lignes régulières, quelques valeurs ; et, çà et là, une
   cellule vermillon : ce que l'outil retrouve. */
function paintCrible(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = "#f6f1ec"; g.fillRect(0, 0, W, H);
  const rnd = seeded(23);
  const cols: [number, number][] = [];
  for (let x = 0; x < W;) { const w = 300 + Math.floor(rnd() * 300); cols.push([x, Math.min(w, W - x)]); x += w; }
  const y0 = 260, rowH = 128, rows = Math.floor((H - 2 * y0) / rowH);
  g.textBaseline = "middle";
  for (let r = 0; r < rows; r++) {
    const y = y0 + r * rowH;
    cols.forEach(([x, w], ci) => {
      if (r === 0) {
        g.fillStyle = "#1c1412"; g.fillRect(x, y, w, rowH);
        g.fillStyle = "#f6f1ec"; g.font = '600 52px "IBM Plex Mono"';
        g.fillText(`col_${String(ci + 1).padStart(2, "0")}`, x + 26, y + rowH / 2);
        return;
      }
      const roll = rnd();
      if (roll < 0.1) {
        g.fillStyle = "#e8432a"; g.fillRect(x, y, w, rowH);
        g.fillStyle = "#fff"; g.font = '600 54px "IBM Plex Mono"';
        g.fillText(rnd() < 0.5 ? "n/a" : String(-Math.floor(rnd() * 90)), x + 26, y + rowH / 2);
      } else if (roll < 0.22) {
        g.fillStyle = "#c9e2c4"; g.fillRect(x, y, w, rowH);
      } else if (roll < 0.66) {
        g.fillStyle = "rgba(28,20,18,.8)"; g.font = '400 54px "IBM Plex Mono"';
        g.fillText((rnd() * (rnd() < 0.5 ? 100 : 9999)).toFixed(rnd() < 0.5 ? 0 : 2), x + 26, y + rowH / 2);
      }
    });
  }
  g.strokeStyle = "rgba(28,20,18,.7)"; g.lineWidth = 5;
  for (let r = 0; r <= rows; r++) { g.beginPath(); g.moveTo(0, y0 + r * rowH); g.lineTo(W, y0 + r * rowH); g.stroke(); }
  cols.forEach(([x]) => { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + rows * rowH); g.stroke(); });
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

function makePlanet(space: THREE.Group, key: ProjectKey, name: string, map: THREE.Texture, look: Look,
  dir: THREE.Vector3, dist: number, radius: number, rot: [number, number, number]): Planet {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 120), surfaceMaterial(map, look));
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1.035, 96, 64), atmosphereMaterial(look));
  shell.raycast = () => {};       // la couronne ne bloque pas les clics sur la planète
  mesh.add(shell);
  const home = dir.clone().normalize().multiplyScalar(dist);
  mesh.position.copy(home);
  mesh.scale.setScalar(radius);
  mesh.rotation.set(...rot);
  mesh.userData.planet = key;
  space.add(mesh);
  // à l'arrivée, la planète est au centre du hublot, à une distance qui lui donne la même taille apparente
  const approach = new THREE.Vector3(0.04, 0.12, -1).normalize().multiplyScalar(52 * radius / 21);
  const qAlign = new THREE.Quaternion().setFromUnitVectors(home.clone().normalize(), approach.clone().normalize());
  const approachLocal = approach.clone().applyQuaternion(qAlign.clone().invert());
  return { key, name, mesh, shell, home, approach, qAlign, approachLocal, radius };
}

export function buildSpace(ctx: Ctx) {
  const space = new THREE.Group();
  ctx.scene.add(space);
  space.add(buildStars());
  const nexusTexture = ctx.tex.canvas(4096, 2048, paintNexus);
  const cribleTexture = ctx.tex.canvas(4096, 2048, paintCrible);
  ctx.space = space;
  ctx.nexusTexture = nexusTexture;
  ctx.planets = {
    // atmosphère : violet de Nexus (#6B2BD9) éclairci par la diffusion ; Crible, une poussière
    // chaude tirée de son vermillon (#E8432A), comme le ciel de Mars. Lumières de nuit : sodium.
    nexus: makePlanet(space, "nexus", "NEXUS", nexusTexture, { atmo: 0x9a86e8, lights: 0xffb35c, seed: 1.7 },
      new THREE.Vector3(0.3, 0.19, -1), 160, 21, [0.32, 2.2, 0.18]),
    crible: makePlanet(space, "crible", "CRIBLE", cribleTexture, { atmo: 0xe9a07e, lights: 0xffa35a, seed: 7.3 },
      new THREE.Vector3(-0.34, 0.2, -1), 130, 14, [0.2, 0.7, -0.1]),
  };
}
