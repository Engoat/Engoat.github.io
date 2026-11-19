import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Ctx } from "../types";

/* Matières usées, calculées dans Blender (scratch/bake_wear.py) :
   - les pièces fixes peintes ou métalliques partent dans Blender, qui biseaute leurs
     arêtes, déplie leur surface et « cuit » trois images : la couleur (peinture usée
     sur les arêtes vives, saleté dans les creux), la rugosité, et l'ombre ambiante ;
   - au chargement, ces pièces sont remplacées par le modèle biseauté, avec ces images.
   Les pièces qui portent du texte (étiquettes, cadrans, boutons) ne passent pas par là :
   elles gardent leurs textures nettes. */

/** les matériaux de la palette qui reçoivent l'usure */
const WORN = new Set(["paint", "paintDark", "frame", "bezel", "black", "chrome", "bolt"]);

function wearable(ctx: Ctx) {
  const out: THREE.Mesh[] = [];
  ctx.cockpit.updateMatrixWorld(true);
  ctx.cockpit.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material) || m.userData.moving) return;
    if (WORN.has((m.material as THREE.Material).name)) out.push(m);
  });
  return out;
}

/** exporte les pièces à user, en coordonnées monde, pour Blender (?export) */
export async function exportWearable(ctx: Ctx) {
  const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
  const root = new THREE.Scene();
  for (const m of wearable(ctx)) root.add(new THREE.Mesh(m.geometry.clone().applyMatrix4(m.matrixWorld), m.material));
  const buf = await new GLTFExporter().parseAsync(root, { binary: true }) as ArrayBuffer;
  let s = "";
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

/** remplace les pièces fixes par le modèle usé, s'il existe ; sinon ne change rien */
export async function applyWear(ctx: Ctx) {
  const base = import.meta.env.BASE_URL + "assets/wear/";
  const texture = (name: string, srgb: boolean) => new THREE.TextureLoader().loadAsync(base + name).then((t) => {
    t.flipY = false; t.channel = 1;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = ctx.renderer.capabilities.getMaxAnisotropy();
    return t;
  });
  let gltf, color, rough, ao;
  try {
    [gltf, color, rough, ao] = await Promise.all([
      new GLTFLoader().loadAsync(base + "cockpit.glb"),
      texture("color.webp", true), texture("roughness.webp", false), texture("ao.webp", false),
    ]);
  } catch {
    return false;
  }
  const worn = new Map<string, THREE.MeshStandardMaterial>();
  for (const [name, m] of Object.entries(ctx.M)) {
    if (!WORN.has(name)) continue;
    const w = m.clone();
    // la couleur et la rugosité cuites remplacent les valeurs unies (en gardant le métal)
    w.color.set(0xffffff);
    w.map = color;
    w.roughness = 1;
    w.roughnessMap = rough;
    w.aoMap = ao;
    w.aoMapIntensity = 1;
    worn.set(name, w);
  }
  const replaced = wearable(ctx);
  gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const w = worn.get((m.material as THREE.Material).name);
    if (!w) return;
    m.material = w;
    m.castShadow = m.receiveShadow = true;
  });
  for (const m of replaced) m.parent?.remove(m);
  ctx.cockpit.add(gltf.scene);
  return true;
}
