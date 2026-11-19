import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Ctx } from "../types";
import { mat } from "../util/textures";
import { boltRing, roundedRect, shadowy, twoGroups } from "../util/geometry";
import { PERSON } from "../../content/profile";

export const PLATE_GLOW = 0.22;

/* la capsule : coque capitonnée, cloison avant percée du hublot, plancher,
   pare-soleil et plaque du pilote */
export function buildCabin(ctx: Ctx) {
  const { M, tex } = ctx;
  const cockpit = new THREE.Group();
  ctx.scene.add(cockpit);
  ctx.cockpit = cockpit;

  // garnissage : coussins rectangulaires en toile crème, cousus, avec relief
  const quilt = (bump: boolean) => tex.canvas(1024, 1024, (g, W, H) => {
    g.fillStyle = bump ? "#202020" : "#a89f8a"; g.fillRect(0, 0, W, H);
    const cols = 2, rows = 2, gap = 10, cw = W / cols, ch = H / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x = i * cw + gap / 2, y = j * ch + gap / 2, w = cw - gap, h = ch - gap;
      const grd = g.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, Math.max(w, h) * 0.62);
      if (bump) { grd.addColorStop(0, "#fff"); grd.addColorStop(0.7, "#b0b0b0"); grd.addColorStop(1, "#404040"); }
      else { grd.addColorStop(0, "#d8d0bc"); grd.addColorStop(0.75, "#cbc2ac"); grd.addColorStop(1, "#b5ac95"); }
      g.fillStyle = grd;
      g.beginPath(); g.roundRect(x, y, w, h, 26); g.fill();
      if (!bump) {
        g.setLineDash([7, 6]); g.strokeStyle = "rgba(110,100,80,.45)"; g.lineWidth = 2;
        g.beginPath(); g.roundRect(x + 14, y + 14, w - 28, h - 28, 18); g.stroke(); g.setLineDash([]);
      }
    }
  }, !bump);
  const quiltMap = quilt(false), quiltBump = quilt(true);
  for (const t of [quiltMap, quiltBump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12, 2.4); }
  const wallMat = mat(0xffffff, 0.96, 0, { map: quiltMap, bumpMap: quiltBump, bumpScale: 4, side: THREE.BackSide });

  // la coque : un tronc de cône arrondi autour de l'axe de vol, qui se resserre vers
  // l'avant comme une cabine de descente
  {
    const zs = [0.75, 0.55, 0.2, -0.2, -0.55, -0.85, -1.02, -1.1];
    const rs = [0.86, 0.98, 1.04, 1.03, 0.99, 0.93, 0.88, 0.86];
    const geo = new THREE.LatheGeometry(zs.map((z, i) => new THREE.Vector2(rs[i], -z)), 96);
    geo.rotateX(-Math.PI / 2);
    const hull = new THREE.Mesh(geo, wallMat);
    hull.receiveShadow = true;
    hull.position.y = 0.05;
    cockpit.add(hull);
    // arceaux structurels qui ceinturent la coque
    for (const z of [-0.25, 0.3]) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.022, 10, 96), M.frame);
      rib.position.set(0, 0.05, z);
      rib.receiveShadow = true;
      cockpit.add(rib);
    }
  }

  // cloison avant, percée du hublot
  const WIN = { w: 1.3, h: 0.58, r: 0.2, cy: 0.25 };
  ctx.window = WIN;
  {
    const disc = new THREE.Shape(); disc.absarc(0, 0.05, 0.9, 0, Math.PI * 2, false);
    disc.holes.push(roundedRect(WIN.w, WIN.h, WIN.r, 0, WIN.cy));
    const wall = shadowy(new THREE.Mesh(new THREE.ExtrudeGeometry(disc, { depth: 0.04, bevelEnabled: false, curveSegments: 64 }), M.paintDark));
    wall.position.z = -1.06;
    cockpit.add(wall);

    const ring = roundedRect(WIN.w + 0.17, WIN.h + 0.17, WIN.r + 0.08, 0, WIN.cy);
    ring.holes.push(roundedRect(WIN.w, WIN.h, WIN.r, 0, WIN.cy));
    const frame = shadowy(new THREE.Mesh(new THREE.ExtrudeGeometry(ring, {
      depth: 0.07, bevelEnabled: true, bevelThickness: 0.016, bevelSize: 0.014, bevelSegments: 5, curveSegments: 32 }), M.frame));
    frame.position.z = -1.04;
    cockpit.add(frame);
    const pts = roundedRect(WIN.w + 0.085, WIN.h + 0.085, WIN.r + 0.04, 0, WIN.cy).getSpacedPoints(26);
    pts.pop();
    boltRing(cockpit, pts, 0.0075, 0.012, -0.952, M.bolt);

    const glass = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(WIN.w, WIN.h, WIN.r, 0, WIN.cy), 32),
      new THREE.MeshPhysicalMaterial({ color: 0xa9bfcf, roughness: 0.04, transparent: true, opacity: 0.05, envMapIntensity: 1.4, depthWrite: false }));
    glass.position.z = -1.02;
    glass.userData.skip = true;            // la vitre ne bloque pas les clics sur les planètes
    cockpit.add(glass);
  }

  // plancher strié, pour que rien ne flotte
  {
    const ridges = tex.canvas(256, 256, (g, W, H) => {
      g.fillStyle = "#3b3f40"; g.fillRect(0, 0, W, H);
      g.fillStyle = "#2a2d2e"; for (let y = 0; y < H; y += 32) g.fillRect(0, y, W, 12);
    });
    ridges.wrapS = ridges.wrapT = THREE.RepeatWrapping; ridges.repeat.set(1, 6);
    const floor = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 1.6), mat(0x3b3f40, 0.85, 0, { map: ridges })));
    floor.position.set(0, -0.88, -0.3);
    cockpit.add(floor);
  }

  // pare-soleil, avec la plaque du pilote vissée dessus
  {
    const gs = shadowy(new THREE.Mesh(new RoundedBoxGeometry(1.42, 0.08, 0.28, 5, 0.035), M.paintDark));
    gs.position.set(0, -0.05, -0.9);
    cockpit.add(gs);
    const lip = shadowy(new THREE.Mesh(new RoundedBoxGeometry(1.38, 0.025, 0.05, 3, 0.01), M.black));
    lip.position.set(0, -0.085, -0.765);
    cockpit.add(lip);

    const plate = tex.canvas(2048, 290, (g, W, H) => {
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, "#e2dac2"); grd.addColorStop(0.5, "#cfc6aa"); grd.addColorStop(1, "#b3a988");
      g.fillStyle = grd; g.fillRect(0, 0, W, H);
      g.strokeStyle = "rgba(50,44,30,.55)"; g.lineWidth = 6; g.strokeRect(14, 14, W - 28, H - 28);
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = "#3e382a"; g.font = '600 54px "Barlow Condensed"'; g.letterSpacing = "20px";
      g.fillText("POSTE PILOTE", W / 2 + 9, 64);
      g.fillStyle = "#16150f"; g.font = '700 170px "Barlow Condensed"'; g.letterSpacing = "40px";
      g.fillText(PERSON.name.toUpperCase(), W / 2 + 20, 178);
      g.fillStyle = "#7d755f";       // vis aux quatre coins
      for (const [x, y] of [[44, 44], [W - 44, 44], [44, H - 44], [W - 44, H - 44]]) { g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill(); }
    });
    // la plaque s'éclaire à la fin de l'allumage (emissiveIntensity animée)
    ctx.plateMat = mat(0xffffff, 0.32, 0.6, { map: plate, emissive: 0xfff0d2, emissiveMap: plate, emissiveIntensity: ctx.boot ? 0 : PLATE_GLOW });
    const p = shadowy(new THREE.Mesh(twoGroups(new RoundedBoxGeometry(0.46, 0.065, 0.004, 2, 0.002), 4), [M.bezel, ctx.plateMat]));
    p.position.set(0, -0.047, -0.757);
    p.rotation.x = -0.12;
    cockpit.add(p);
  }
}
