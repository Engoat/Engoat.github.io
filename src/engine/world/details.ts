import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Ctx } from "../types";
import { roundedRect } from "../util/geometry";

/* Les petites pièces qui font qu'une cabine a l'air construite et non modelée : vis,
   rivets, joint de hublot, poignées, faisceau de câbles. Chaque famille est fusionnée en
   une seule géométrie par matériau (un appel de dessin), et passe ensuite dans Blender
   avec les autres pièces fixes pour recevoir l'usure. */

type Part = THREE.BufferGeometry;
const placed = (g: Part, m: THREE.Matrix4) => g.clone().applyMatrix4(m).toNonIndexed();

function merged(parts: Part[], material: THREE.Material) {
  const geo = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/** vis à tête fraisée, fente comprise, posée sur une face orientée +Z */
function screw(x: number, y: number, z: number, angle: number) {
  const head = new THREE.CylinderGeometry(0.0042, 0.0046, 0.0018, 16).rotateX(Math.PI / 2);
  const slot = new THREE.BoxGeometry(0.0062, 0.0011, 0.0012).rotateZ(angle).translate(0, 0, 0.0008);
  const m = new THREE.Matrix4().makeTranslation(x, y, z);
  return { head: placed(head, m), slot: placed(slot, m) };
}

export function buildDetails(ctx: Ctx) {
  const { M, cockpit, panel } = ctx;
  const rnd = (i: number) => ((Math.sin(i * 91.7) * 43758.5) % 1 + 1) % 1;

  /* vis : coins et milieux de la planche, des ailes ; elles ne sont jamais toutes alignées */
  {
    const heads: Part[] = [], slots: Part[] = [];
    let i = 0;
    const add = (x: number, y: number, z: number) => { const s = screw(x, y, z, rnd(i++) * Math.PI); heads.push(s.head); slots.push(s.slot); };
    for (const x of [-0.425, 0, 0.425]) for (const y of [-0.21, 0.21]) add(x, y, 0.0305);
    panel.add(merged(heads, M.bolt), merged(slots, M.black));
    for (const wing of panel.children.filter((c) => c instanceof THREE.Group && c.children.length && Math.abs(c.position.x) > 0.4)) {
      const side = Math.sign(wing.position.x);
      const wh: Part[] = [], ws: Part[] = [];
      for (const x of [0.03, 0.41]) for (const y of [-0.21, 0.21]) {
        const s = screw(side * x, y, 0.0305, rnd(i++) * Math.PI); wh.push(s.head); ws.push(s.slot);
      }
      wing.add(merged(wh, M.bolt), merged(ws, M.black));
    }
  }

  /* rivets sur les deux arceaux de la coque */
  {
    const parts: Part[] = [];
    const dome = new THREE.SphereGeometry(0.0055, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    for (const z of [-0.25, 0.3]) {
      for (let k = 0; k < 64; k++) {
        const a = (k / 64) * Math.PI * 2;
        const n = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
        const p = n.clone().multiplyScalar(1.0).add(new THREE.Vector3(0, 0.05, z));
        // le dôme du rivet regarde vers l'intérieur de la cabine
        const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().negate()), new THREE.Vector3(1, 1, 1));
        for (const dz of [-0.016, 0.016]) parts.push(placed(dome, new THREE.Matrix4().makeTranslation(0, 0, dz).multiply(m)));
      }
    }
    cockpit.add(merged(parts, M.bolt));
  }

  /* joint de caoutchouc autour de la vitre */
  {
    const W = ctx.window;
    const ring = roundedRect(W.w + 0.016, W.h + 0.016, W.r + 0.008, 0, W.cy);
    ring.holes.push(roundedRect(W.w - 0.004, W.h - 0.004, W.r - 0.002, 0, W.cy));
    const geo = new THREE.ExtrudeGeometry(ring, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 2, curveSegments: 32 });
    const gasket = new THREE.Mesh(geo, M.black);
    gasket.position.z = -1.03;
    gasket.receiveShadow = true;
    cockpit.add(gasket);
  }

  /* poignées de maintien, de part et d'autre du hublot */
  {
    const bars: Part[] = [], feet: Part[] = [];
    for (const side of [-1, 1]) {
      const x = side * 0.79, z = -1.015;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, 0.02, z), new THREE.Vector3(x, 0.04, z + 0.045),
        new THREE.Vector3(x, 0.36, z + 0.045), new THREE.Vector3(x, 0.38, z),
      ]);
      bars.push(new THREE.TubeGeometry(curve, 40, 0.009, 12, false).toNonIndexed());
      for (const y of [0.02, 0.38]) {
        feet.push(new THREE.CylinderGeometry(0.016, 0.018, 0.012, 16).rotateX(Math.PI / 2).translate(x, y, z).toNonIndexed());
      }
    }
    cockpit.add(merged(bars, M.chrome), merged(feet, M.frame));
  }

  /* faisceau de câbles le long de la paroi gauche, tenu par des colliers */
  {
    const cables: Part[] = [], clips: Part[] = [];
    const R = 0.955, z0 = -0.62;
    [0, 1, 2].forEach((c) => {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 10; k++) {
        const a = THREE.MathUtils.degToRad(118 + k * 10);
        const r = R - c * 0.012;
        pts.push(new THREE.Vector3(Math.cos(a) * r, 0.05 + Math.sin(a) * r, z0 + c * 0.014 + Math.sin(k * 1.3 + c) * 0.004));
      }
      cables.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.0055 - c * 0.0008, 8, false).toNonIndexed());
    });
    for (let k = 1; k < 10; k += 2) {
      const a = THREE.MathUtils.degToRad(118 + k * 10);
      const p = new THREE.Vector3(Math.cos(a) * (R - 0.012), 0.05 + Math.sin(a) * (R - 0.012), z0 + 0.014);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, a));
      clips.push(placed(new THREE.BoxGeometry(0.03, 0.012, 0.05), new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1))));
    }
    cockpit.add(merged(cables, M.black), merged(clips, M.frame));
  }
}
