/* Animations pilotées par le temps de la simulation (et non par l'horloge murale) :
   on peut ainsi ralentir, figer ou avancer pas à pas tout le cockpit, pour les
   captures d'écran comme pour « prefers-reduced-motion ». */

export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Tween { t0: number; dur: number; fn: (k: number) => void; res: () => void }

export class Animator {
  /** temps simulé, en millisecondes */
  time = 0;
  private tweens: Tween[] = [];
  constructor(private reduced: boolean) {}

  /** appelle fn(k) avec k de 0 à 1 pendant dur secondes ; se résout à la fin */
  tween(dur: number, fn: (k: number) => void): Promise<void> {
    return new Promise((res) => this.tweens.push({ t0: this.time, dur: this.reduced ? 1 : dur * 1000, fn, res }));
  }

  wait(s: number) { return this.tween(s, () => {}); }

  /** termine d'un coup toutes les animations en cours (bouton « Suivant » des visites) */
  rush() {
    const all = this.tweens.splice(0);
    for (const tw of all) { tw.fn(1); tw.res(); }
  }

  /** avance le temps de dt secondes et fait progresser chaque animation */
  step(dt: number) {
    this.time += dt * 1000;
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      const k = Math.min(1, (this.time - tw.t0) / tw.dur);
      tw.fn(k);
      if (k >= 1) { this.tweens.splice(i, 1); tw.res(); }
    }
  }
}
