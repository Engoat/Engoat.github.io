import * as THREE from "three";
import type { Ctx } from "../types";
import type { Hud } from "./hud";
import type { DemoScript } from "./director";
import { mat } from "../util/textures";

/* Pour se poser sur Nexus, on fait la queue au guichet : c'est l'atelier des files
   d'attente de l'application, vécu de l'intérieur. La file est une vraie simulation
   (un guichet, arrivées et services tirés au hasard, servis dans l'ordre d'arrivée),
   en minutes, rejouée en accéléré. En arrivant, le pilote mesure la file et en déduit,
   par la loi de Little, son attente. */
interface Ship { arrive: number; start: number; end: number; service: number }

const SIM = (() => {
  const N = 14, LAMBDA = 0.5, MU = 0.62, US = 6;
  const run = (seedStart: number) => {
    let a = seedStart >>> 0;
    // mulberry32 : générateur à graine, même file à chaque visite
    const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const exp = (rate: number) => -Math.log(1 - rnd()) / rate;
    const ships: Ship[] = [];
    let t = 0, free = 0;
    for (let i = 0; i < N; i++) {
      t += exp(LAMBDA);
      const service = exp(MU);
      const start = Math.max(t, free);
      free = start + service;
      ships.push({ arrive: t, start, end: free, service });
    }
    return ships;
  };
  // ce que la tour a observé avant notre arrivée, depuis le premier vaisseau :
  // longueur moyenne de la file d'attente Lq (hors guichet) et rythme λ des arrivées ;
  // la loi de Little donne l'attente moyenne Wq = Lq / λ
  const observe = (sh: Ship[]) => {
    const t0 = sh[0].arrive, t1 = sh[US].arrive, T = t1 - t0;
    const area = sh.slice(0, US).reduce((x, v) => x + Math.max(0, Math.min(v.start, t1) - v.arrive), 0);
    const Lq = area / T, lambda = US / T;
    return { Lq, lambda, Wq: Lq / lambda };
  };
  // on garde le premier tirage où il y a vraiment une file devant nous
  let ships: Ship[] | null = null;
  for (let seed = 1; seed < 2000; seed++) {
    const sh = run(seed), me = sh[US];
    const ahead = sh.filter((x, i) => i < US && x.end > me.arrive).length;
    const wait = me.start - me.arrive, est = observe(sh).Wq;
    if (ahead >= 3 && ahead <= 4 && wait > 5 && wait < 14 && Math.abs(est - wait) / wait < 0.2) { ships = sh; break; }
  }
  ships = ships ?? run(7);
  return { ships, US, measures: observe(ships) };
})();

function simState(t: number) {
  const { ships, US } = SIM;
  const waiting = ships.map((sh, i) => ({ sh, i })).filter(({ sh }) => sh.arrive <= t && sh.start > t);
  const serving = ships.findIndex((sh) => sh.start <= t && sh.end > t);
  const rankOf = (i: number) => waiting.findIndex((w) => w.i === i);
  return { waiting, serving, rankOf, behind: waiting.filter((w) => w.i > US).length };
}

/* les fonctionnalités, une par une : à gauche la liste, à droite un petit dessin de
   l'écran correspondant */
const FEATURES = [
  { name: "Éditeur", text: "L'éditeur : tu dessines un graphe à la souris (sommets, arêtes, poids, sens) ou tu en génères un parmi huit formes." },
  { name: "8 algorithmes", text: "Huit algorithmes : parcours en largeur et en profondeur, Dijkstra, Bellman-Ford, Kruskal, Prim, tri topologique, flot maximal." },
  { name: "Pas à pas", text: "Tu suis chaque algorithme étape par étape, en avant ou en arrière : les sommets changent de couleur et la ligne de pseudocode active s'allume." },
  { name: "Questions", text: "Le mode question te fait deviner la décision suivante avant de la montrer. Deux algorithmes peuvent aussi tourner côte à côte sur le même graphe." },
  { name: "Files · cours", text: "L'atelier des files simule un guichet avec des services exponentiels, constants ou d'Erlang, et calcule ses mesures. Chaque algorithme a sa page de cours." },
];

