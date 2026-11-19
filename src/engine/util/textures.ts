import * as THREE from "three";

export type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;

/* Les textures du cockpit sont dessinées au canevas au chargement (étiquettes,
   cadrans, planètes) : rien à télécharger, et le texte reste net. */
export class TextureFactory {
  constructor(private anisotropy: number) {}

  canvas(w: number, h: number, draw: Draw, srgb = true): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d")!;
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = this.anisotropy;
    return t;
  }

  /** plaque gravée : texte clair sur fond sombre, en Barlow Condensed */
  placard(text: string, w: number, h: number, { size = 0.7, color = "#ece6d4", bg = "#141414", weight = 600 } = {}) {
    const pxH = 96, pxW = Math.round(pxH * w / h);
    const tex = this.canvas(pxW, pxH, (g) => {
      g.fillStyle = bg; g.fillRect(0, 0, pxW, pxH);
      g.fillStyle = color;
      g.font = `${weight} ${Math.round(pxH * size)}px "Barlow Condensed"`;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.letterSpacing = `${Math.round(pxH * 0.06)}px`;
      g.fillText(text, pxW / 2, pxH / 2 + pxH * 0.04);
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(0xffffff, 0.55, 0, { map: tex }));
  }
}

export const mat = (color: THREE.ColorRepresentation, roughness = 0.7, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

/* la palette de la cabine, partagée par toutes les pièces ; chaque matériau porte son
   nom, qui sert à le retrouver après le passage dans Blender (matières usées) */
export const createMaterials = () => {
  const M = {
    paint: mat(0x6a918b, 0.6),            // gris-turquoise des capsules Soyouz
    paintDark: mat(0x4c6d69, 0.66),
    frame: mat(0x2f3336, 0.5, 0.4),
    bezel: mat(0x131313, 0.42, 0.25),
    black: mat(0x0a0a0a, 0.78),
    chrome: mat(0xd8dadc, 0.2, 1),
    bolt: mat(0x9a9c9e, 0.32, 0.9),
    red: mat(0xb3261e, 0.42),
  };
  for (const [name, m] of Object.entries(M)) m.name = name;
  return M;
};
export type Materials = ReturnType<typeof createMaterials>;

/* générateur pseudo-aléatoire à graine (Park-Miller) : mêmes motifs à chaque visite */
export function seeded(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}
