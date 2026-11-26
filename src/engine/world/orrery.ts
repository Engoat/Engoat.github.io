import * as THREE from "three";
import { PROJECTS, type ProjectKey } from "../../content/profile";
import type { Ctx } from "../types";
import { mat } from "../util/textures";
import { shadowy } from "../util/geometry";
import { ORBIT_TILT, SPIN, planetName, planetRadius, skyMap } from "./space";

/* La maquette : un planétaire qui sort de l'intérieur de la planche quand on appuie sur le
   gros bouton. Deux volets glissent, un mât chromé monte avec ses anneaux d'orbite, et des
   bras portent une miniature par projet, peinte comme sa planète. C'est une réduction du vrai
   ciel : au centre le soleil, chaque miniature sur la même orbite, à la même phase que la
   planète du hublot, et qui tourne sur elle-même de la même façon.
   Tout ce qui bouge a ses propres matières (pas celles de la palette) : ces pièces ne sont
   pas cuites dans Blender avec le reste de la planche. */

/** la baie, dans le repère de la planche */
export const BAY = { x: 0, y: 0.045, z: 0.03, r: 0.098 };
/** hauteur du plan des planètes au-dessus de la planche, et profondeur d'où elles montent */
const HAUT = 0.15, PROFOND = 0.26;
/** réduction : rayon d'orbite de la maquette (m) pour un rayon d'orbite du ciel */
const ECHELLE = 0.00085;

export interface Mini { key: ProjectKey; group: THREE.Group; hit: THREE.Mesh; sphere: THREE.Mesh; label: THREE.Mesh; arm: THREE.Mesh }