// un petit vaisseau, vu de l'arrière : moteur allumé vers nous
function makeShip() {
  const g = new THREE.Group();
  const hull = mat(0xb4bcb2, 0.5, 0.3, { emissive: 0x434a45 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 1.3, 20), hull);
  body.rotation.x = Math.PI / 2; g.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), hull);
  nose.rotation.x = -Math.PI / 2; nose.position.z = -0.65; g.add(nose);
  // tuyère, au fond de laquelle brûle le moteur
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.22, 20, 1, true), mat(0x3a3d40, 0.5, 0.6, { side: THREE.DoubleSide }));
  nozzle.rotation.x = Math.PI / 2; nozzle.position.z = 0.74; g.add(nozzle);
  const panelM = mat(0x2a3b5e, 0.35, 0.5, { emissive: 0x1a2640 });
  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.62, 0.04), panelM);
    wing.position.set(sx * 1.05, 0, 0.1); g.add(wing);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), hull);
    strut.rotation.z = Math.PI / 2; strut.position.set(sx * 0.42, 0, 0.1); g.add(strut);
  }
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20), new THREE.MeshBasicMaterial({ color: 0xff9a4a, toneMapped: false, transparent: true, opacity: 0.85 }));
  glow.position.z = 0.7; g.add(glow);
  for (const [x, c] of [[-1.7, 0xff3b30], [1.7, 0x34c759]]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
    l.position.set(x, 0.33, 0.1); g.add(l);
  }
  g.scale.setScalar(0.9);
  return g;
}

const f2 = (v: number) => v.toFixed(2).replace(".", ",");
function person(g: CanvasRenderingContext2D, x: number, y: number, color: string, me: boolean) {
  g.fillStyle = color; g.strokeStyle = "#1b3a6b"; g.lineWidth = 2.5;
  g.beginPath(); g.roundRect(x - 16, y + 4, 32, 40, [12, 12, 4, 4]); g.fill(); g.stroke();
  g.fillStyle = "#fdfdfb"; g.beginPath(); g.arc(x, y - 10, 13, 0, Math.PI * 2); g.fill(); g.stroke();
  if (me) { g.fillStyle = "#c62b22"; g.font = '700 22px "IBM Plex Mono"'; g.textAlign = "center"; g.fillText("toi", x, y - 50); }
}

