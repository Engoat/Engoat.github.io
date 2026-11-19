import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Ctx } from "../types";
import { mat } from "../util/textures";
import { shadowy } from "../util/geometry";

/** fente de l'imprimante, dans le repère de l'imprimante */
export const SLOT = new THREE.Vector3(0, 0.022, 0.045);

/* le pupitre central et son imprimante de bord (le dossier sort sur un ruban de
   papier, comme les messages de vol des avions de ligne), les consoles latérales
   avec le manche et les gaz, et l'écusson de mission */
export function buildConsoles(ctx: Ctx) {
  const { M, tex, cockpit } = ctx;

  const ped = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.36, 0.26, 4, 0.025), M.paintDark));
  ped.position.set(0, -0.72, -0.63);
  cockpit.add(ped);

  const printer = new THREE.Group();
  printer.position.set(0, -0.54, -0.63);
  cockpit.add(printer);
  ctx.printer = printer;
  printer.add(shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.04, 0.2, 3, 0.008), M.bezel)));
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.004, 0.008), M.black);
  slot.position.set(0, 0.0205, SLOT.z);
  printer.add(slot);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.003, 0.006), M.chrome);
  lip.position.set(0, 0.021, SLOT.z + 0.008);
  printer.add(lip);
  const pl = tex.placard("IMPRIMANTE DE BORD", 0.12, 0.016, { bg: "#131313", color: "#bdb7a6" });
  pl.rotation.x = -Math.PI / 2; pl.position.set(-0.02, 0.0205, 0.08);
  printer.add(pl);
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.0045, 20), mat(0x2a1500, 0.4, 0, { emissive: 0xffa53a, emissiveIntensity: 0 }));
  led.rotation.x = -Math.PI / 2; led.position.set(0.075, 0.0207, 0.08);
  printer.add(led);
  ctx.printerLed = led;

  // consoles latérales : manche à droite, manette des gaz à gauche
  for (const side of [-1, 1]) {
    const c = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.32, 0.72, 4, 0.03), M.paintDark));
    c.position.set(side * 0.44, -0.7, -0.4);
    cockpit.add(c);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.66), M.paint);
    top.rotation.x = -Math.PI / 2; top.position.set(side * 0.44, -0.538, -0.4);
    top.receiveShadow = true;
    cockpit.add(top);
  }
  {
    const g = new THREE.Group();
    g.position.set(0.42, -0.535, -0.56);
    cockpit.add(g);
    g.add(shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.black)));
    const shaft = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.1, 16), M.chrome));
    shaft.position.y = 0.06; g.add(shaft);
    const grip = shadowy(new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.035, 8, 20), mat(0x1a1a1a, 0.6)));
    grip.position.y = 0.125; grip.rotation.z = Math.PI / 2; grip.rotation.y = 0.3; g.add(grip);
  }
  {
    const g = new THREE.Group();
    g.position.set(-0.42, -0.535, -0.52);
    cockpit.add(g);
    const slotT = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.002, 0.2), M.black);
    slotT.position.y = 0.001; g.add(slotT);
    const arm = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.08, 0.018), M.chrome));
    arm.position.set(0, 0.04, -0.01); g.add(arm);
    const knob = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.032, 0.048, 3, 0.014), mat(0x1a1a1a, 0.6)));
    knob.position.set(0, 0.092, -0.012); g.add(knob);
    const gaz = tex.placard("GAZ", 0.05, 0.016);
    gaz.rotation.x = -Math.PI / 2; gaz.position.set(0.06, 0.0015, 0.09); g.add(gaz);
  }

  // écusson de mission, cousu sur la paroi gauche
  {
    const patch = tex.canvas(512, 512, (c, W) => {
      c.translate(W / 2, W / 2);
      c.fillStyle = "#1b3a6b"; c.beginPath(); c.arc(0, 0, 254, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#d8ad18"; c.lineWidth = 16; c.beginPath(); c.arc(0, 0, 238, 0, Math.PI * 2); c.stroke();
      c.save(); c.beginPath(); c.arc(0, 14, 128, 0, Math.PI * 2); c.clip();
      c.fillStyle = "#f1ede2"; c.fillRect(-140, -120, 280, 280);
      c.strokeStyle = "rgba(128,152,216,.9)"; c.lineWidth = 3;
      for (let y = -120; y <= 160; y += 22) { c.beginPath(); c.moveTo(-140, y); c.lineTo(140, y); c.stroke(); }
      c.restore();
      c.strokeStyle = "#1b3a6b"; c.lineWidth = 9;
      for (const [a, b, x, y] of [[-62, 52, 0, -40], [0, -40, 62, 40], [-62, 52, 62, 40]]) { c.beginPath(); c.moveTo(a, b); c.lineTo(x, y); c.stroke(); }
      for (const [x, y, col] of [[-62, 52, "#c62b22"], [0, -40, "#2a51a3"], [62, 40, "#19683d"]] as const) {
        c.fillStyle = col; c.beginPath(); c.arc(x, y, 24, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = "#d8ad18"; c.textAlign = "center"; c.textBaseline = "middle";
      c.font = '700 60px "Barlow Condensed"'; c.letterSpacing = "10px"; c.fillText("E·D", 6, -176);
      c.font = '600 40px "Barlow Condensed"'; c.letterSpacing = "6px"; c.fillText("NEXUS", 4, 190);
    });
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.07, 48), mat(0xffffff, 0.95, 0, { map: patch }));
    p.position.set(-0.93, -0.02, -0.5);
    p.rotation.y = 1.25;
    cockpit.add(p);
  }
}
