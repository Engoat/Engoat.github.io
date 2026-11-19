import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { Ctx, Hand, Pose, PoseName, RestPose } from "../types";
import { mat, seeded } from "../util/textures";
import { shadowy } from "../util/geometry";
import { ease } from "../util/tween";
import { PERSON } from "../../content/profile";

const FINGERS = ["index", "middle", "ring", "pinky"];
const AX = new THREE.Vector3(1, 0, 0);
const UPY = new THREE.Vector3(0, 1, 0);
const tq = new THREE.Quaternion();

export const POSES: Record<PoseName, Pose> = {
  grip: { curl: [1.05, 1.15, 1.22, 1.3], thumb: 0.5 },
  point: { curl: [0.42, 1.45, 1.55, 1.6], thumb: 0.9 },
  relaxed: { curl: [0.45, 0.55, 0.62, 0.7], thumb: 0.25 },
};

/* poses de repos : main droite sur le manche, main gauche sur les gaz ; en portrait
   le champ horizontal est étroit, les mains se posent sur le rebord du pupitre */
export const REST: Record<"right" | "left", RestPose> = {
  right: { pos: new THREE.Vector3(0.425, -0.335, -0.455), rot: new THREE.Euler(-0.62, 0.12, 0.08, "YXZ"), pose: "grip" },
  left: { pos: new THREE.Vector3(-0.42, -0.36, -0.43), rot: new THREE.Euler(-0.55, -0.1, -0.06, "YXZ"), pose: "grip" },
};
const REST_WIDE = { right: REST.right.pos.clone(), left: REST.left.pos.clone() };
const REST_TALL = { right: new THREE.Vector3(0.19, -0.43, -0.5), left: new THREE.Vector3(-0.19, -0.43, -0.5) };

export function setPose(h: Hand, curls: number[], thumb: number) {
  h.curl = curls.slice(); h.thumb = thumb;
  FINGERS.forEach((f, i) => {
    for (const [part, k] of [["phalanx-proximal", 1], ["phalanx-intermediate", 0.95], ["phalanx-distal", 0.65]] as const) {
      const n = `${f}-finger-${part}`;
      h.bones[n].quaternion.copy(h.rest[n]).multiply(tq.setFromAxisAngle(AX, -curls[i] * k));
    }
  });
  for (const [n, k] of [["thumb-phalanx-proximal", 0.55], ["thumb-phalanx-distal", 0.8]] as const) {
    h.bones[n].quaternion.copy(h.rest[n]).multiply(tq.setFromAxisAngle(AX, -thumb * k));
  }
}