export function buildOrrery(ctx: Ctx) {
  const root = new THREE.Group();
  root.position.set(BAY.x, BAY.y, BAY.z);
  ctx.panel.add(root);

  const chrome = mat(0xd8dadc, 0.2, 1);
  const dark = mat(0x121212, 0.55, 0.3);
  const paint = mat(0x6a918b, 0.6);

  // la baie : un disque noir cerclé de chrome
  const bay = new THREE.Mesh(new THREE.CircleGeometry(BAY.r, 64), dark);
  bay.position.z = 0.0006; bay.receiveShadow = true;
  root.add(bay);
  const ring = shadowy(new THREE.Mesh(new THREE.TorusGeometry(BAY.r + 0.003, 0.0045, 12, 72), chrome));
  ring.position.z = 0.002;
  root.add(ring);

  // les deux volets, qui glissent de part et d'autre puis s'enfoncent sous la planche
  const R = BAY.r + 0.0015;
  const half = (side: -1 | 1) => {
    const geo = new THREE.CylinderGeometry(R, R, 0.004, 48, 1, false, side === 1 ? 0 : Math.PI, Math.PI);
    geo.rotateX(Math.PI / 2);
    const m = shadowy(new THREE.Mesh(geo, paint));
    m.position.z = 0.004;
    root.add(m);
    return m;
  };
  const shutters = [half(-1), half(1)];

  /* ce qui monte : le mât, le soleil, les pistes d'orbite et les miniatures */
  const rise = new THREE.Group();
  rise.visible = false;
  root.add(rise);

  /** un cylindre dont l'axe est celui de la planche (z), de z0 à z1 */
  const post = (r: number, z0: number, z1: number, m: THREE.Material) => {
    const geo = new THREE.CylinderGeometry(r, r, z1 - z0, 20);
    geo.rotateX(Math.PI / 2);
    const c = shadowy(new THREE.Mesh(geo, m));
    c.position.z = (z0 + z1) / 2;
    return c;
  };

  rise.add(post(0.026, 0, 0.016, dark));
  rise.add(post(0.0048, 0.014, HAUT, chrome));
  // au centre, le soleil (comme celui du hublot : blanc chaud)
  const soleil = new THREE.Mesh(new THREE.SphereGeometry(0.019, 32, 20), new THREE.MeshBasicMaterial({ color: 0xffe4b0, toneMapped: false }));
  soleil.position.z = HAUT;
  rise.add(soleil);

  // le plan des orbites : le même que dans le ciel (peu de hauteur, beaucoup de profondeur)
  const plan = new THREE.Group();
  plan.position.z = HAUT;
  plan.rotation.x = ORBIT_TILT;
  rise.add(plan);

  const minis: Mini[] = [];
  const tige = new THREE.CylinderGeometry(0.0024, 0.0024, 1, 10);
  PROJECTS.forEach((p) => {
    const planet = ctx.planet(p.key), rm = planet.orbitR * ECHELLE, rp = planetRadius(p.key) * 0.00055;
    // la piste de cette orbite
    const piste = shadowy(new THREE.Mesh(new THREE.TorusGeometry(rm, 0.002, 8, 96), chrome));
    plan.add(piste);
    // le bras, du soleil à la miniature (replacé à chaque image)
    const arm = shadowy(new THREE.Mesh(tige, chrome));
    plan.add(arm);

    const group = new THREE.Group();
    plan.add(group);
    const sphere = shadowy(new THREE.Mesh(new THREE.SphereGeometry(rp, 48, 32), new THREE.MeshStandardMaterial({ map: skyMap(ctx, p.key), roughness: 0.7 })));
    const incline = new THREE.Group();
    incline.rotation.z = 0.4;                      // le pôle dans le plan de la maquette, un peu incliné : on voit l'équateur
    group.add(incline);
    incline.add(sphere);
    // l'axe de la miniature, qui dépasse aux deux pôles
    const axe = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, rp * 2.7, 8), chrome);
    axe.castShadow = true;
    incline.add(axe);

    // le nom, gravé sur une petite plaque qui reste tournée vers le pilote
    const label = ctx.tex.placard(planetName(p.key), 0.078, 0.021, { size: 0.7 });
    label.position.set(0, -(rp + 0.026), 0.004);
    group.add(label);

    // zone de clic, plus large que la miniature
    const hit = new THREE.Mesh(new THREE.SphereGeometry(rp + 0.02, 16, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hit.visible = false;
    group.add(hit);
    ctx.buttons["mini_" + p.key] = { key: "mini_" + p.key, kind: "pad", cap: hit };
    hit.userData.button = ctx.buttons["mini_" + p.key];
    minis.push({ key: p.key, group, hit, sphere, label, arm });
  });

  // les pièces qui montent sont coupées au niveau de la planche : elles sortent de l'intérieur
  const plane = new THREE.Plane();
  const nW = new THREE.Vector3(), pW = new THREE.Vector3();
  function placeClip() {
    ctx.panel.updateWorldMatrix(true, false);
    nW.set(0, 0, 1).transformDirection(ctx.panel.matrixWorld);
    pW.set(BAY.x, BAY.y, BAY.z).applyMatrix4(ctx.panel.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(nW, pW);
  }
  placeClip();
  paint.clippingPlanes = [plane]; paint.clipShadows = true;
  const seen = new Set<THREE.Material>();
  rise.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (!m || seen.has(m) || (m as THREE.MeshBasicMaterial).opacity === 0) return;
    seen.add(m);
    m.clippingPlanes = [plane]; m.clipShadows = true;
  });

  const qp = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3();
  /** à chaque image : volets, hauteur du mât, miniatures à la phase des vraies planètes */
  function apply(shutter: number, up: number, dt: number, camera: THREE.Camera) {
    // les volets glissent, puis s'enfoncent sous la planche (coupés au niveau de sa surface)
    const enfonce = THREE.MathUtils.smoothstep(shutter, 0.55, 1);
    shutters[0].position.set(-(R + 0.002) * shutter, 0, 0.004 - 0.014 * enfonce);
    shutters[1].position.set((R + 0.002) * shutter, 0, 0.004 - 0.014 * enfonce);
    rise.visible = up > 0.001;
    rise.position.z = -PROFOND * (1 - up);
    if (!rise.visible) return;
    for (const m of minis) {
      const p = ctx.planet(m.key), r = p.orbitR * ECHELLE;
      // dans le plan de l'orbite : x vers la droite, y vers le fond (comme la profondeur du ciel)
      m.group.position.set(r * Math.cos(p.phase), r * Math.sin(p.phase), 0);
      d.copy(m.group.position);
      m.arm.scale.y = d.length();
      m.arm.position.copy(d).multiplyScalar(0.5);
      m.arm.quaternion.setFromUnitVectors(Y, d.normalize());
      m.sphere.rotation.y += dt * SPIN;
      m.label.parent!.getWorldQuaternion(qp);
      m.label.quaternion.copy(qp.invert()).multiply(camera.quaternion);
    }
  }
  /** les miniatures ne se touchent que quand la maquette est sortie */
  const setPickable = (on: boolean) => { for (const m of minis) m.hit.visible = on; };
  const hover = (key: ProjectKey | null) => { for (const m of minis) m.group.scale.setScalar(m.key === key ? 1.12 : 1); };

  return { root, minis, apply, setPickable, hover, hits: minis.map((m) => m.hit) };
}
export type Orrery = ReturnType<typeof buildOrrery>;
