import type { Ctx } from "../types";
import type { Hud } from "./hud";
import { wrapLines } from "./hud";
import type { DemoScript } from "./director";

/* La fiche d'Aléa reprend l'écran réel de l'appli, sur un téléphone : mêmes libellés, mêmes
   couleurs (la palette provisoire de l'appli : papier, encre, filets chauds) et de vrais
   chiffres, calculés par le moteur de l'appli :
   - la loi exacte de 4d6kh3 (moyenne 12,24, écart-type 2,85 ; 14 : 12,3 %, 14 ou plus : 35,5 %) ;
   - un tirage vérifiable sur Ana, Bo, Cécile, Dylan, Elie, avec une graine fixe : l'empreinte
     ci-dessous, et le mot « banane » qui désigne Dylan (le mot « pomme » désignerait Cécile) ;
   - des équipes de niveaux 9, 5, 5, 5, 5, 3 : 15 contre 17, le meilleur partage possible. */
const AL = { papier: "#f6f5f1", carte: "#ffffff", encre: "#1b1a17", encre2: "#5a5750", filet: "#d8d5cb", roue: "#e9e6dc", erreur: "#a3281c" };
const font = (w: number, px: number) => `${w} ${px}px "Instrument Sans"`;
const MONO = (px: number) => `500 ${px}px "IBM Plex Mono"`;

const LOI = [0.000772, 0.003086, 0.007716, 0.016204, 0.029321, 0.04784, 0.070216, 0.094136, 0.114198, 0.128858, 0.132716, 0.123457, 0.10108, 0.072531, 0.041667, 0.016204]; // totaux 3 à 18
const DES = [5, 3, 6, 2];                         // le 2, le plus faible, est écarté
const NOMS = ["Ana", "Bo", "Cécile", "Dylan", "Elie"];
const TOUR = 360 * 5 + (360 - 252);               // la roue s'arrête sur Dylan (part n° 4, centrée à 252°)
const EMPREINTE = ["71525f93", "0e1b5108", "af02044f", "8615b3dc", "4e2f5ab7", "84addccd", "f8e93bc7", "9e7a717b"];
const EQUIPES: [string, number, [string, number][]][] = [
  ["Équipe 1", 15, [["Bo", 5], ["Cécile", 5], ["Elie", 5]]],
  ["Équipe 2", 17, [["Ana", 9], ["Dylan", 5], ["Fatou", 3]]],
];

type G = CanvasRenderingContext2D;
const rr = (g: G, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string, lw = 1.5) => {
  g.beginPath(); g.roundRect(x, y, w, h, r);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
};
/** texte à (x, y) avec la police, la couleur et l'alignement donnés */
const txt = (g: G, s: string, x: number, y: number, f: string, c: string, align: CanvasTextAlign = "left") => {
  g.font = f; g.fillStyle = c; g.textAlign = align; g.textBaseline = "middle"; g.fillText(s, x, y);
};
function bouton(g: G, x: number, y: number, w: number, h: number, s: string, o: { plein?: boolean; actif?: boolean; px?: number } = {}) {
  const sombre = o.plein || o.actif;
  rr(g, x, y, w, h, 9, sombre ? AL.encre : AL.carte, sombre ? AL.encre : AL.encre2, 1);
  txt(g, s, x + w / 2, y + h / 2 + 1, font(600, o.px ?? 15), sombre ? AL.papier : AL.encre, "center");
}

