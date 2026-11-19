import type { Ctx } from "../types";
import type { Hud } from "./hud";
import type { DemoScript } from "./director";
import cribleLogoUrl from "../../assets/crible.svg";

/* La fiche de Crible reprend l'écran réel de l'outil : mêmes couleurs, mêmes libellés,
   et les vrais chiffres obtenus sur Titanic (22 lignes en défaut sur 714 pour un âge
   entre 0 et 60). */
const COLS = [["PassengerId", "Entier"], ["Survived", "Entier"], ["Pclass", "Entier"], ["Name", "Texte"], ["Sex", "Texte"], ["Age", "Décimal"]];
const ROWS = [["34", "66.0"], ["55", "65.0"], ["97", "71.0"], ["117", "70.5"]];
const BRIEF = [
  { nom: "Types de règles", text: "Douze types de règles : non vide, unique, plage, format, valeurs autorisées, entre deux colonnes, type, doublons, valeurs aberrantes, colonne non constante, distribution, texte propre." },
  { nom: "Machine learning", text: "Des contrôles pour le machine learning : déséquilibre de la cible, fuite de cible, colonnes redondantes, écart entre entraînement et test." },
  { nom: "Ensembles", text: "Un ensemble de règles se sauvegarde, s'exporte en fichier .json et s'applique à un autre fichier : les colonnes sont retrouvées par leur nom." },
  { nom: "Rapport", text: "Un rapport HTML autonome résume les résultats ; il s'imprime en PDF depuis le navigateur." },
];
// la palette de Crible : encre, vermillon #E8432A et neutres teintés
const CR = { encre: "#1c1412", doux: "#5f524a", trait: "#ddd3c8", fond: "#f6f1ec", verm: "#e8432a", koFond: "#fbe1da", koTexte: "#a3321a", cause: "#fbd9d2", sel: "#fbe9e4" };
const font = (w: number, px: number) => `${w} ${Math.round(px * 1.22)}px "Instrument Sans"`;

type G = CanvasRenderingContext2D;
function panel(g: G, x: number, y: number, w: number, h: number) {
  g.fillStyle = "#fff"; g.beginPath(); g.roundRect(x, y, w, h, 10); g.fill();
  g.strokeStyle = CR.trait; g.lineWidth = 2; g.stroke();
}
function field(g: G, x: number, y: number, w: number, label: string, value: string) {
  g.fillStyle = CR.doux; g.font = font(400, 17); g.textAlign = "left"; g.fillText(label, x, y);
  g.fillStyle = "#fff"; g.beginPath(); g.roundRect(x, y + 8, w, 38, 6); g.fill();
  g.strokeStyle = CR.trait; g.lineWidth = 2; g.stroke();
  g.fillStyle = CR.encre; g.font = font(400, 21); g.fillText(value, x + 12, y + 28);
}
function pill(g: G, x: number, y: number, text: string, ko: boolean) {
  g.font = font(600, 16);
  const w = g.measureText(text).width + 22;
  g.fillStyle = ko ? CR.koFond : CR.fond; g.beginPath(); g.roundRect(x, y, w, 28, 14); g.fill();
  g.fillStyle = ko ? CR.koTexte : CR.doux; g.textAlign = "left"; g.fillText(text, x + 11, y + 15);
}
const chip = (g: G, x: number, y: number, t: string) => {
  const tw = g.measureText(t).width + 22;
  g.fillStyle = CR.fond; g.beginPath(); g.roundRect(x, y - 15, tw, 30, 15); g.fill();
  g.fillStyle = CR.encre; g.fillText(t, x + 11, y);
  return tw;
};

