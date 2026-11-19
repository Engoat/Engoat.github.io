import * as THREE from "three";
import type { CaptionItem, Ctx } from "../types";
import { mat } from "../util/textures";
import { SLOT } from "../world/console";
import { EMAIL, GITHUB, IN_PROGRESS, PERSON, PROJECTS, SKILLS, SKILL_LINES, bare } from "../../content/profile";

/* Le ruban de l'imprimante de bord. Conventions des lignes :
   "# " titre, "! " gras, "## " rubrique, "> " renvoi, "--" filet, "" blanc. */
const SLIPS: Record<string, string[]> = {
  dossier: [
    "# DOSSIER PILOTE", "--",
    "! " + PERSON.name.toUpperCase(),
    PERSON.lead, PERSON.place + ".", "",
    "## PROFIL", PERSON.profile, "",
    "## COMPÉTENCES", ...SKILL_LINES, "",
    "## PROJETS",
    ...PROJECTS.flatMap((p) => ["! " + p.name.toUpperCase(), p.slip, `> → bouton ENGAGER ${p.name.toUpperCase()}`, `> code : ${bare(p.repo)}`, ""]).slice(0, -1),
    "",
    "## EN COURS",
    "! " + IN_PROGRESS.name.toUpperCase(), IN_PROGRESS.slip,
    "--",
    `> GitHub : ${bare(GITHUB)}`,
    "> Contact : bouton CONTACT",
  ],
  ...Object.fromEntries(SKILLS.map((s) => [s.key, [
    "## COMPÉTENCE", "# " + s.title.toUpperCase(), "--", s.text, "--", `> ${PERSON.name.toUpperCase()} · dossier pilote`,
  ]])),
  contact: [
    "# CONTACT", "--",
    "! " + PERSON.name.toUpperCase(),
    "Un message, une question :", "",
    "! " + EMAIL,
    "! " + bare(GITHUB), "--",
    "> Adresse et lien en bas",
    "> de l'écran.",
  ],
};
export const SLIP_KEYS = Object.keys(SLIPS);

const SLIP = { w: 0.16, R: 1.4, tilt: 0.36, pxPerM: 4000 };

