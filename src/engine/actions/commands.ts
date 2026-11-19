import type { Ctx } from "../types";
import type { ProjectKey } from "../../content/profile";
import type { Slip } from "./slip";
import type { Travel } from "./travel";
import type { Nav } from "./nav";
import { pressButton } from "./press";
import { ease } from "../util/tween";
import { PLATE_GLOW } from "../world/cabin";

/* Un clic pendant une animation n'est pas perdu : il attend son tour. Un second clic
   sur la commande déjà en cours (double-clic) est ignoré, sinon il déferait aussitôt
   ce qu'on vient de demander. */
export function createCommands(ctx: Ctx, slip: Slip, travel: Travel, nav: Nav) {
  let busy = false, current: string | null = null, queued: string | null = null;

  function act(key: string) {
    if (busy) { if (key !== current) queued = key; return; }
    void run(key);
  }

  async function exclusive(key: string, job: () => Promise<void>) {
    busy = true; current = key;
    try { await job(); }
    finally {
      busy = false; current = null;
      if (queued) { const k = queued; queued = null; void run(k); }
    }
  }

  const tearOpenSlip = async () => {
    if (!slip.state.open) return;
    const b = ctx.buttons[slip.state.open];
    if (b && !b.kind) b.on = false;
    await slip.tear();
  };

  function run(key: string) {
    return exclusive(key, async () => {
      if (key === "tear") { await tearOpenSlip(); return; }
      // le projet à engager : le projet choisi sur l'écran (« engage »), ou un projet nommé
      // (« engage_nexus », depuis le clavier ou le retour de la visite)
      const cible: ProjectKey | null = key === "engage" ? nav.selected() : key.startsWith("engage_") ? (key.slice(7) as ProjectKey) : null;
      const auRepos = travel.state.state === "home";
      if ((key === "nav_prev" || key === "nav_next") && !auRepos) return;
      if (cible && auRepos) await nav.goTo(cible);
      await nav.idle();
      await pressButton(ctx, cible ? "engage" : key);
      if (key === "lights") {
        ctx.night.on = !ctx.night.on;
      } else if (key === "eject") {
        await tearOpenSlip();
        ctx.ui.openSite();
      } else if (key === "nav_prev" || key === "nav_next") {
        await nav.step(key === "nav_next" ? 1 : -1);
      } else if (cible) {
        await tearOpenSlip();
        await travel.engage(auRepos ? cible : travel.state.target);
      } else if (slip.state.open === key) {
        await tearOpenSlip();
      } else {
        await tearOpenSlip();
        const b = ctx.buttons[key];
        if (!b.kind) b.on = true;
        await slip.print(key);
      }
    });
  }

  /* Le visiteur arrive dans un cockpit éteint, éclairé par le seul soleil du hublot.
     La main droite bascule FEUX CABINE ; le plafonnier hésite puis tient ; les voyants
     s'allument un par un (test des lampes) ; les aiguilles montent en bout d'échelle et
     reviennent ; la plaque du pilote s'éclaire. */
  const LAMP_TEST = ["ml", "sql", "python", "claude", "dossier", "nav_prev", "engage", "nav_next", "contact", "web", "java"];
  function boot() {
    const { power, anim } = ctx;
    return exclusive("boot", async () => {
      // un temps dans le noir, une fois l'écran de chargement ouvert
      await anim.wait(0.6);
      await pressButton(ctx, "lights");
      power.k = 1;
      for (const [d, v] of [[0.05, 0.7], [0.07, 0], [0.05, 0.9], [0.12, 0.15], [0.06, 1], [0.05, 0.4], [0.35, 1]]) {
        power.dome = v; await anim.wait(d);
      }
      for (const k of LAMP_TEST) { power.lamp = k; await anim.wait(0.07); }
      power.lamp = null;
      await anim.tween(1.2, (k) => { power.test = Math.sin(Math.PI * ease(k)); });
      power.test = 0;
      await anim.tween(0.35, (k) => { ctx.plateMat.emissiveIntensity = PLATE_GLOW * 2.2 * ease(k); });
      await anim.tween(0.8, (k) => { ctx.plateMat.emissiveIntensity = PLATE_GLOW * (2.2 - 1.2 * ease(k)); });
    });
  }

  /** retour du portfolio classique : le capot de l'éjection se referme */
  function siteClosed() {
    const b = ctx.buttons.eject;
    if (!b.kind || !b.hinge) return;
    b.lever.rotation.x = 0.5;
    const hinge = b.hinge, h0 = hinge.rotation.x;
    void ctx.anim.tween(0.3, (k) => { hinge.rotation.x = h0 * (1 - ease(k)); });
  }

  return { act, boot, siteClosed };
}
export type Commands = ReturnType<typeof createCommands>;