export function createNexusDemo(ctx: Ctx, hud: Hud): DemoScript {
  const QDIR = new THREE.Vector3(0.02, 0.16, -1).normalize();
  const SLOT_GAP = 3.4, US_GAP = 3.6;
  // milestone : l'instant de la simulation qu'on attend (notre tour, puis la fin du service)
  const s = { card: false, feat: -1, playing: false, simT: 0, speed: 1, usS: 0, milestone: 0 };

  const dock = new THREE.Group();
  dock.visible = false;
  ctx.scene.add(dock);
  const ships = SIM.ships.map((_, i) => {
    const m = makeShip();
    m.visible = false;
    m.userData.lane = (i % 2 ? 1 : -1) * 1.1;
    dock.add(m);
    return m;
  });
  // le guichet : un anneau d'amarrage balisé
  const station = new THREE.Group();
  dock.add(station);
  station.add(new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.14, 14, 64), mat(0x6b7270, 0.45, 0.6)));
  const beacons: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb143, toneMapped: false }));
    const a = i / 6 * Math.PI * 2;
    b.position.set(Math.cos(a) * 2.3, Math.sin(a) * 2.3, 0.15);
    station.add(b); beacons.push(b);
  }
  const sign = ctx.tex.placard("GUICHET 1", 1.8, 0.42, { color: "#f1ede2", bg: "#1b3a6b" });
  sign.position.set(3.4, 0.9, 0);
  station.add(sign);

  // position monde d'un point de la file : s = 0 au guichet, s croît vers nous
  const _lane = new THREE.Vector3();
  const queuePoint = (sCoord: number, lane: number, out: THREE.Vector3) =>
    out.copy(ctx.camera.position).addScaledVector(QDIR, US_GAP + s.usS - sCoord).add(_lane.set(lane, 0, 0));

  const me = SIM.ships[SIM.US];
  function reset() {
    station.visible = true;
    s.card = false; s.feat = -1; s.playing = false;
    s.simT = me.arrive + 0.001;
    s.usS = SLOT_GAP * (simState(s.simT).rankOf(SIM.US) + 1);
    ships.forEach((m) => { m.visible = false; m.userData.placed = false; });
    dock.visible = true;
  }

  async function run(ok: () => boolean) {
    await hud.say("Bienvenue sur Nexus, un atelier pour apprendre l'algorithmique en regardant les algorithmes travailler, étape par étape.", 1.4);
    if (!ok()) return false;
    s.card = true;
    await hud.say("Avant de te poser, tu fais la queue au guichet : c'est l'atelier des files d'attente de Nexus, simulé arrivée après arrivée.", 0.8);
    if (!ok()) return false;
    // la file avance jusqu'à notre tour, en accéléré
    s.speed = (me.start - me.arrive) / 10;
    s.milestone = me.start;
    s.playing = true;
    await hud.say("Les files d'attente relèvent des probabilités ; la recherche opérationnelle s'en sert pour dimensionner guichets et réseaux.", 1);
    if (!ok()) return false;
    await hud.say("Combien de temps avant ton tour ? La loi de Little relie la longueur moyenne de la file Lq au rythme des arrivées λ : l'attente moyenne vaut Wq = Lq / λ.");
    if (!ok()) return false;
    while (ok() && s.simT < me.start) await ctx.anim.wait(0.1);
    if (!ok()) return false;
    s.speed = (me.end - me.start) / 2;
    s.milestone = me.end;
    await hud.say("À toi : le guichet t'accueille.");
    while (ok() && s.simT < me.end) await ctx.anim.wait(0.1);
    if (!ok()) return false;
    s.playing = false;

    // atterrissage accordé : la tour présente le reste de l'application
    s.card = false;
    ships.forEach((m) => { m.visible = false; });
    station.visible = false;
    hud.state.title = "NEXUS · EN BREF";
    for (let i = 0; i < FEATURES.length; i++) {
      s.feat = i; hud.state.dirty = true;
      await hud.say(FEATURES[i].text, 1.2);
      if (!ok()) return false;
    }
    return true;
  }

  function finish() {
    s.playing = false; s.card = false;
    s.feat = FEATURES.length;
    ships.forEach((m) => { m.visible = false; });
    station.visible = false;
  }

  function stop() {
    s.playing = false;
    dock.visible = false;
    station.visible = true;
  }

  function update(dt: number) {
    if (s.playing) { s.simT += dt * s.speed; hud.state.dirty = true; }
    const st = simState(s.simT);
    // notre vaisseau avance : on se rapproche du guichet quand la file avance
    const usRank = s.simT >= me.start ? -1 : s.simT < me.arrive ? st.waiting.length : st.rankOf(SIM.US);
    const usTarget = usRank < 0 ? 0 : SLOT_GAP * (usRank + 1);
    s.usS += (usTarget - s.usS) * Math.min(1, dt * 1.8);
    // le guichet, et ses balises qui clignotent
    queuePoint(0, 0, station.position);
    station.lookAt(ctx.camera.position);
    beacons.forEach((b, i) => { b.visible = Math.sin(ctx.anim.time / 300 + i) > -0.2; });
    // les autres vaisseaux devant nous
    SIM.ships.forEach((sh, i) => {
      const m = ships[i];
      if (i >= SIM.US || !s.card) { m.visible = false; return; }
      let sTarget: number | null = null, lane: number = m.userData.lane;
      if (sh.arrive <= s.simT && sh.start > s.simT) sTarget = SLOT_GAP * (st.rankOf(i) + 1);
      else if (sh.start <= s.simT && sh.end > s.simT) { sTarget = 0; lane = 0; }
      const left = s.simT - sh.end;
      if (sTarget === null && (left < 0 || left > 4 * s.speed + 6)) { m.visible = false; m.userData.placed = false; return; }
      m.visible = true;
      const target = new THREE.Vector3();
      if (sTarget !== null) queuePoint(sTarget, lane, target);
      else {
        // servi : il plonge vers la planète
        queuePoint(0, 0, target);
        const k = Math.min(1, left / (2.5 * Math.max(s.speed, 0.3)));
        target.add(new THREE.Vector3(0, -7 * k, -9 * k));
      }
      if (!m.userData.placed) { m.position.copy(target); m.userData.placed = true; }
      m.position.lerp(target, Math.min(1, dt * 2.2));
      m.lookAt(m.position.clone().sub(QDIR));
      m.rotateZ((i % 2 ? 1 : -1) * 0.35);
    });
  }

  function drawQueueCard(g: CanvasRenderingContext2D, cx: number, cy: number, cw: number) {
    const st = simState(s.simT);
    // le guichet, à droite, et la file qui s'allonge vers la gauche
    const deskX = cx + cw - 150, deskY = cy + 96;
    g.strokeStyle = "#1b3a6b"; g.lineWidth = 3; g.fillStyle = "#f0eee5";
    g.beginPath(); g.roundRect(deskX, deskY, 110, 110, 8); g.fill(); g.stroke();
    g.fillStyle = "#1b3a6b"; g.font = '600 20px "IBM Plex Mono"'; g.textAlign = "center";
    g.fillText("GUICHET", deskX + 55, deskY + 120);
    if (st.serving >= 0) person(g, deskX + 55, deskY + 48, "#19683d", st.serving === SIM.US);
    st.waiting.forEach((w, r) => {
      const x = deskX - 50 - r * 52;
      if (x > cx + 30) person(g, x, deskY + 48, "#2a51a3", w.i === SIM.US);
    });
    g.textAlign = "left";
    const m = SIM.measures;
    g.fillStyle = "#1b3a6b"; g.font = '500 25px "IBM Plex Mono"';
    g.fillText(`Lq = ${f2(m.Lq)}  vaisseaux en file`, cx + 28, cy + 262);
    g.fillText(`λ  = ${f2(m.lambda)} arrivée / min`, cx + 28, cy + 296);
    g.font = '600 25px "IBM Plex Mono"';
    g.fillText(`Wq = Lq / λ ≈ ${f2(m.Wq)} min`, cx + 28, cy + 330);
    g.fillStyle = "#c62b22";
    const left = m.Wq - (s.simT - me.arrive);
    g.fillText(s.simT >= me.start ? "C'est ton tour." : left > 0.05 ? `Ton tour dans ≈ ${f2(left)} min` : "Ton tour approche.", cx + 28, cy + 372);
  }

  function drawFeatures(g: CanvasRenderingContext2D, cx: number, cy: number, cw: number, ch: number) {
    FEATURES.forEach((ft, i) => {
      const y = cy + 82 + i * 62, on = i === s.feat, done = i < s.feat;
      g.fillStyle = on ? "#1b3a6b" : done ? "#19683d" : "#8a8a80";
      g.font = `${on ? 600 : 500} 25px "IBM Plex Mono"`;
      g.fillText(`${done ? "✓" : on ? "▸" : "·"} ${ft.name}`, cx + 28, y);
    });
    // le dessin, à droite
    const ox = cx + 300, oy = cy + 70, w = cw - 330, h = ch - 110;
    if (s.feat >= FEATURES.length) return;
    g.strokeStyle = "#d9d5c6"; g.lineWidth = 2; g.strokeRect(ox, oy, w, h);
    const node = (x: number, y: number, fill: string, label: string) => {
      g.fillStyle = fill; g.strokeStyle = fill === "#fdfdfb" ? "#57574f" : fill; g.lineWidth = 3;
      g.beginPath(); g.arc(x, y, 17, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = fill === "#fdfdfb" ? "#57574f" : "#fdfdfb"; g.font = '600 18px "IBM Plex Mono"'; g.textAlign = "center";
      g.fillText(label, x, y - 9); g.textAlign = "left";
    };
    const edge = (a: number[], b: number[], col = "#57574f", wd = 3) => { g.strokeStyle = col; g.lineWidth = wd; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
    const P = [[ox + 50, oy + 60], [ox + 150, oy + 50], [ox + 90, oy + 150], [ox + 200, oy + 140], [ox + 140, oy + 230]];
    const f = s.feat;
    if (f === 0) {
      edge(P[0], P[1]); edge(P[0], P[2]); edge(P[1], P[3]);
      g.setLineDash([8, 7]); edge(P[3], [ox + 168, oy + 212], "#2a51a3"); g.setLineDash([]);
      ["A", "B", "C", "D"].forEach((l, i) => node(P[i][0], P[i][1], "#fdfdfb", l));
      // le pointeur de la souris
      g.fillStyle = "#1b3a6b"; g.beginPath(); g.moveTo(ox + 168, oy + 212); g.lineTo(ox + 168, oy + 240); g.lineTo(ox + 176, oy + 232); g.lineTo(ox + 186, oy + 248); g.lineTo(ox + 191, oy + 245); g.lineTo(ox + 181, oy + 229); g.lineTo(ox + 192, oy + 229); g.closePath(); g.fill();
    } else if (f === 1) {
      g.fillStyle = "#1b3a6b"; g.font = '500 18px "IBM Plex Mono"';
      ["Largeur", "Profondeur", "Dijkstra", "Bellman-Ford", "Kruskal", "Prim", "Tri topo.", "Flot max."].forEach((n, i) => g.fillText(n, ox + 16 + (i % 2) * 118, oy + 22 + Math.floor(i / 2) * 64));
    } else if (f === 2) {
      edge(P[0], P[1], "#653a9b", 5); edge(P[0], P[2], "#653a9b", 5); edge(P[1], P[3]); edge(P[2], P[4]);
      node(P[0][0], P[0][1], "#19683d", "A"); node(P[1][0], P[1][1], "#c62b22", "B");
      node(P[2][0], P[2][1], "#2a51a3", "C"); node(P[3][0], P[3][1], "#fdfdfb", "D"); node(P[4][0], P[4][1], "#fdfdfb", "E");
      g.fillStyle = "#f0eee5"; g.fillRect(ox + 8, oy + h - 34, w - 16, 26);
      g.fillStyle = "#1b3a6b"; g.font = '500 16px "IBM Plex Mono"'; g.fillText("pour chaque voisin v de u", ox + 14, oy + h - 30);
    } else if (f === 3) {
      edge(P[0], P[1]); edge(P[0], P[2]);
      node(P[0][0], P[0][1], "#19683d", "A"); node(P[1][0], P[1][1], "#fdfdfb", "B"); node(P[2][0], P[2][1], "#fdfdfb", "C");
      g.setLineDash([6, 6]); g.strokeStyle = "#c62b22"; g.lineWidth = 3;
      g.beginPath(); g.arc(P[1][0], P[1][1], 28, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      g.fillStyle = "#c62b22"; g.font = '700 26px "IBM Plex Mono"'; g.fillText("?", P[1][0] + 32, P[1][1] - 22);
      g.strokeStyle = "#8a8a80"; g.lineWidth = 2; g.strokeRect(ox + 10, oy + 196, w / 2 - 16, 70); g.strokeRect(ox + w / 2 + 6, oy + 196, w / 2 - 16, 70);
      g.fillStyle = "#57574f"; g.font = '500 15px "IBM Plex Mono"'; g.fillText("Prim", ox + 18, oy + 204); g.fillText("Kruskal", ox + w / 2 + 14, oy + 204);
    } else if (f === 4) {
      g.strokeStyle = "#1b3a6b"; g.lineWidth = 3; g.fillStyle = "#f0eee5";
      g.beginPath(); g.roundRect(ox + w - 80, oy + 40, 64, 70, 6); g.fill(); g.stroke();
      person(g, ox + w - 48, oy + 72, "#19683d", false);
      [0, 1, 2].forEach((r) => person(g, ox + w - 120 - r * 44, oy + 72, "#2a51a3", false));
      g.fillStyle = "#fdfdfb"; g.strokeStyle = "#57574f"; g.lineWidth = 2;
      g.beginPath(); g.roundRect(ox + 20, oy + 170, 90, 80, 4); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(ox + 65, oy + 170); g.lineTo(ox + 65, oy + 250); g.stroke();
      g.fillStyle = "#57574f"; g.font = '500 15px "IBM Plex Mono"'; g.fillText("cours", ox + 125, oy + 200);
    }
  }

  /** la fiche, à la manière de l'écran de Nexus : papier réglé, encres */
  function drawCard(g: CanvasRenderingContext2D, W: number) {
    if (!s.card && s.feat < 0) return;
    const cw = 600, ch = 420, cx = W - cw - 70, cy = 112;
    g.fillStyle = "#fdfdfb"; g.beginPath(); g.roundRect(cx, cy, cw, ch, 10); g.fill();
    g.save(); g.beginPath(); g.roundRect(cx, cy, cw, ch, 10); g.clip();
    for (let y = cy + 32; y < cy + ch; y += 32) { g.fillStyle = (y - cy) % 128 === 0 ? "#a6b7e5" : "#d4ddf3"; g.fillRect(cx, y, cw, (y - cy) % 128 === 0 ? 2 : 1); }
    g.restore();
    g.fillStyle = "#57574f"; g.font = '600 22px "IBM Plex Mono"'; g.letterSpacing = "4px";
    g.fillText(s.feat >= 0 ? "NEXUS · EN BREF" : "ATELIER · FILE D'ATTENTE", cx + 28, cy + 24);
    g.letterSpacing = "0px";
    if (s.feat >= 0) drawFeatures(g, cx, cy, cw, ch); else drawQueueCard(g, cx, cy, cw);
  }

  return {
    key: "nexus",
    steps: 5 + FEATURES.length,
    reset, run, finish, stop, update, drawCard,
    // « Suivant » pendant que la file avance : on saute à l'instant attendu
    skip() { if (s.playing) s.simT = Math.max(s.simT, s.milestone); },
  };
}
