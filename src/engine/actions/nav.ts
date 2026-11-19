import { PROJECTS, type ProjectKey } from "../../content/profile";
import type { Ctx } from "../types";
import { ease } from "../util/tween";
import { dessinerNav, ligneEn, NAV } from "../world/navscreen";

/* La navigation entre les projets : un seul est choisi à la fois, sa planète seule dans le
   hublot. En changer fait glisser l'ancienne planète hors du hublot et entrer la nouvelle.
   Les planètes voisines (celle d'avant, celle d'après) se fabriquent pendant un temps mort
   pour que le changement ne saccade pas ; les autres sont libérées. */
const GLISSE = 150;
const DUREE = 0.9;

export function createNav(ctx: Ctx) {
  const keys = PROJECTS.map((p) => p.key);
  const n = keys.length;
  const state = { index: 0, busy: false };
  /** vrai quand le vaisseau est au repos (renseigné après la création du voyage) */
  let auRepos = () => true;

  const selected = (): ProjectKey => keys[state.index];
  function draw() {
    dessinerNav(ctx.navScreen.canvas.getContext("2d")!, state.index);
    ctx.navScreen.tex.needsUpdate = true;
  }
  function announce() {
    const p = PROJECTS[state.index];
    ctx.ui.announce(`Projet choisi : ${p.name}. ${p.slip}`);
  }

  async function goTo(target: ProjectKey | number, dir?: 1 | -1) {
    const i = typeof target === "number" ? ((target % n) + n) % n : keys.indexOf(target);
    if (i < 0 || i === state.index || state.busy || !auRepos()) return;
    state.busy = true;
    // par le chemin le plus court
    const d = dir ?? (((i - state.index + n) % n) <= n / 2 ? 1 : -1);
    const out = ctx.planet(keys[state.index]), inn = ctx.planet(keys[i]);
    inn.mesh.visible = true;
    inn.offset.set(d * GLISSE, 0, 0);
    state.index = i;
    draw(); announce();
    await ctx.anim.tween(DUREE, (k) => {
      const e = ease(k);
      out.offset.x = -d * GLISSE * e;
      inn.offset.x = d * GLISSE * (1 - e);
    });
    out.mesh.visible = false;
    out.offset.set(0, 0, 0); inn.offset.set(0, 0, 0);
    state.busy = false;
    warm();
  }

  const step = (d: 1 | -1) => goTo(state.index + d, d);

  /** attend la fin d'un changement de projet en cours */
  async function idle() { while (state.busy) await ctx.anim.wait(0.05); }

  /** garde la planète choisie et ses deux voisines, libère le reste, fabrique les voisines au calme */
  function warm() {
    const garder = new Set([0, 1, -1].map((o) => keys[(state.index + o + n) % n]));
    for (const k of Object.keys(ctx.planets) as ProjectKey[]) if (!garder.has(k)) ctx.releasePlanet(k);
    const fabriquer = () => {
      if (!auRepos() || state.busy) { setTimeout(fabriquer, 1500); return; }
      for (const k of garder) ctx.planet(k);
    };
    setTimeout(fabriquer, 500);
  }

  /** le projet touché sur l'écran, d'après le point de l'écran (coordonnées de texture) */
  function ligneAt(uv: { x: number; y: number }): number | null {
    return ligneEn((1 - uv.y) * NAV.h, state.index, n);
  }

  // au départ : le premier projet, déjà en place
  ctx.planet(keys[0]).mesh.visible = true;
  draw();
  warm();

  return { state, keys, selected, goTo, step, idle, ligneAt, setAuRepos(f: () => boolean) { auRepos = f; } };
}
export type Nav = ReturnType<typeof createNav>;
