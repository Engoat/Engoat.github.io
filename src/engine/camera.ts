import * as THREE from "three";
import type { Ctx } from "./types";

/* La tête du pilote : elle suit sa cible (au repos, ou penchée vers le ruban), et
   reçoit par-dessus les secousses et l'inertie de la poussée, sans qu'elles
   s'accumulent d'une image à l'autre. */
export function createHead(ctx: Ctx) {
  const { camera } = ctx;
  const base = camera.position.clone();
  const look = ctx.camHome.look.clone();
  const sway = new THREE.Vector3();
  let baseFov = 72, leanK = 0;

  function resize(w: number, h: number) {
    ctx.renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // en portrait, on élargit le champ pour garder la planche entière
    baseFov = THREE.MathUtils.clamp(72 * (1.78 / Math.max(camera.aspect, 0.5)) ** 0.5, 72, 100);
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  }

  function update(t: number, dt: number, thrust: number) {
    const shake = ctx.reduced ? 0 : thrust * 0.0025;
    sway.set(Math.sin(t * 31) * shake, Math.sin(t * 27 + 1) * shake, ctx.reduced ? 0 : thrust * 0.035);
    base.lerp(ctx.camTarget.pos, Math.min(1, dt * 3));
    camera.position.copy(base).add(sway);
    look.lerp(ctx.camTarget.look, Math.min(1, dt * 3));
    camera.lookAt(look);
    leanK += (ctx.camTarget.lean - leanK) * Math.min(1, dt * 3);
    const fov = THREE.MathUtils.lerp(baseFov, ctx.camTarget.fov, leanK) + (ctx.reduced ? 0 : thrust * 6);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  return { resize, update };
}
