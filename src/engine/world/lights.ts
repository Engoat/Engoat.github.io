import * as THREE from "three";
import type { Ctx } from "../types";

/* Dans la cabine, le soleil entre par le hublot plus en face que sur les planètes :
   c'est un choix de mise en lumière, pour que le hublot dessine une vraie tache de
   jour sur la planche et sur les mains. */
export const CABIN_SUN = new THREE.Vector3(-0.42, 0.36, -0.83).normalize();
export const SUN_AIM = new THREE.Vector3(0, -0.3, -0.7);

export function buildLights(ctx: Ctx) {
  const sun = new THREE.DirectionalLight(0xffeed4, 4.6);
  sun.position.copy(CABIN_SUN).multiplyScalar(4).add(SUN_AIM);
  sun.target.position.copy(SUN_AIM);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -1.4, right: 1.4, top: 1.4, bottom: -1.4, near: 0.5, far: 12 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.015;
  sun.shadow.radius = 3;
  ctx.scene.add(sun, sun.target);

  // plafonnier, et la faible lumière renvoyée par les parois
  const dome = new THREE.PointLight(0xffd6a0, 0.85, 2.4, 1.5);
  dome.position.set(0, 0.62, -0.05);
  const hemi = new THREE.HemisphereLight(0x9aaec0, 0x2a2016, 0.2);
  ctx.scene.add(dome, hemi);

  ctx.sun = sun; ctx.dome = dome; ctx.hemi = hemi;
  ctx.night = { on: false, k: 0 };
  ctx.power = ctx.boot ? { k: 0, dome: 0, test: 0, lamp: null } : { k: 1, dome: 1, test: 0, lamp: null };
}

/** éclairage de la cabine à chaque image : plafonnier, vol de nuit, allumage */
export function updateLights(ctx: Ctx, dt: number) {
  const { night, power } = ctx;
  night.k += ((night.on ? 1 : 0) - night.k) * Math.min(1, dt * 2.5);
  // part du plafonnier allumé (éteint au démarrage, ou en vol de nuit)
  const cabin = power.dome * (1 - night.k);
  ctx.dome.intensity = 0.85 * cabin + 0.04 * night.k * power.k;
  ctx.hemi.intensity = 0.015 + 0.185 * cabin;
  ctx.scene.environmentIntensity = 0.02 + 0.18 * cabin;
  for (const m of ctx.gaugeFaces) m.emissiveIntensity = night.k * 0.75 * power.k;
}
