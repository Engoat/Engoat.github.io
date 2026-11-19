import type { CaptionItem, Ctx } from "../types";
import type { ProjectKey } from "../../content/profile";
import { createHud } from "./hud";
import { createNexusDemo } from "./nexus";
import { createCribleDemo } from "./crible";

/** ce qu'une démo de projet doit fournir au metteur en scène */
export interface DemoScript {
  key: ProjectKey;
  /** nombre de phrases de la tour, pour le compteur « Étape n / N » */
  steps: number;
  reset(): void;
  /** « Suivant » : sauter ce que l'animation attendait (la file qui avance, par exemple) */
  skip?(): void;
  /** le texte et l'animation ; renvoie false si la visite a été interrompue */
  run(ok: () => boolean): Promise<boolean>;
  /** état final, quand on passe la visite ou qu'elle se termine */
  finish(): void;
  stop(): void;
  update(dt: number): void;
  drawCard(g: CanvasRenderingContext2D, W: number): void;
}

export interface DirectorHooks {
  /** « Revenir au cockpit » : refait le voyage en sens inverse */
  back(): void;
}

/* Le metteur en scène des visites : une planète atteinte, il lance sa démo, gère
   « Passer la visite », « Revoir la visite » et l'arrêt quand on repart. Un jeton
   invalide toute suite d'animation lancée par une visite précédente. */
export function createDirector(ctx: Ctx, hooks: DirectorHooks) {
  const hud = createHud(ctx);
  const scripts: Record<ProjectKey, DemoScript> = {
    nexus: createNexusDemo(ctx, hud),
    crible: createCribleDemo(ctx, hud),
  };
  const s = { target: "nexus" as ProjectKey, active: false, finished: false, token: 0 };
  const name = (k: ProjectKey) => ctx.planets[k].name;

  /* La visite avance seule, mais le visiteur garde la main : « Suivant » termine
     l'étape en cours, le compteur dit ce qui reste, « Passer » va à la fin. */
  function caption(final: boolean) {
    const items: CaptionItem[] = final
      ? [{ kind: "button", label: "Revoir la visite", onClick: () => { void start(s.target); } }]
      : [
          { kind: "text", text: `Étape ${Math.max(hud.state.step, 1)} / ${scripts[s.target].steps}` },
          { kind: "button", label: "Suivant", onClick: next },
          { kind: "button", label: "Passer la visite", onClick: finish },
        ];
    items.push({ kind: "button", label: "Revenir au cockpit", onClick: hooks.back });
    ctx.ui.setCaption(items);
  }
  hud.onStep = () => { if (s.active && !s.finished) caption(false); };

  function next() {
    if (!s.active || s.finished) return;
    scripts[s.target].skip?.();
    hud.state.skipped = hud.state.step;      // l'étape entière : écriture et temps de lecture
    ctx.anim.rush();
  }

  async function start(target: ProjectKey) {
    const tok = ++s.token;
    s.target = target;
    s.active = true; s.finished = false;
    for (const sc of Object.values(scripts)) sc.stop();
    const script = scripts[target];
    script.reset();
    hud.state.step = 0;
    hud.state.title = `TOUR DE CONTRÔLE · ${name(target)}`;
    hud.mesh.visible = true;
    hud.state.dirty = true;
    caption(false);
    const done = await script.run(() => tok === s.token && s.active);
    if (done && tok === s.token) finish();
  }

  function finish() {
    if (!s.active || s.finished) return;
    s.token++;
    s.finished = true;
    scripts[s.target].finish();
    hud.state.title = name(s.target);
    hud.state.dirty = true;
    const pretty = s.target === "nexus" ? "Nexus" : "Crible";
    void hud.say(`Atterrissage accordé. Bon séjour sur ${pretty}.`);
    caption(true);
  }

  function stop() {
    s.token++;
    s.active = false; s.finished = false;
    hud.mesh.visible = false;
    scripts[s.target].stop();
  }

  function update(dt: number) {
    if (!s.active) return;
    scripts[s.target].update(dt);
    if (hud.state.dirty) hud.draw((g, W) => scripts[s.target].drawCard(g, W));
  }

  return { state: s, hud, start, finish, next, stop, update };
}
export type Director = ReturnType<typeof createDirector>;
