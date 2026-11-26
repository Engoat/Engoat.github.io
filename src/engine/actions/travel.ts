import * as THREE from "three";
import type { Ctx } from "../types";
import type { ProjectKey } from "../../content/profile";
import { ease } from "../util/tween";
import { SPIN, SUN_DIR, SUN_POS } from "../world/space";
import { CABIN_SUN, SUN_AIM } from "../world/lights";

/* Le voyage, en trois temps sur k (0 → 1) :
   - pivot (0 → 0,35) : le vaisseau vire vers la planète. Tout l'extérieur tourne
     autour de nous, soleil compris : la tache de jour et les ombres balaient la cabine ;
   - poussée (0,2 → 1) : la planète grandit jusqu'à remplir le hublot ; la tête part en
     arrière à l'accélération, le champ de vision s'ouvre ;
   - arrivée : la poussée retombe et la surface défile sous le vaisseau.
   Le retour rejoue la même course à l'envers. La planète visitée s'arrête sur son orbite
   pendant la visite et la reprend au retour. */
const GO = 6, BACK = 3.6;
const Q_ID = new THREE.Quaternion();
const TO_SUN = new THREE.Vector3(), VISIT_SUN = new THREE.Vector3();

export const travelPhase = (k: number) => ({
  turn: THREE.MathUtils.smoothstep(k, 0, 0.35),
  move: ease(THREE.MathUtils.clamp((k - 0.2) / 0.8, 0, 1)),
  thrust: Math.sin(Math.PI * THREE.MathUtils.clamp((k - 0.2) / 0.8, 0, 1)),
});

export interface TravelHooks {
  /** à l'arrivée en orbite */
  arrived(target: ProjectKey): void;
  /** au départ du retour */
  leaving(): void;
}

export function createTravel(ctx: Ctx, hooks: TravelHooks) {
  const state = { state: "home" as "home" | "going" | "there", k: 0, target: "nexus" as ProjectKey, thrust: 0 };

  async function engage(target: ProjectKey) {
    if (state.state === "home") {
      state.target = target;
      state.state = "going";
      ctx.detailPlanet(target);                   // sa carte détaillée (déjà prête si on a survolé la miniature)
      ctx.freezePlanet(target);
      ctx.ui.setCaption([{ kind: "text", text: `Cap sur ${ctx.planet(target).name}.` }]);
      await ctx.anim.tween(GO, (k) => { state.k = k; });
      state.state = "there";
      hooks.arrived(target);
    } else if (state.state === "there") {
      state.state = "going";
      ctx.ui.setCaption(null);
      hooks.leaving();
      await ctx.anim.tween(BACK, (k) => { state.k = 1 - k; });
      state.state = "home";
      // de retour : la planète reprend son orbite, et rend sa carte détaillée
      ctx.releasePlanet(state.target);
      ctx.lightPlanet(state.target);
    }
  }

  /** à chaque image : le système tourne ; l'extérieur pivote (le soleil avec), puis la planète approche */
  function update(dt: number) {
    ctx.systemUpdate(dt);
    const tp = ctx.planet(state.target), ph = travelPhase(state.k);
    ctx.space.quaternion.slerpQuaternions(Q_ID, tp.qAlign, ph.turn);
    for (const p of Object.values(ctx.planets)) {
      const visite = p.key === state.target && state.k > 0;
      if (visite) p.mesh.position.lerpVectors(p.home, p.approachLocal, ph.move);
      else p.mesh.position.copy(p.home);
      // chaque planète est éclairée par le soleil, d'où elle est (et le soleil tourne avec l'extérieur)
      TO_SUN.copy(SUN_POS).sub(p.mesh.position).normalize().applyQuaternion(ctx.space.quaternion);
      // pendant l'approche, le vaisseau se range du côté éclairé : la lumière passe de celle du ciel à celle de la visite
      if (visite) TO_SUN.lerp(VISIT_SUN.copy(SUN_DIR).applyQuaternion(ctx.space.quaternion), ph.move).normalize();
      (p.mesh.material.uniforms.sunDir.value as THREE.Vector3).copy(TO_SUN);
      (p.shell.material.uniforms.sunDir.value as THREE.Vector3).copy(TO_SUN);
      // elle tourne sur elle-même ; à l'arrivée, la surface défile plus vite sous le vaisseau
      p.mesh.rotation.y += dt * (SPIN + (visite ? 0.03 * ph.move : 0));
    }
    ctx.sun.position.copy(CABIN_SUN).applyQuaternion(ctx.space.quaternion).multiplyScalar(4).add(SUN_AIM);
    state.thrust = state.state === "going" ? ph.thrust : 0;
  }

  return { state, engage, update };
}
export type Travel = ReturnType<typeof createTravel>;
