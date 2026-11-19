import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Ctx, PushButton, SwitchButton } from "../types";
import { mat } from "../util/textures";
import { shadowy, twoGroups } from "../util/geometry";
import { NAV } from "./navscreen";

export const PANEL_TILT = -0.62;

const stripes = (c: CanvasRenderingContext2D, W: number, H: number) => {
  c.fillStyle = "#d8ad18"; c.fillRect(0, 0, W, H);
  c.fillStyle = "#121212";
  for (let i = -W; i < W * 2; i += 48) {
    c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 24, 0); c.lineTo(i + 24 - H, H); c.lineTo(i - H, H); c.fill();
  }
};

/* la planche, inclinée vers le pilote, et ses deux ailes */
export function buildPanel(ctx: Ctx) {
  const { M, tex } = ctx;
  const panel = new THREE.Group();
  panel.position.set(0, -0.31, -0.8);
  panel.rotation.x = PANEL_TILT;
  ctx.cockpit.add(panel);
  ctx.panel = panel;
  ctx.buttons = {};
  ctx.needles = [];
  ctx.gaugeFaces = [];

  panel.add(shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.46, 0.06, 4, 0.014), M.paint)));
  const wings: Record<-1 | 1, THREE.Group> = { [-1]: new THREE.Group(), 1: new THREE.Group() };
  for (const side of [-1, 1] as const) {
    const wing = wings[side];
    wing.position.set(side * 0.45, 0, 0);
    wing.rotation.y = -side * 0.5;
    panel.add(wing);
    const w = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.46, 0.06, 4, 0.014), M.paint));
    w.position.x = side * 0.22;
    wing.add(w);
  }
  // tablier sous la planche, qui descend jusqu'au plancher
  const kick = shadowy(new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.5, 0.06, 3, 0.012), M.paintDark));
  kick.position.set(0, -0.68, -0.93);
  kick.rotation.x = 0.12;
  ctx.cockpit.add(kick);
  // filets de séparation peints, comme sur les vraies planches
  for (const y of [0.16, -0.07]) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.004), mat(0x2c3b39, 0.8));
    l.position.set(0, y, 0.0305);
    panel.add(l);
  }

  /* cadrans analogiques */
  function gauge(parent: THREE.Object3D, x: number, y: number, label: string, { r = 0.048, max = 10, unit = "" } = {}) {
    const g = new THREE.Group();
    g.position.set(x, y, 0.03);
    parent.add(g);
    const bez = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.009, r + 0.012, 0.02, 56), M.bezel));
    bez.rotation.x = Math.PI / 2;
    g.add(bez);
    const face = tex.canvas(512, 512, (c, W) => {
      c.fillStyle = "#121212"; c.fillRect(0, 0, W, W);
      c.translate(W / 2, W / 2);
      c.strokeStyle = "#ebe6d6"; c.fillStyle = "#ebe6d6";
      const a0 = -Math.PI * 1.25, span = Math.PI * 1.5;
      for (let i = 0; i <= 40; i++) {
        const a = a0 + i / 40 * span, big = i % 8 === 0, mid = i % 4 === 0;
        c.lineWidth = big ? 7 : mid ? 4 : 2.5;
        const r0 = big ? 168 : mid ? 182 : 192;
        c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * 222, Math.sin(a) * 222); c.stroke();
        if (big) {
          c.font = '600 54px "Barlow Condensed"'; c.textAlign = "center"; c.textBaseline = "middle";
          c.fillText(String(Math.round(i / 40 * max)), Math.cos(a) * 128, Math.sin(a) * 128);
        }
      }
      c.fillStyle = "#b5341f";     // zone rouge en bout d'échelle
      c.beginPath(); c.arc(0, 0, 222, a0 + span * 0.86, a0 + span, false); c.arc(0, 0, 204, a0 + span, a0 + span * 0.86, true); c.fill();
      c.textAlign = "center"; c.textBaseline = "middle";
      c.font = '700 44px "Barlow Condensed"'; c.fillStyle = "#d8b25a"; c.letterSpacing = "3px";
      c.fillText(label, 0, 112);
      if (unit) { c.font = '500 30px "Barlow Condensed"'; c.fillStyle = "#9b978a"; c.letterSpacing = "0px"; c.fillText(unit, 0, 66); }
    });
    const faceMat = mat(0xffffff, 0.5, 0, { map: face, emissive: 0xffd9a0, emissiveMap: face, emissiveIntensity: 0 });
    const f = new THREE.Mesh(new THREE.CircleGeometry(r, 56), faceMat);
    ctx.gaugeFaces.push(faceMat);
    f.position.z = 0.0105;
    g.add(f);
    const nd = new THREE.Mesh(new THREE.BoxGeometry(r * 0.07, r * 0.86, 0.0015), mat(0xf4efe2, 0.35, 0, { emissive: 0x302a20 }));
    nd.geometry.translate(0, r * 0.33, 0);
    nd.position.z = 0.0118;
    g.add(nd);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.13, r * 0.13, 0.004, 20), M.black);
    cap.rotation.x = Math.PI / 2; cap.position.z = 0.013;
    g.add(cap);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(r + 0.002, 56),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.1, depthWrite: false }));
    glass.position.z = 0.0145;
    g.add(glass);
    ctx.needles.push({ nd, base: -2.0 + Math.random() * 2.6, phase: Math.random() * 10, speed: 0.4 + Math.random() * 0.5 });
  }
  gauge(panel, -0.34, 0.06, "PRESS", { unit: "kPa ×10" });
  gauge(panel, 0.34, 0.06, "O₂", { max: 100, unit: "%" });
  gauge(panel, -0.34, -0.15, "BAT", { max: 30, unit: "V" });
  gauge(panel, 0.34, -0.15, "TEMP", { max: 40, unit: "°C" });
  gauge(wings[-1], -0.2, 0.06, "CAP", { r: 0.068, max: 360, unit: "°" });
  gauge(wings[1], 0.2, 0.06, "VITESSE", { r: 0.068, max: 20, unit: "km/s" });

  /* boutons-poussoirs lumineux à la manière des Korry d'aviation : légende gravée,
     éteinte au repos, allumée quand la fonction est active */
  function korry(parent: THREE.Object3D, key: string, x: number, y: number, lines: string[],
    { w = 0.09, h = 0.062, lit = "#ffb143", striped = false } = {}): PushButton {
    const g = new THREE.Group();
    g.position.set(x, y, 0.03);
    parent.add(g);
    if (striped) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.034, h + 0.034), mat(0xffffff, 0.6, 0, { map: tex.canvas(256, 256, stripes) }));
      s.position.z = 0.0008;
      g.add(s);
    }
    const housing = shadowy(new THREE.Mesh(new RoundedBoxGeometry(w + 0.012, h + 0.012, 0.018, 3, 0.004), M.bezel));
    housing.position.z = 0.009;
    g.add(housing);
    const legend = tex.canvas(512, Math.round(512 * h / w), (c, W, H) => {
      c.fillStyle = "#151515"; c.fillRect(0, 0, W, H);
      c.fillStyle = "#e6e0cf"; c.textAlign = "center"; c.textBaseline = "middle";
      c.font = `700 ${lines.length > 1 ? 104 : 124}px "Barlow Condensed"`; c.letterSpacing = "8px";
      lines.forEach((l, i) => c.fillText(l, W / 2 + 4, H / 2 + 8 + (i - (lines.length - 1) / 2) * 112));
    });
    const capMat = mat(0xffffff, 0.32, 0, { map: legend, emissive: new THREE.Color(lit), emissiveMap: legend, emissiveIntensity: 0 });
    const cap = shadowy(new THREE.Mesh(twoGroups(new RoundedBoxGeometry(w, h, 0.022, 3, 0.005), 4), [M.black, capMat]));
    cap.position.z = 0.024;
    g.add(cap);
    const b: PushButton = { key, group: g, cap, capMat, depth: 0, on: false };
    cap.userData.button = b;
    ctx.buttons[key] = b;
    return b;
  }
  /* la rangée de commandes de navigation : choisir le projet (précédent, suivant) sur
     l'écran, puis ENGAGER */
  korry(panel, "dossier", -0.215, -0.155, ["DOSSIER"], { w: 0.076 });
  korry(panel, "nav_prev", -0.122, -0.155, ["PROJET", "PRÉC."], { w: 0.076 });
  korry(panel, "engage", 0, -0.155, ["ENGAGER"], { w: 0.092, h: 0.072, striped: true });
  korry(panel, "nav_next", 0.122, -0.155, ["PROJET", "SUIV."], { w: 0.076 });
  korry(panel, "contact", 0.215, -0.155, ["CONTACT"], { w: 0.076 });

  // aile gauche : les compétences, une touche chacune
  ([["claude", ["CLAUDE"]], ["python", ["PYTHON"]], ["sql", ["SQL"]], ["ml", ["MACHINE", "LEARNING"]]] as const)
    .forEach(([k, legend], i) => korry(wings[-1], k, -(0.07 + i * 0.088), -0.135, [...legend], { w: 0.074, h: 0.052 }));
  const skillTag = tex.placard("COMPÉTENCES", 0.12, 0.016, { color: "#d8ad18" });
  skillTag.position.set(-0.2, -0.185, 0.031);
  wings[-1].add(skillTag);

  // aile droite : deux compétences, puis l'éclairage de cabine et l'éjection
  korry(wings[1], "web", 0.07, -0.135, ["TS", "REACT"], { w: 0.074, h: 0.052 });
  korry(wings[1], "java", 0.158, -0.135, ["JAVA"], { w: 0.074, h: 0.052 });

  // zone de clic invisible, plus large que la commande, pour les petites pièces
  function hitbox(parent: THREE.Object3D, key: string, w: number, h: number, d: number,
    kind: SwitchButton["kind"], lever: THREE.Mesh, hinge?: THREE.Group): SwitchButton {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 1, 0.002),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    parent.add(m);
    const b: SwitchButton = { key, cap: m, kind, lever, hinge };
    m.userData.button = b;
    ctx.buttons[key] = b;
    return b;
  }
  {
    // FEUX CABINE : un vrai inverseur, levier en haut = cabine allumée
    const g = new THREE.Group();
    g.position.set(0.25, -0.13, 0.03);
    wings[1].add(g);
    const plate = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.006, 24), M.chrome));
    plate.rotation.x = Math.PI / 2; g.add(plate);
    const lever = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.005, 0.034, 14), M.chrome));
    lever.geometry.translate(0, 0.017, 0);
    lever.rotation.x = ctx.boot ? 0.55 : -0.55;     // en bas tant que le cockpit n'est pas allumé
    lever.userData.moving = true;
    g.add(lever);
    const pl = tex.placard("FEUX CABINE", 0.08, 0.017);
    pl.position.set(0, -0.036, 0.001);
    g.add(pl);
    hitbox(g, "lights", 0.05, 0.06, 0.05, "toggle", lever).cap.position.set(0, 0.006, 0.02);
  }
  {
    // ÉJECTION : interrupteur rouge sous capot, sur fond rayé
    const g = new THREE.Group();
    g.position.set(0.345, -0.13, 0.03);
    wings[1].add(g);
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.06), mat(0xffffff, 0.6, 0, { map: tex.canvas(256, 256, stripes) }));
    bg.position.set(0, 0.004, 0.0008); g.add(bg);
    const lever = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.0036, 0.005, 0.03, 14), M.red));
    lever.geometry.translate(0, 0.015, 0);
    lever.rotation.x = 0.5;
    g.add(lever);
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.03, 0.004);
    g.add(hinge);
    const cover = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.036, 0.054, 0.02, 2, 0.005),
      new THREE.MeshPhysicalMaterial({ color: 0xc0281f, roughness: 0.25, transparent: true, opacity: 0.78 })));
    cover.position.set(0, -0.027, 0.012);
    hinge.add(cover);
    const pl = tex.placard("ÉJECTION", 0.07, 0.017, { color: "#ff8a7a" });
    pl.position.set(0, -0.04, 0.001);
    g.add(pl);
    hitbox(g, "eject", 0.05, 0.065, 0.05, "guard", lever, hinge).cap.position.set(0, 0.004, 0.02);
  }

  /* écran de navigation, à la place du globe : la liste des projets, dessinée dans un
     canevas par actions/nav.ts. Un afficheur à plat, sous une vitre */
  {
    const SW = 0.44, SH = 0.19;
    const g = new THREE.Group();
    g.position.set(0, 0.045, 0.03);
    panel.add(g);
    const frame = shadowy(new THREE.Mesh(new RoundedBoxGeometry(SW + 0.03, SH + 0.03, 0.02, 3, 0.008), M.bezel));
    frame.position.z = 0.006;
    g.add(frame);
    const map = tex.canvas(NAV.w, NAV.h, (c, W, H) => { c.fillStyle = "#0b0d0c"; c.fillRect(0, 0, W, H); });
    const screenMat = new THREE.MeshBasicMaterial({ map, toneMapped: false, color: 0x0b0b0b });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenMat);
    mesh.position.z = 0.0165;
    mesh.userData.skip = true;
    g.add(mesh);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transparent: true, opacity: 0.07, depthWrite: false }));
    glass.position.z = 0.018;
    glass.userData.skip = true;
    g.add(glass);
    ctx.navScreen = { mesh, canvas: map.image as HTMLCanvasElement, tex: map, mat: screenMat };
  }
}

/** à chaque image : aiguilles, enfoncement et rétroéclairage des boutons */
export function updatePanel(ctx: Ctx, t: number, dt: number) {
  const { power, night } = ctx;
  // aiguilles : légère vie au repos ; pendant le test d'allumage, montée en bout d'échelle (-3π/4)
  for (const n of ctx.needles) {
    const idle = n.base + (ctx.reduced ? 0 : Math.sin(t * n.speed + n.phase) * 0.025) * power.k;
    n.nd.rotation.z = THREE.MathUtils.lerp(idle, -2.356, power.test);
  }
  for (const b of Object.values(ctx.buttons)) {
    if (b.kind) continue;
    b.cap.position.z += ((b.depth ? 0.016 : 0.024) - b.cap.position.z) * Math.min(1, dt * 30);
    const glow = b.on || power.lamp === b.key ? 2.4 : night.k * 0.32 * power.k;
    b.capMat.emissiveIntensity += (glow - b.capMat.emissiveIntensity) * Math.min(1, dt * 8);
  }
  // l'écran de navigation s'allume avec le reste du poste
  ctx.navScreen.mat.color.setScalar(0.04 + 0.96 * power.k);
}