export function createCribleDemo(ctx: Ctx, hud: Hud): DemoScript {
  const fresh = () => ({ on: false, cols: 0, sel: false, form: false, typed: 0, rule: 0, run: 0, badge: false, rows: 0, brief: -1 });
  let c = fresh();
  const logo = new Image();
  logo.onload = () => { hud.state.dirty = true; };
  logo.src = cribleLogoUrl;

  const anim = (dur: number, fn: (k: number) => void) => ctx.anim.tween(dur, (k) => { fn(k); hud.state.dirty = true; });

  async function run(ok: () => boolean) {
    await hud.say("Bienvenue sur Crible. Il contrôle la qualité d'un jeu de données avant qu'on l'exploite en analyse ou en machine learning.", 1.2);
    if (!ok()) return false;
    c.on = true;
    let a = anim(1.8, (k) => { c.cols = Math.round(k * COLS.length); });
    await hud.say("Tu charges un fichier CSV ou Excel. Il est lu dans ton navigateur : rien n'est envoyé nulle part.", 0.8);
    if (!ok()) return false;
    await a;
    c.sel = true; c.form = true;
    a = anim(2.4, (k) => { c.typed = k; });
    await hud.say("Tu écris les règles que les données doivent respecter, depuis la fiche de chaque colonne : ici, un âge compris entre 0 et 60 ans.", 0.6);
    if (!ok()) return false;
    await a;
    c.form = false; c.rule = 1; c.run = 0;
    a = anim(1.6, (k) => { c.run = k; c.badge = k >= 1; });
    await hud.say("Crible exécute la règle et rend son verdict : 22 lignes en défaut sur 714 évaluées.", 0.5);
    if (!ok()) return false;
    await a;
    a = anim(1.6, (k) => { c.rows = Math.round(k * ROWS.length); });
    await hud.say("Un clic ouvre les lignes en défaut, avec la cellule en cause surlignée.", 0.8);
    if (!ok()) return false;
    await a;
    hud.state.title = "CRIBLE · EN BREF";
    for (let i = 0; i < BRIEF.length; i++) {
      c.brief = i; hud.state.dirty = true;
      await hud.say(BRIEF[i].text, 1.2);
      if (!ok()) return false;
    }
    return true;
  }

  function drawBrief(g: G, cx: number, cy: number, cw: number) {
    BRIEF.forEach((b, i) => {
      const y = cy + 92 + i * 64, done = i < c.brief || c.brief >= BRIEF.length, on = i === c.brief;
      g.fillStyle = on ? CR.encre : done ? "#2f7d4a" : "#8a7d74";
      g.font = font(on ? 700 : 600, 24); g.textAlign = "left"; g.textBaseline = "middle";
      g.fillText(`${done ? "✓" : on ? "▸" : "·"} ${b.nom}`, cx + 26, y);
    });
    if (c.brief >= BRIEF.length) return;
    const ox = cx + 300, oy = cy + 86, w = cw - 324, h = 380;
    panel(g, ox, oy, w, h);
    g.textBaseline = "middle"; g.textAlign = "left";
    if (c.brief === 0) {
      const chips = ["Non vide", "Unique", "Plage", "Format", "Valeurs autorisées", "Entre colonnes", "Type", "Doublons", "Aberrantes", "Non constante", "Distribution", "Texte propre"];
      let x = ox + 16, y = oy + 30;
      g.font = font(600, 17);
      for (const t of chips) {
        if (x + g.measureText(t).width + 22 > ox + w - 12) { x = ox + 16; y += 40; }
        x += chip(g, x, y, t) + 8;
      }
    } else if (c.brief === 1) {
      g.fillStyle = CR.doux; g.font = font(600, 16); g.fillText("CIBLE : SURVIVED", ox + 18, oy + 28);
      ([["0", 549, "#8a7d74"], ["1", 342, CR.verm]] as const).forEach(([k, n, col], i) => {
        const y = oy + 70 + i * 52;
        g.fillStyle = CR.encre; g.font = font(600, 20); g.fillText(k, ox + 18, y + 14);
        g.fillStyle = col; g.fillRect(ox + 48, y, (n / 549) * (w - 140), 28);
        g.fillStyle = CR.encre; g.font = font(400, 18); g.fillText(String(n), ox + 56 + (n / 549) * (w - 140), y + 14);
      });
      g.fillStyle = CR.encre; g.font = font(400, 19); g.fillText("Rapport classe rare / fréquente : 0,623", ox + 18, oy + 196);
      g.font = font(600, 16);
      ["Fuite de cible", "Colonnes redondantes", "Écart entraînement / test"].forEach((t, i) => chip(g, ox + 18, oy + 250 + i * 40, t));
    } else if (c.brief === 2) {
      const file = (x: number, y: number, name: string, sub: string) => {
        g.fillStyle = CR.fond; g.beginPath(); g.roundRect(x, y, w - 36, 78, 8); g.fill();
        g.fillStyle = CR.encre; g.font = font(600, 18); g.fillText(name, x + 14, y + 28);
        g.fillStyle = CR.doux; g.font = font(400, 16); g.fillText(sub, x + 14, y + 55);
      };
      file(ox + 18, oy + 24, "titanic.crible.json", "3 règles, rôles et seuils");
      g.fillStyle = CR.verm; g.font = font(700, 36); g.textAlign = "center"; g.fillText("↓", ox + w / 2, oy + 140); g.textAlign = "left";
      file(ox + 18, oy + 176, "autre_fichier.csv", "colonnes retrouvées par nom");
      g.fillStyle = CR.doux; g.font = font(400, 16); g.fillText("Colonne absente : règle écartée.", ox + 18, oy + 300);
    } else {
      g.fillStyle = CR.encre; g.font = font(700, 22); g.fillText("Rapport de qualité des données", ox + 20, oy + 36);
      g.fillStyle = CR.doux; g.font = font(400, 16); g.fillText("titanic.csv · 891 lignes · 12 colonnes", ox + 20, oy + 66);
      for (let i = 0; i < 3; i++) { g.fillStyle = CR.fond; g.fillRect(ox + 20, oy + 96 + i * 52, w - 40, 38); }
      g.fillStyle = CR.koFond; g.fillRect(ox + 20, oy + 96, w - 40, 38);
      g.fillStyle = CR.koTexte; g.font = font(600, 16); g.fillText("Échouée : « Age » ≥ 0 et ≤ 60", ox + 30, oy + 115);
      g.fillStyle = CR.doux; g.font = font(400, 16); g.fillText("rapport-crible-titanic.html", ox + 20, oy + 290);
    }
  }

  function drawCard(g: G, W: number) {
    if (!c.on) return;
    const cw = 650, ch = 500, cx = W - cw - 60, cy = 100;
    g.beginPath(); g.roundRect(cx, cy, cw, ch, 12); g.clip();
    g.fillStyle = CR.fond; g.fillRect(cx, cy, cw, ch);
    g.fillStyle = "#fff"; g.fillRect(cx, cy, cw, 64);
    g.fillStyle = CR.trait; g.fillRect(cx, cy + 64, cw, 2);
    if (logo.complete && logo.naturalWidth) {
      const lh = 40;
      g.drawImage(logo, cx + 22, cy + 12, lh * logo.naturalWidth / logo.naturalHeight, lh);
    }
    g.textBaseline = "middle"; g.textAlign = "right";
    if (c.cols > 0) { g.fillStyle = CR.doux; g.font = font(600, 18); g.fillText("titanic.csv · 891 lignes · 12 colonnes", cx + cw - 22, cy + 32); }
    g.textAlign = "left";

    if (c.brief >= 0) { drawBrief(g, cx, cy, cw); return; }

    // la liste des colonnes, comme dans l'onglet « Colonnes »
    const lx = cx + 20, ly = cy + 86, lw = 296;
    panel(g, lx, ly, lw, 250);
    g.fillStyle = CR.doux; g.font = font(600, 14); g.fillText("COLONNE", lx + 14, ly + 20); g.fillText("TYPE", lx + 158, ly + 20);
    COLS.forEach(([nom, type], i) => {
      if (i >= c.cols) return;
      const y = ly + 46 + i * 33, age = i === 5;
      if (age && c.sel) { g.fillStyle = CR.sel; g.fillRect(lx + 2, y - 15, lw - 4, 31); }
      g.fillStyle = CR.encre; g.font = font(age && c.sel ? 700 : 600, 18); g.fillText(nom, lx + 14, y);
      g.fillStyle = CR.doux; g.font = font(400, 16); g.fillText(type, lx + 158, y);
      if (age && c.badge) {
        g.fillStyle = CR.koFond; g.beginPath(); g.arc(lx + lw - 24, y, 12, 0, Math.PI * 2); g.fill();
        g.fillStyle = CR.koTexte; g.font = font(700, 15); g.textAlign = "center"; g.fillText("1", lx + lw - 24, y + 1); g.textAlign = "left";
      }
    });

    // la fiche de la colonne Age
    const rx = cx + 332, ry = ly, rw = cw - 352;
    if (c.sel) {
      panel(g, rx, ry, rw, 250);
      g.fillStyle = CR.encre; g.font = font(700, 26); g.fillText("Age", rx + 16, ry + 30);
      g.fillStyle = CR.doux; g.font = font(400, 16); g.fillText("891 lignes", rx + 16, ry + 56);
      if (c.form) {
        g.fillStyle = CR.doux; g.font = font(400, 15); g.fillText("Ajouter une règle", rx + 16, ry + 86);
        g.fillStyle = "#fff"; g.beginPath(); g.roundRect(rx + 16, ry + 94, rw - 32, 34, 6); g.fill(); g.strokeStyle = CR.trait; g.lineWidth = 2; g.stroke();
        g.fillStyle = CR.encre; g.font = font(400, 19); g.fillText("Plage de valeurs", rx + 28, ry + 112);
        // les bornes se tapent au clavier
        const min = c.typed > 0.15 ? "0" : "";
        const max = c.typed > 0.4 ? "60".slice(0, Math.ceil(Math.min(1, (c.typed - 0.4) / 0.35) * 2)) : "";
        field(g, rx + 16, ry + 156, (rw - 44) / 2, "Minimum", min);
        field(g, rx + 28 + (rw - 44) / 2, ry + 156, (rw - 44) / 2, "Maximum", max);
      }
      if (c.rule > 0) {
        const n = Math.round(22 * c.run), done = c.run >= 1;
        g.fillStyle = done ? CR.verm : CR.trait; g.fillRect(rx + 16, ry + 80, 4, 150);
        pill(g, rx + 30, ry + 86, done ? "Échouée : 22 lignes (3,08 %)" : c.run > 0 ? `Calcul… ${n}` : "Calcul…", done);
        g.fillStyle = CR.encre; g.font = font(400, 20); g.fillText("« Age » ≥ 0 et ≤ 60", rx + 30, ry + 140);
        g.fillStyle = CR.doux; g.font = font(400, 16); g.fillText(c.run > 0.15 ? `${n} sur 714 évaluées` : "", rx + 30, ry + 170);
        g.fillStyle = CR.doux; g.font = font(400, 15); g.fillText("bloquante", rx + 30, ry + 200);
      }
    }

    // les lignes en défaut, avec la cellule en cause surlignée
    if (c.rows > 0) {
      const by = cy + 350;
      panel(g, cx + 20, by, cw - 40, 134);
      g.fillStyle = CR.doux; g.font = font(600, 14);
      g.fillText("LIGNES EN DÉFAUT", cx + 34, by + 20);
      g.fillText("LIGNE", cx + 34, by + 44); g.fillText("AGE", cx + 34 + 220, by + 44);
      ROWS.forEach(([l, a], i) => {
        if (i >= c.rows) return;
        const y = by + 70 + i * 22;
        g.fillStyle = CR.cause; g.fillRect(cx + 34 + 210, y - 11, cw - 40 - 244, 22);
        g.fillStyle = CR.encre; g.font = '400 19px "IBM Plex Mono"';
        g.fillText(l, cx + 34, y); g.fillText(a, cx + 34 + 220, y);
      });
    }
  }

  return {
    key: "crible",
    steps: 5 + BRIEF.length,
    reset() { c = fresh(); },
    run,
    finish() { c.on = true; c.brief = BRIEF.length; },
    stop() { c = fresh(); },
    update() {},
    drawCard,
  };
}
