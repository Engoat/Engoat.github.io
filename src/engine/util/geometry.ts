import * as THREE from "three";

export const shadowy = <T extends THREE.Object3D>(m: T): T => { m.castShadow = true; m.receiveShadow = true; return m; };

/* Une boîte a six groupes de faces (un par côté) : on n'en garde que deux, la face
   avant et tout le reste, soit deux appels de dessin au lieu de six. */
export function twoGroups(geo: THREE.BufferGeometry, front: number) {
  const rest: number[] = [], face: number[] = [];
  // sans index (cas de RoundedBoxGeometry), les groupes désignent des plages de sommets
  const index = geo.index;
  const at = index ? (i: number) => index.getX(i) : (i: number) => i;
  for (const g of geo.groups) {
    for (let i = g.start; i < g.start + g.count; i++) (g.materialIndex === front ? face : rest).push(at(i));
  }
  geo.setIndex([...rest, ...face]);
  geo.clearGroups();
  geo.addGroup(0, rest.length, 0);
  geo.addGroup(rest.length, face.length, 1);
  return geo;
}

export function roundedRect(w: number, h: number, r: number, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function boltRing(parent: THREE.Object3D, pts: THREE.Vector2[], r: number, depth: number, z: number, material: THREE.Material) {
  const g = new THREE.CylinderGeometry(r, r * 1.05, depth, 12);
  g.rotateX(Math.PI / 2);
  for (const p of pts) {
    const b = new THREE.Mesh(g, material);
    b.position.set(p.x, p.y, z);
    parent.add(b);
  }
}
