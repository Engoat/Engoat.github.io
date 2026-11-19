import * as THREE from "three";
import type { Button, Ctx, Hand } from "../types";
import { POSES, REST, moveHand, setPose } from "../world/hands";
import { ease } from "../util/tween";

/* L'index vient se poser sur le bouton : on calcule où placer le poignet pour que le
   bout de l'index tombe exactement sur la touche. */
function pressFrame(h: Hand, b: Button) {
  // normale de la face où se trouve la commande (planche ou aile)
  const n = new THREE.Vector3(0, 0, 1).applyQuaternion(b.cap.getWorldQuaternion(new THREE.Quaternion()));
  const target = b.cap.getWorldPosition(new THREE.Vector3()).addScaledVector(n, b.kind ? 0.004 : 0.012);
  const d = n.clone().negate();
  const yawN = Math.atan2(-d.x, -d.z), pitchN = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
  // la main se tourne vers l'intérieur : l'avant-bras arrive de côté, coude écarté,
  // et ne passe pas entre l'œil et la main
  const yaw = yawN + h.side * 0.5 - Math.atan2(target.x - h.shoulder.x, -(target.z - h.shoulder.z)) * 0.4;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitchN + 0.18, yaw, -h.side * 0.12, "YXZ"));
  const saved = { p: h.rig.position.clone(), q: h.rig.quaternion.clone(), c: h.curl.slice(), t: h.thumb };
  h.rig.position.set(0, 0, 0); h.rig.quaternion.copy(q);
  setPose(h, POSES.point.curl, POSES.point.thumb);
  h.rig.updateMatrixWorld(true);
  const tip = h.bones["index-finger-tip"].getWorldPosition(new THREE.Vector3());
  h.rig.position.copy(saved.p); h.rig.quaternion.copy(saved.q); setPose(h, saved.c, saved.t);
  return { q, press: target.clone().sub(tip), hover: target.clone().sub(tip).addScaledVector(n, 0.06) };
}

/** la main la plus proche appuie sur la commande, puis retourne à sa pose de repos */
export async function pressButton(ctx: Ctx, key: string) {
  const b = ctx.buttons[key];
  const x = b.cap.getWorldPosition(new THREE.Vector3()).x;
  const h = x < -0.05 ? ctx.hands.left : ctx.hands.right;
  const rest = REST[h.side > 0 ? "right" : "left"];
  const f = pressFrame(h, b);
  await moveHand(ctx, h, f.hover, f.q, POSES.point, 0.55);
  if (b.kind === "guard" && b.hinge) {
    // on soulève d'abord le capot, puis on bascule l'interrupteur
    const hinge = b.hinge, h0 = hinge.rotation.x;
    await ctx.anim.tween(0.25, (k) => { hinge.rotation.x = h0 + (-1.5 - h0) * ease(k); });
  }
  await moveHand(ctx, h, f.press, f.q, POSES.point, 0.13);
  if (b.kind) {
    const lever = b.lever, l0 = lever.rotation.x, l1 = -l0;
    ctx.anim.tween(0.12, (k) => { lever.rotation.x = l0 + (l1 - l0) * k; });
  } else {
    b.depth = 1;
  }
  await ctx.anim.wait(0.09);
  if (!b.kind) b.depth = 0;
  moveHand(ctx, h, f.hover, f.q, POSES.point, 0.16)
    .then(() => moveHand(ctx, h, rest.pos, new THREE.Quaternion().setFromEuler(rest.rot), POSES[rest.pose], 0.6));
}
