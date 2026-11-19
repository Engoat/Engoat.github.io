# Enzo Dylan — portfolio

Un cockpit de vaisseau en 3D, vu depuis le siège du pilote. Les projets sont des planètes : on y va en
cliquant dessus ou sur le bouton ENGAGER, et une visite présente l'application. Le dossier et le contact
sortent de l'imprimante de bord. Une version texte donne le même contenu sans la 3D.

En ligne : https://engoat.github.io/

## Lancer

```
npm install
npm run dev        # développement
npm run build      # vérification des types, puis le site statique dans dist/
```

## Organisation

```
src/
  content/profile.ts   tout le contenu (profil, compétences, projets, liens), à un seul endroit
  App.tsx, ui/         l'interface en React : chargement, barre du bas, clavier, version texte
  engine/              le cockpit, en Three.js
    index.ts           assemble la scène, la boucle de rendu et les clics
    world/             l'espace et les planètes, la cabine, la planche, les mains, les matières usées
    actions/           appuyer sur un bouton, imprimer le ruban, voyager, la file des commandes
    demo/              les visites de Nexus et de Crible, et l'affichage de la tour sur la vitre
tools/bake_wear.py     calcul des matières usées dans Blender
tools/smooth_hands.py  lissage des modèles de main (subdivision, squelette conservé)
public/assets/         polices, modèles de main, images
```

Le moteur ne touche jamais au DOM : il passe par un petit pont (`UiBridge`) que React fournit. La
version sans JavaScript et les données structurées sont écrites dans `index.html` au build, depuis
`src/content/profile.ts`.

## Quelques choix

- **Planètes** : la géographie de chaque planète est l'identité du projet (le cahier et le graphe de
  Nexus, le tableau de Crible). L'éclairage est calculé dans un shader : terminateur adouci,
  atmosphère, et l'encre colorée qui luit sur la face de nuit.
- **Matières usées** : les pièces fixes passent dans Blender (Cycles), qui biseaute les arêtes et cuit
  trois images : la peinture écaillée sur les arêtes vives, la saleté dans les creux, l'ombre ambiante.
  Pour refaire le calcul : ouvrir la page avec `?export`, enregistrer le résultat de
  `window.__exportWear()` dans `scratch/wear-in.glb`, puis
  `blender -b --factory-startup -P tools/bake_wear.py -- 2048 32`.
- **Détails** : vis, rivets, joint de hublot, poignées et câbles (`engine/world/details.ts`), fusionnés
  par matériau, passent eux aussi par le calcul d'usure.
- **Mains** : modèles WebXR lissés dans Blender, gant en cuir grainé, gantelet évasé et bague de
  poignet pleine sur une manche en toile.
- **Moteur de rendu** : WebGL. Le moteur WebGPU de Three.js a été essayé ; sur une puce Intel UHD 620,
  il était plus lent, même dans son mode WebGL 2.
- **Visites** : elles avancent seules ; « Suivant » termine l'étape en cours, « Passer » va à la fin.

Paramètres d'adresse utiles : `?noboot` (sans la séquence d'allumage), `?nowear` (couleurs unies).

## Licences

Code sous licence MIT (voir `LICENSE`). Polices Barlow Condensed, IBM Plex Mono et Instrument Sans
(SIL OFL, dans `public/assets/fonts`). Modèles de main : WebXR Input Profiles (W3C Software and Document
License, dans `public/assets/hands`). Bruit simplexe 3D : Ian McEwan, Ashima Arts (MIT).
