import * as THREE from "three";
import type { Ctx } from "../types";
import type { ProjectKey } from "../../content/profile";
import { ease } from "../util/tween";
import { SUN_DIR } from "../world/space";
import { CABIN_SUN, SUN_AIM } from "../world/lights";

/* Le voyage, en trois temps sur k (0 → 1) :
   - pivot (0 → 0,35) : le vaisseau vire vers la planète. Tout l'extérieur tourne
     autour de nous, soleil compris : la tache de jour et les ombres balaient la cabine ;
   - poussée (0,2 → 1) : la planète grandit jusqu'à remplir le hublot ; la tête part en
     arrière à l'accélération, le champ de vision s'ouvre ;
   - arrivée : la poussée retombe et la surface défile sous le vaisseau.
   Le retour rejoue la même course à l'envers. */
const GO = 6, BACK = 3.6;
const Q_ID = new THREE.Quaternion();

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
      setButton(target, true);
      ctx.ui.setCaption([{ kind: "text", text: `Cap sur ${ctx.planets[target].name}.` }]);
      await ctx.anim.tween(GO, (k) => { state.k = k; });
      state.state = "there";
      hooks.arrived(target);
    } else if (state.state === "there") {
      const t = state.target;
      state.state = "going";
      ctx.ui.setCaption(null);
      hooks.leaving();
      await ctx.anim.tween(BACK, (k) => { state.k = 1 - k; });
      state.state = "home";
      setButton(t, false);
    }
  }
  function setButton(target: ProjectKey, on: boolean) {
    const b = ctx.buttons["engage_" + target];
    if (!b.kind) b.on = on;
  }

  /** à chaque image : l'extérieur pivote (le soleil avec), puis la planète approche */
  function update(dt: number) {
    const tp = ctx.planets[state.target], ph = travelPhase(state.k);
    ctx.space.quaternion.slerpQuaternions(Q_ID, tp.qAlign, ph.turn);
    for (const p of Object.values(ctx.planets)) {
      if (p.key === state.target) p.mesh.position.lerpVectors(p.home, p.approachLocal, ph.move);
      else p.mesh.position.copy(p.home);
      const sun = p.mesh.material.uniforms.sunDir.value as THREE.Vector3;
      sun.copy(SUN_DIR).applyQuaternion(ctx.space.quaternion);
      (p.shell.material.uniforms.sunDir.value as THREE.Vector3).copy(sun);
      // à l'arrivée, la surface défile sous le vaisseau
      p.mesh.rotation.y += dt * (0.006 + (p.key === state.target ? 0.03 * ph.move : 0));
    }
    ctx.sun.position.copy(CABIN_SUN).applyQuaternion(ctx.space.quaternion).multiplyScalar(4).add(SUN_AIM);
    state.thrust = state.state === "going" ? ph.thrust : 0;
  }

  return { state, engage, update };
}
export type Travel = ReturnType<typeof createTravel>;