export function createSlip(ctx: Ctx) {
  const geo = new THREE.PlaneGeometry(SLIP.w, 1, 1, 80);
  const material = mat(0xffffff, 0.92, 0, { side: THREE.DoubleSide, transparent: true });
  // le haut du ruban passe derrière la boule du globe : quand on le lit, rien ne doit le masquer
  material.depthTest = false;
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.visible = false;
  mesh.renderOrder = 10;
  ctx.printer.add(mesh);
  const state = { open: null as string | null, len: 0, max: 0.25 };

  /* le ruban fait la longueur de son texte */
  function draw(lines: string[]) {
    const W = Math.round(SLIP.w * SLIP.pxPerM);
    const H0 = 3000;
    const c = document.createElement("canvas");
    c.width = W; c.height = H0;
    const g = c.getContext("2d")!;
    g.fillStyle = "#f4f0e6"; g.fillRect(0, 0, W, H0);
    g.fillStyle = "rgba(0,0,0,.045)"; for (let yy = 0; yy < H0; yy += 6) g.fillRect(0, yy, W, 1);
    g.textBaseline = "top";
    let y = 46;
    for (const l of lines) {
      if (l === "--") { g.fillStyle = "#8a8474"; g.fillRect(28, y + 4, W - 56, 2); y += 30; continue; }
      if (l === "") { y += 22; continue; }
      const kind = l.startsWith("## ") ? "sec" : l.startsWith("# ") ? "h" : l.startsWith("! ") ? "b" : l.startsWith("> ") ? "ref" : "p";
      const text = kind === "p" ? l : l.slice(kind === "sec" ? 3 : 2);
      g.letterSpacing = "0px";
      if (kind === "h") { g.font = '600 46px "IBM Plex Mono"'; g.fillStyle = "#111"; }
      else if (kind === "b") { g.font = '600 36px "IBM Plex Mono"'; g.fillStyle = "#111"; }
      else if (kind === "sec") { g.font = '600 26px "IBM Plex Mono"'; g.fillStyle = "#c62b22"; g.letterSpacing = "5px"; }
      else if (kind === "ref") { g.font = '500 28px "IBM Plex Mono"'; g.fillStyle = "#1b3a6b"; }
      else { g.font = '500 31px "IBM Plex Mono"'; g.fillStyle = "#26241f"; }
      // coupe automatique à la largeur du ruban
      const step = { h: 66, b: 48, sec: 44, ref: 42, p: 43 }[kind];
      let line = "";
      for (const w of text.split(" ")) {
        const t = line ? line + " " + w : w;
        if (g.measureText(t).width > W - 56 && line) { g.fillText(line, 28, y); y += step; line = w; }
        else line = t;
      }
      g.fillText(line, 28, y);
      y += step;
    }
    y += 40;
    g.fillStyle = "#8a8474"; g.font = '500 22px "IBM Plex Mono"'; g.letterSpacing = "2px";
    g.fillText("ENZ-01 · IMPRIMANTE DE BORD", 28, y);
    const H = y + 60;
    const out = document.createElement("canvas");
    out.width = W; out.height = H;
    out.getContext("2d")!.drawImage(c, 0, 0);
    const tex = new THREE.CanvasTexture(out);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = ctx.renderer.capabilities.getMaxAnisotropy();
    return { tex, len: H / SLIP.pxPerM };
  }

  // point du ruban à la distance s de la fente, dans le repère de l'imprimante
  function slipPoint(s: number, out = new THREE.Vector3()) {
    const a = SLIP.tilt + s / SLIP.R;
    return out.set(0, SLOT.y + SLIP.R * (Math.sin(a) - Math.sin(SLIP.tilt)), SLOT.z - SLIP.R * (Math.cos(SLIP.tilt) - Math.cos(a)));
  }
  const _sp = new THREE.Vector3();
  function shape(len: number) {
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    const rows = 81;
    for (let r = 0; r < rows; r++) {
      // le texte du haut sort en premier : la pointe du ruban porte le titre
      const sAlong = len * (r / (rows - 1));
      slipPoint(sAlong, _sp);
      const v = 1 - (len - sAlong) / state.max;
      for (let c = 0; c < 2; c++) {
        const i = r * 2 + c;
        pos.setXYZ(i, (c ? 0.5 : -0.5) * SLIP.w, _sp.y, _sp.z + 0.001);
        uv.setXY(i, c, v);
      }
    }
    pos.needsUpdate = true; uv.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }

  /* le pilote se penche pour que le ruban entier tienne dans son regard, face à lui,
     quelle que soit sa longueur et la forme de l'écran */
  function leanFor(len: number) {
    ctx.printer.updateMatrixWorld(true);
    const center = ctx.printer.localToWorld(slipPoint(len / 2));
    const a = SLIP.tilt + len / 2 / SLIP.R;
    const n = new THREE.Vector3(0, Math.sin(a), Math.cos(a));
    const fov = 52, half = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const dist = Math.max((len / 2 + 0.03) / half, (SLIP.w / 2 + 0.035) / (half * ctx.camera.aspect), 0.4);
    return { pos: center.clone().addScaledVector(n, dist), look: center, fov };
  }
  function leanTo(t: { pos: THREE.Vector3; look: THREE.Vector3; fov: number } | null) {
    const ct = ctx.camTarget;
    ct.pos.copy(t ? t.pos : ctx.camHome.pos);
    ct.look.copy(t ? t.look : ctx.camHome.look);
    ct.lean = t ? 1 : 0;
    if (t) ct.fov = t.fov;
  }

  function captionFor(kind: string): CaptionItem[] {
    if (kind === "contact") {
      const copy: CaptionItem = {
        kind: "button", label: "Copier l'adresse",
        onClick: async () => {
          let label = "Copiée";
          try { await navigator.clipboard.writeText(EMAIL); } catch { label = "Copie impossible"; }
          ctx.ui.setCaption(captionFor("contact").map((it) => (it === copy ? { ...copy, label } : it)));
        },
      };
      return [
        { kind: "text", text: EMAIL }, copy,
        { kind: "link", label: "Écrire", href: `mailto:${EMAIL}` },
        { kind: "link", label: "GitHub", href: GITHUB },
      ];
    }
    if (kind === "dossier") {
      return [
        { kind: "text", text: "Le code :" },
        ...PROJECTS.map((p): CaptionItem => ({ kind: "link", label: p.name, href: p.repo })),
        { kind: "link", label: "GitHub", href: GITHUB },
        { kind: "text", text: "· clique sur le ruban pour l'arracher." },
      ];
    }
    return [{ kind: "text", text: "Clique sur le ruban pour l'arracher." }];
  }

  async function print(kind: string) {
    const { tex, len } = draw(SLIPS[kind]);
    material.map?.dispose();
    material.map = tex; material.opacity = 1; material.needsUpdate = true;
    mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0);
    state.open = kind; state.len = 0; state.max = len;
    shape(0);
    mesh.visible = true;
    ctx.printerLed.material.emissiveIntensity = 3;
    leanTo(leanFor(len));
    // l'imprimante avance par petites saccades, à vitesse constante
    const steps = Math.ceil(len / 0.016);
    for (let i = 1; i <= steps; i++) {
      const from = state.len, to = len * i / steps;
      await ctx.anim.tween(0.055, (k) => { state.len = from + (to - from) * k; shape(state.len); });
      await ctx.anim.wait(0.025);
    }
    ctx.printerLed.material.emissiveIntensity = 0;
    ctx.ui.setCaption(captionFor(kind));
  }

  async function tear() {
    state.open = null;
    ctx.ui.setCaption(null);
    leanTo(null);
    await ctx.anim.tween(0.5, (k) => {
      mesh.position.set(k * 0.05, k * 0.08, k * 0.22);
      mesh.rotation.set(-k * 1.1, 0, k * 0.45);
      material.opacity = 1 - k;
    });
    mesh.visible = false;
    mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0);
    material.opacity = 1;
  }

  return { mesh, state, print, tear };
}
export type Slip = ReturnType<typeof createSlip>;