export function createAleaDemo(ctx: Ctx, hud: Hud): DemoScript {
  const fresh = () => ({
    on: false, tab: 0, vue: "roue" as "roue" | "remise" | "equipes" | "preuve",
    scroll: 0, typed: 0, roule: 0, total: false, proba: 0, roue: 0, mot: 0, verif: 0,
  });
  let a = fresh();
  const anim = (dur: number, fn: (k: number) => void) => ctx.anim.tween(dur, (k) => { fn(k); hud.state.dirty = true; });

  async function run(ok: () => boolean) {
    await hud.say("Bienvenue sur Aléa, une application mobile de hasard : des dés pour les jeux de rôle, et des tirages au sort.");
    if (!ok()) return false;
    a.on = true;

    let t = anim(1.6, (k) => { a.typed = k; });
    await hud.say("On compose un lancer comme à la table de jeu : quatre dés à six faces, dont on garde les trois meilleurs. C'est la notation 4d6kh3.");
    if (!ok()) return false;
    await t;

    t = anim(2.6, (k) => { a.scroll = Math.min(1, k / 0.3) * 400; a.roule = Math.max(0, (k - 0.3) / 0.7); a.total = k >= 1; });
    await hud.say("Les dés roulent, puis se posent. Le plus faible est écarté, ici le 2 : le total est 14.");
    if (!ok()) return false;
    await t;

    t = anim(1.4, (k) => { a.proba = k; });
    await hud.say("Sous le résultat, la loi de probabilité exacte : 14 sort dans 12,3 % des lancers, et 14 ou plus dans 35,5 %. La moyenne est de 12,24.");
    if (!ok()) return false;
    await t;

    t = anim(1.4, (k) => { a.scroll = 400 + k * 240; });
    await hud.say("Le résultat est tiré avant l'animation, avec le générateur aléatoire du téléphone : les dés qui roulent ne sont qu'un décor.");
    if (!ok()) return false;
    await t;

    a.tab = 1; a.vue = "roue"; a.scroll = 0;
    t = anim(3.2, (k) => { a.roue = TOUR * (1 - (1 - Math.min(1, k)) ** 3); });
    await hud.say("L'onglet Tirages tire un nom dans une liste : à la roue, aux cartes ou au défilement. Chaque nom peut avoir un poids.");
    if (!ok()) return false;
    await t;

    a.vue = "remise";
    await hud.say("Sans remise, personne ne repasse avant que tous soient passés : ici, il reste 4 noms sur 5.");
    if (!ok()) return false;

    a.vue = "equipes";
    await hud.say("Les équipes se forment selon le niveau de chacun. Jusqu'à 16 personnes, l'appli garantit le meilleur partage possible : ici 15 contre 17.");
    if (!ok()) return false;

    a.vue = "preuve"; a.mot = 0;
    t = anim(1.6, (k) => { a.mot = k; });
    await hud.say("Un tirage peut être rendu vérifiable : une empreinte est publiée avant, un participant tape un mot, puis le tirage est révélé.");
    if (!ok()) return false;
    await t;

    a.tab = 2; a.verif = 1;
    t = (async () => { await ctx.anim.wait(2.4); a.verif = 2; hud.state.dirty = true; })();
    await hud.say("N'importe qui colle la preuve dans l'onglet Vérifier : l'appli refait le calcul et contrôle que l'empreinte correspond. Un mot changé, et la vérification échoue.");
    if (!ok()) return false;
    await t;
    return true;
  }

  /* --- le téléphone --------------------------------------------------------- */

  const PH = { w: 390, tabbar: 52 };

  function tuile(g: G, x: number, y: number, v: number, ecarte: boolean) {
    g.save(); g.globalAlpha = ecarte ? 0.42 : 1;
    rr(g, x, y, 64, 64, 12, AL.carte);
    g.strokeStyle = AL.encre; g.lineWidth = 1.5; if (ecarte) g.setLineDash([5, 4]);
    g.beginPath(); g.roundRect(x, y, 64, 64, 12); g.stroke(); g.setLineDash([]);
    txt(g, "d6", x + 7, y + 11, font(400, 12), AL.encre2);
    txt(g, String(v), x + 32, y + 36, font(700, 28), AL.encre, "center");
    if (ecarte) { g.fillStyle = AL.encre; g.fillRect(x + 20, y + 35, 24, 2.5); }
    g.restore();
  }

  function pageDes(g: G) {
    const sc = a.scroll;
    g.save(); g.translate(0, -sc);
    txt(g, "Dés", 16, 28, font(700, 30), AL.encre);
    txt(g, "NOTATION", 16, 66, font(700, 14), AL.encre2);
    // le champ, où le lancer se tape, et le bouton
    rr(g, 16, 78, 262, 44, 10, AL.carte, AL.encre2, 1);
    const notation = "4d6kh3".slice(0, Math.floor(a.typed * 6.99));
    txt(g, notation + (a.typed > 0 && a.typed < 1 ? "│" : ""), 28, 101, font(500, 20), AL.encre);
    bouton(g, 286, 78, 88, 44, "Lancer", { plein: true, px: 16 });
    // le clavier de notation
    const rang = (y: number, noms: string[]) => noms.forEach((n, i) => { const w = (358 - (noms.length - 1) * 6) / noms.length; bouton(g, 16 + i * (w + 6), y, w, 44, n, { px: 16 }); });
    rang(132, ["d4", "d6", "d8", "d10", "d12", "d20", "d100"]);
    rang(182, ["1", "2", "3", "4", "5"]);
    rang(232, ["6", "7", "8", "9", "0"]);
    rang(282, ["+", "−", "⌫", "C"]);
    rang(332, ["kh", "kl", "!", "r"]);
    // le résultat
    const y0 = 396;
    rr(g, 16, y0, 358, 372, 10, AL.carte, AL.filet, 1);
    if (a.roule > 0 || a.scroll > 100) {
      txt(g, "4d6kh3", 28, y0 + 22, font(700, 14), AL.encre2);
      DES.forEach((v, i) => {
        // les dés roulent (des chiffres défilent), puis se posent chacun à son tour
        const fin = (i + 1) / (DES.length + 1);
        const pose = a.roule >= fin;
        const aff = pose ? v : 1 + Math.floor(a.roule * 41 + i * 5) % 6;
        if (a.roule > 0) tuile(g, 24 + i * 72, y0 + 36, aff, pose && i === 3);
      });
      g.fillStyle = AL.filet; g.fillRect(28, y0 + 112, 334, 1);
      txt(g, "TOTAL", 28, y0 + 140, font(700, 14), AL.encre2);
      if (a.total) txt(g, "14", 362, y0 + 142, font(800, 44), AL.encre, "right");
      g.fillRect(28, y0 + 172, 334, 1);
      if (a.proba > 0) {
        txt(g, "PROBABILITÉ", 28, y0 + 194, font(700, 14), AL.encre2);
        const slot = 334 / 16, bas = y0 + 304, max = Math.max(...LOI);
        LOI.forEach((p, i) => {
          const h = (p / max) * 90 * a.proba;
          g.fillStyle = i + 3 === 14 ? AL.encre : AL.filet;
          g.fillRect(28 + i * slot + 1.5, bas - h, slot - 3, h);
        });
        g.fillStyle = AL.encre2; g.fillRect(28, bas, 334, 1);
        txt(g, "3", 28, bas + 12, font(400, 13), AL.encre2); txt(g, "18", 362, bas + 12, font(400, 13), AL.encre2, "right");
        if (a.proba >= 1) {
          txt(g, "Exactement 14 : 12,3 %", 28, y0 + 334, font(400, 15), AL.encre);
          txt(g, "14 ou plus : 35,5 %", 28, y0 + 356, font(400, 15), AL.encre);
          txt(g, "Moyenne 12,24 · écart-type 2,85", 28, y0 + 378, font(400, 14), AL.encre2);
        }
      }
    }
    // en bas de la page : favoris, historique, et la phrase d'explication de l'appli
    const yf = y0 + 410;
    txt(g, "FAVORIS", 16, yf, font(700, 14), AL.encre2);
    bouton(g, 16, yf + 14, 40, 40, "+", { px: 18 });
    txt(g, "HISTORIQUE", 16, yf + 82, font(700, 14), AL.encre2);
    rr(g, 16, yf + 96, 358, 52, 10, AL.carte, AL.filet, 1);
    txt(g, "4d6kh3", 28, yf + 122, font(400, 15), AL.encre);
    txt(g, "14", 362, yf + 122, font(700, 18), AL.encre, "right");
    g.font = font(400, 14);
    wrapLines(g, "Le résultat est tiré avant l'animation, avec le générateur aléatoire du système : les dés qui roulent ne sont qu'un décor.", 340)
      .forEach((l, i) => txt(g, l, 16, yf + 176 + i * 18, font(400, 14), AL.encre2));
    g.restore();
  }

  function roue(g: G, cx: number, cy: number, R: number) {
    for (let k = 0; k < 5; k++) {
      const a0 = (-90 + a.roue + k * 72) * Math.PI / 180, a1 = a0 + (72 * Math.PI) / 180;
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a1); g.closePath();
      g.fillStyle = k % 2 ? AL.roue : AL.carte; g.fill();
      g.strokeStyle = AL.encre; g.lineWidth = 2; g.stroke();
      g.save(); g.translate(cx, cy); g.rotate((a0 + a1) / 2);
      txt(g, NOMS[k], R * 0.6, 0, font(600, 14), AL.encre, "center"); g.restore();
    }
    g.fillStyle = AL.encre; g.beginPath(); g.arc(cx, cy, 5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(cx - 10, cy - R - 12); g.lineTo(cx + 10, cy - R - 12); g.lineTo(cx, cy - R + 6); g.closePath(); g.fill();
  }

  function pageTirages(g: G) {
    txt(g, "Tirages", 16, 28, font(700, 30), AL.encre);
    const ligne = (y: number, noms: string[], actif: number) => { let x = 16; noms.forEach((n, i) => { g.font = font(600, 14); const w = g.measureText(n).width + 22; bouton(g, x, y, w, 32, n, { actif: i === actif, px: 14 }); x += w + 6; }); };
    ligne(48, ["Un nom", "Plusieurs", "Ordre", "Équipes"], a.vue === "equipes" ? 3 : 0);
    ligne(86, ["Pile ou face"], -1);
    if (a.vue === "roue") {
      bouton(g, 16, 126, 358, 40, "Tirer", { plein: true, px: 17 });
      roue(g, 195, 262, 82);
      if (a.roue >= TOUR) txt(g, "Tiré : Dylan", 195, 372, font(800, 24), AL.encre, "center");
    } else if (a.vue === "remise") {
      ligne(126, ["Roue", "Cartes", "Défilement", "Sans remise"], 3);
      txt(g, "Restants : 4 sur 5", 16, 178, font(400, 14), AL.encre2);
      bouton(g, 250, 164, 124, 30, "Nouveau cycle", { px: 13 });
      rr(g, 16, 204, 358, 190, 10, AL.carte, AL.filet, 1);
      NOMS.forEach((n, i) => {
        const passe = i === 3, y = 226 + i * 34;
        txt(g, n, 30, y, font(passe ? 400 : 600, 17), passe ? AL.encre2 : AL.encre);
        if (passe) txt(g, "passé", 360, y, font(400, 14), AL.encre2, "right");
      });
    } else if (a.vue === "equipes") {
      txt(g, "Nombre d'équipes", 16, 142, font(400, 15), AL.encre);
      bouton(g, 244, 126, 40, 32, "−", { px: 16 }); txt(g, "2", 311, 142, font(700, 17), AL.encre, "center"); bouton(g, 334, 126, 40, 32, "+", { px: 16 });
      EQUIPES.forEach(([nom, niveau, gens], i) => {
        const y = 168 + i * 108;
        rr(g, 16, y, 358, 100, 10, AL.carte, AL.filet, 1);
        txt(g, nom.toUpperCase(), 28, y + 18, font(700, 14), AL.encre2);
        txt(g, `niveau total ${niveau}`, 362, y + 18, font(400, 14), AL.encre2, "right");
        gens.forEach(([n, v], k) => { txt(g, n, 28, y + 40 + k * 22, font(700, 16), AL.encre); txt(g, String(v), 362, y + 40 + k * 22, font(400, 14), AL.encre2, "right"); });
      });
      txt(g, "C'est le meilleur partage possible.", 16, 392, font(400, 14), AL.encre2);
    } else {
      bouton(g, 16, 126, 150, 30, "Tirage vérifiable", { actif: true, px: 13 });
      rr(g, 16, 166, 358, 228, 10, AL.carte, AL.filet, 1);
      txt(g, "ENGAGEMENT", 28, 188, font(700, 14), AL.encre2);
      for (let r = 0; r < 2; r++) txt(g, EMPREINTE.slice(r * 4, r * 4 + 4).join(" "), 28, 214 + r * 20, MONO(14), AL.encre);
      g.font = font(400, 14);
      wrapLines(g, "Cette empreinte fixe la liste et une graine secrète. Montre-la à tout le monde avant de continuer.", 330)
        .forEach((l, i) => txt(g, l, 28, 262 + i * 18, font(400, 14), AL.encre2));
      rr(g, 28, 306, 334, 40, 10, AL.carte, AL.encre2, 1);
      txt(g, "banane".slice(0, Math.floor(a.mot * 6.99)), 40, 327, font(500, 16), AL.encre);
      bouton(g, 28, 352, 334, 34, "Révéler le tirage", { plein: true, px: 15 });
    }
  }

  function pageVerifier(g: G) {
    txt(g, "Vérifier", 16, 28, font(700, 30), AL.encre);
    g.font = font(400, 14);
    wrapLines(g, "Colle une preuve copiée depuis Aléa. L'appli refait le calcul : si l'empreinte et le résultat correspondent, le tirage n'a pas été truqué.", 358)
      .forEach((l, i) => txt(g, l, 16, 58 + i * 18, font(400, 14), AL.encre2));
    rr(g, 16, 118, 358, 96, 10, AL.carte, AL.encre2, 1);
    const mot = a.verif === 2 ? "pomme" : "banane";
    [`{"version":"alea/v1","engagement":`, `"71525f930e1b5108af02044f86…",`, `"mot":"${mot}","graine":"0b30…",`, `"resultat":{"mode":"un","index":3}}`]
      .forEach((l, i) => txt(g, l, 28, 136 + i * 18, MONO(13), AL.encre));
    bouton(g, 16, 224, 90, 36, "Coller", { px: 14 });
    bouton(g, 114, 224, 260, 36, "Vérifier la preuve", { plein: true, px: 15 });
    const ko = a.verif === 2;
    rr(g, 16, 272, 358, 130, 10, AL.carte, AL.filet, 1);
    const ligne = (y: number, bon: boolean, s: string) => {
      g.font = font(700, 14);
      wrapLines(g, (bon ? "✓ " : "✗ ") + s, 330).forEach((l, i) => txt(g, l, 28, y + i * 17, font(700, 14), bon ? AL.encre : AL.erreur));
    };
    ligne(292, true, "L'empreinte correspond à la liste et à la graine révélées.");
    ligne(334, !ko, ko ? "Le tirage refait donne un autre résultat que celui annoncé." : "Le tirage refait donne le résultat annoncé.");
    txt(g, "RÉSULTAT RECALCULÉ", 28, 378, font(700, 13), AL.encre2);
    txt(g, ko ? "Tiré : Cécile" : "Tiré : Dylan", 28, 394, font(600, 14), AL.encre);
  }

  function drawCard(g: G, W: number) {
    if (!a.on) return;
    const cw = 500, ch = 580, cx = W - cw - 50, cy = 100, bord = 10;
    const S = (cw - 2 * bord) / PH.w, sw = cw - 2 * bord, sh = ch - 2 * bord;
    // le cadre du téléphone
    rr(g, cx, cy, cw, ch, 38, "#151515");
    g.save();
    g.beginPath(); g.roundRect(cx + bord, cy + bord, sw, sh, 29); g.clip();
    g.fillStyle = AL.papier; g.fillRect(cx + bord, cy + bord, sw, sh);
    g.translate(cx + bord, cy + bord); g.scale(S, S);
    const H = sh / S, haut = H - PH.tabbar;
    g.save(); g.beginPath(); g.rect(0, 0, PH.w, haut); g.clip();
    if (a.tab === 0) pageDes(g); else if (a.tab === 1) pageTirages(g); else pageVerifier(g);
    g.restore();
    // la barre d'onglets, comme dans l'appli : Dés, Tirages, Vérifier
    g.fillStyle = AL.carte; g.fillRect(0, haut, PH.w, PH.tabbar);
    g.fillStyle = AL.filet; g.fillRect(0, haut, PH.w, 1);
    ["Dés", "Tirages", "Vérifier"].forEach((n, i) => txt(g, n, PH.w * (i + 0.5) / 3, haut + 26, font(600, 14), i === a.tab ? AL.encre : AL.encre2, "center"));
    g.restore();
  }

  return {
    key: "alea",
    steps: 10,
    reset() { a = fresh(); },
    run,
    finish() {
      a = fresh();
      a.on = true; a.scroll = 400; a.typed = 1; a.roule = 1; a.total = true; a.proba = 1;
    },
    stop() { a = fresh(); },
    update() {},
    drawCard,
  };
}
