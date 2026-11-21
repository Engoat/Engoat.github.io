import type { Ctx } from "../types";
import { ease } from "../util/tween";
import { buildOrrery } from "../world/orrery";

/* Le gros bouton PLANÈTES fait sortir la maquette, ou la rentre. Les volets s'ouvrent, puis le
   mât monte ; à la fermeture, l'inverse. Les miniatures ne se touchent que maquette sortie. */
export function createOrrery(ctx: Ctx) {
  const o = buildOrrery(ctx);
  const state = { open: false, busy: false, shutter: 0, rise: 0 };

  async function open() {
    if (state.open || state.busy) return;
    state.busy = true;
    await ctx.anim.tween(0.6, (k) => { state.shutter = ease(k); });
    await ctx.anim.tween(1.3, (k) => { state.rise = ease(k); });
    state.open = true; state.busy = false;
  }
  async function close() {
    if (!state.open && !state.busy) return;
    while (state.busy) await ctx.anim.wait(0.05);
    if (!state.open) return;
    state.busy = true; state.open = false;
    o.setPickable(false); o.hover(null);
    await ctx.anim.tween(1.0, (k) => { state.rise = 1 - ease(k); });
    await ctx.anim.tween(0.5, (k) => { state.shutter = 1 - ease(k); });
    state.busy = false;
  }
  const toggle = () => (state.open ? close() : open());

  function update(dt: number) {
    o.apply(state.shutter, state.rise, dt, ctx.camera);
    o.setPickable(state.open && state.rise > 0.95);
  }
  return { state, open, close, toggle, update, hits: o.hits, hover: o.hover };
}
export type OrreryControl = ReturnType<typeof createOrrery>;