export function buildHands(ctx: Ctx, gltfRight: GLTF, gltfLeft: GLTF) {
  const { tex, scene } = ctx;
  // gant de cuir souple : grain fin en relief, reflet satiné du cuir patiné
  const grain = tex.canvas(512, 512, (g, W, H) => {
    g.fillStyle = "#808080"; g.fillRect(0, 0, W, H);
    const rnd = seeded(7);
    for (let i = 0; i < 14000; i++) {
      const v = 90 + rnd() * 80;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.beginPath(); g.arc(rnd() * W, rnd() * H, 1 + rnd() * 2.2, 0, Math.PI * 2); g.fill();
    }
  }, false);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.repeat.set(5, 5);
  const gloveMat = new THREE.MeshPhysicalMaterial({
    color: 0x25221f, roughness: 0.58, bumpMap: grain, bumpScale: 0.6,
    sheen: 0.6, sheenColor: new THREE.Color(0x5a524a), sheenRoughness: 0.55,
  });
  // combinaison orange de vol : un tissu épais, plissé, à trame visible, pas un tube lisse
  const fabric = tex.canvas(512, 512, (g, W, H) => {
    g.fillStyle = "#808080"; g.fillRect(0, 0, W, H);
    // trame du tissu
    for (let y = 0; y < H; y += 3) { g.fillStyle = y % 6 ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.07)"; g.fillRect(0, y, W, 1.5); }
    for (let x = 0; x < W; x += 3) { g.fillStyle = x % 6 ? "rgba(0,0,0,.05)" : "rgba(255,255,255,.05)"; g.fillRect(x, 0, 1.5, H); }
    const rnd = seeded(3);
    for (let i = 0; i < 26; i++) {
      const y = rnd() * H, amp = 18 + rnd() * 30, w = 10 + rnd() * 26;
      const grd = g.createLinearGradient(0, y - w, 0, y + w);
      grd.addColorStop(0, "rgba(128,128,128,0)"); grd.addColorStop(0.45, "rgba(230,230,230,.55)");
      grd.addColorStop(0.55, "rgba(40,40,40,.55)"); grd.addColorStop(1, "rgba(128,128,128,0)");
      g.fillStyle = grd;
      g.beginPath(); g.moveTo(0, y - w);
      for (let x = 0; x <= W; x += 16) g.lineTo(x, y - w + Math.sin(x / W * Math.PI * 2 + i) * amp * 0.3);
      for (let x = W; x >= 0; x -= 16) g.lineTo(x, y + w + Math.sin(x / W * Math.PI * 2 + i) * amp * 0.3);
      g.fill();
    }
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},.05)`;
      g.fillRect(rnd() * W, rnd() * H, 2, 2);
    }
  }, false);
  fabric.wrapS = fabric.wrapT = THREE.RepeatWrapping;
  const sleeveMat = new THREE.MeshPhysicalMaterial({
    color: 0xc4531c, roughness: 0.92, side: THREE.DoubleSide, bumpMap: fabric, bumpScale: 3,
    sheen: 1, sheenColor: new THREE.Color(0xf0a070), sheenRoughness: 0.7,      // le duvet du tissu au bord de la lumière
  });
  // profil le long de la manche : légère conicité et bourrelets de tissu
  const sleeveGeo = (r0: number, r1: number) => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 40; i++) {
      const v = i / 40;
      const r = (r0 + (r1 - r0) * v) * (1 + 0.04 * Math.sin(v * 31) + 0.025 * Math.sin(v * 67 + 1.3));
      pts.push(new THREE.Vector2(r, v - 0.5));
    }
    return new THREE.LatheGeometry(pts, 32);
  };
  // poignet : le gant monte en gantelet évasé sur la manche ; la bague de verrouillage est
  // un anneau plein d'aluminium anodisé, comme sur les combinaisons Sokol
  const gauntletGeo = (() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const v = i / 12;
      pts.push(new THREE.Vector2(0.036 + 0.012 * v * v + 0.0015 * Math.sin(v * 9), v - 0.5));
    }
    return new THREE.LatheGeometry(pts, 32).scale(1, 0.06, 1);
  })();
  const ringGeo = new THREE.TorusGeometry(0.05, 0.0065, 12, 48).rotateX(Math.PI / 2);
  const ringMat = mat(0x4f6c9a, 0.32, 0.85);

  function makeHand(gltf: GLTF, side: 1 | -1): Hand {
    const model = gltf.scene;
    const bones: Record<string, THREE.Bone> = {};
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones[o.name] = o as THREE.Bone;
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.material = gloveMat; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }
    });
    model.updateMatrixWorld(true);
    // le modèle livre ses os à plat sous l'armature : on les rechaîne pour qu'une
    // phalange qui plie entraîne la suivante (attach garde la pose)
    const chains = [
      ["thumb-metacarpal", "thumb-phalanx-proximal", "thumb-phalanx-distal", "thumb-tip"],
      ...FINGERS.map((f) => ["metacarpal", "phalanx-proximal", "phalanx-intermediate", "phalanx-distal", "tip"].map((p) => `${f}-finger-${p}`)),
    ];
    for (const chain of chains) {
      let parent: THREE.Object3D = bones.wrist;
      for (const n of chain) { parent.attach(bones[n]); parent = bones[n]; }
    }
    model.updateMatrixWorld(true);
    const P = (n: string) => bones[n].getWorldPosition(new THREE.Vector3());
    const wrist = P("wrist");

    // repère calculé sur les os : -Z vers les doigts, +Y côté dos de la main
    const Z = P("middle-finger-phalanx-proximal").sub(wrist).normalize().negate();
    const across = P("pinky-finger-phalanx-proximal").sub(P("index-finger-phalanx-proximal"));
    if (side < 0) across.negate();
    const X = across.addScaledVector(Z, -across.dot(Z)).normalize();
    const Y = new THREE.Vector3().crossVectors(Z, X);

    const rig = new THREE.Group();
    const orient = new THREE.Group();
    orient.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)).invert();
    rig.add(orient); orient.add(model);
    model.position.copy(wrist).negate();
    scene.add(rig);

    const rest: Record<string, THREE.Quaternion> = {};
    for (const [n, b] of Object.entries(bones)) rest[n] = b.quaternion.clone();

    const forearm = shadowy(new THREE.Mesh(sleeveGeo(0.04, 0.058), sleeveMat));
    const upper = shadowy(new THREE.Mesh(sleeveGeo(0.072, 0.064), sleeveMat));
    const elbowBall = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.062, 20, 14), sleeveMat));
    const gauntletMat = gloveMat.clone();
    gauntletMat.side = THREE.DoubleSide;
    const cuff = shadowy(new THREE.Mesh(gauntletGeo, gauntletMat));
    const ring = shadowy(new THREE.Mesh(ringGeo, ringMat));
    scene.add(forearm, upper, elbowBall, cuff, ring);

    // bande nominative brodée sur la manche gauche, comme sur les combinaisons
    let tape: THREE.Mesh | null = null;
    if (side < 0) {
      const t = tex.canvas(512, 140, (g, W, H) => {
        g.fillStyle = "#1b2a44"; g.fillRect(0, 0, W, H);
        g.strokeStyle = "#d8ad18"; g.lineWidth = 8; g.strokeRect(6, 6, W - 12, H - 12);
        g.fillStyle = "#f1ede2"; g.font = '700 82px "Barlow Condensed"'; g.textAlign = "center"; g.textBaseline = "middle";
        g.letterSpacing = "10px"; g.fillText(PERSON.name.toUpperCase(), W / 2 + 5, H / 2 + 4);
      });
      tape = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.027), mat(0xffffff, 0.9, 0, { map: t }));
      tape.receiveShadow = true;
      scene.add(tape);
    }
    return { side, rig, bones, rest, forearm, upper, elbowBall, cuff, ring, tape,
      curl: [0, 0, 0, 0], thumb: 0, shoulder: new THREE.Vector3(side * 0.24, -0.3, 0.06) };
  }

  ctx.hands = { right: makeHand(gltfRight, 1), left: makeHand(gltfLeft, -1) };
  placeHandsAtRest(ctx);
}

export function placeHandsAtRest(ctx: Ctx) {
  const tall = innerWidth / innerHeight < 1;
  for (const k of ["right", "left"] as const) {
    const h = ctx.hands[k], r = REST[k];
    r.pos.copy(tall ? REST_TALL[k] : REST_WIDE[k]);
    r.pose = tall ? "relaxed" : "grip";
    h.rig.position.copy(r.pos);
    h.rig.quaternion.setFromEuler(r.rot);
    setPose(h, POSES[r.pose].curl, POSES[r.pose].thumb);
  }
}

/* avant-bras et bras de la combinaison, recalculés à chaque image depuis le poignet
   jusqu'à l'épaule, en passant par un coude placé naturellement */
const _a = new THREE.Vector3(), _q = new THREE.Quaternion(), _pole = new THREE.Vector3();
const UPPER = 0.33, FORE = 0.31;
function limb(mesh: THREE.Mesh, p0: THREE.Vector3, p1: THREE.Vector3, extra = 0) {
  mesh.position.copy(p0).add(p1).multiplyScalar(0.5);
  mesh.scale.set(1, p0.distanceTo(p1) + extra, 1);
  mesh.quaternion.setFromUnitVectors(UPY, _a.copy(p0).sub(p1).normalize());
}
export function updateArm(h: Hand) {
  const wq = h.rig.getWorldQuaternion(_q);
  const w = h.rig.getWorldPosition(new THREE.Vector3());
  const back = new THREE.Vector3(0, 0, 1).applyQuaternion(wq);
  const cuffEnd = w.clone().addScaledVector(back, 0.058);

  // coude par IK à deux segments : bras et avant-bras de longueur fixe, le coude
  // tombe vers le bas et vers l'extérieur comme un vrai bras
  const S = h.shoulder, toW = cuffEnd.clone().sub(S);
  const d = Math.min(toW.length(), UPPER + FORE - 0.001);
  const dir = toW.clone().normalize();
  const a = (UPPER * UPPER - FORE * FORE + d * d) / (2 * d);
  const hgt = Math.sqrt(Math.max(UPPER * UPPER - a * a, 0));
  _pole.set(h.side * 1.0, -0.55, 0.25);
  _pole.addScaledVector(dir, -_pole.dot(dir)).normalize();
  const elbow = S.clone().addScaledVector(dir, a).addScaledVector(_pole, hgt);

  limb(h.forearm, elbow, cuffEnd, 0.03);
  limb(h.upper, S, elbow, 0.02);
  h.elbowBall.position.copy(elbow);
  h.cuff.position.copy(w).addScaledVector(back, 0.026);
  h.cuff.quaternion.setFromUnitVectors(UPY, back);
  h.ring.position.copy(w).addScaledVector(back, 0.054);
  h.ring.quaternion.setFromUnitVectors(UPY, back);

  if (h.tape) {
    // posée sur le dessus de l'avant-bras, près du poignet, et lisible dans le sens du bras
    const axis = cuffEnd.clone().sub(elbow).normalize();
    const up = new THREE.Vector3(0, 1, 0).addScaledVector(axis, -axis.y).normalize();
    up.applyAxisAngle(axis, -h.side * 0.5);
    const at = elbow.clone().lerp(cuffEnd, 0.8);
    h.tape.position.copy(at).addScaledVector(up, 0.0475);
    const yv = new THREE.Vector3().crossVectors(up, axis);
    h.tape.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(axis, yv, up));
  }
}

/** déplace la main (position, orientation, doigts) en dur secondes */
export function moveHand(ctx: Ctx, h: Hand, toPos: THREE.Vector3, toQ: THREE.Quaternion, toPose: Pose, dur: number) {
  const p0 = h.rig.position.clone(), q0 = h.rig.quaternion.clone(), c0 = h.curl.slice(), t0 = h.thumb;
  return ctx.anim.tween(dur, (k) => {
    const e = ease(k);
    h.rig.position.lerpVectors(p0, toPos, e);
    h.rig.quaternion.slerpQuaternions(q0, toQ, e);
    setPose(h, c0.map((c, i) => c + (toPose.curl[i] - c) * e), t0 + (toPose.thumb - t0) * e);
  });
}
