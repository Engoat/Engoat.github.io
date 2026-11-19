import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { EMAIL, GITHUB, PERSON, PROJECTS, SKILLS, bare } from "./src/content/profile";

/** adresse publique du site (aperçus de partage, adresse canonique) */
const SITE_URL = process.env.SITE_URL ?? "https://engoat.github.io/";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* La version texte existe aussi sans JavaScript (et pour les robots qui ne
   l'exécutent pas) : elle est écrite dans index.html au build, depuis le même
   fichier de contenu que l'application. */
function staticContent(): Plugin {
  const text = `<noscript><style>#root{display:none}</style><main class="eject eject--static"><article class="eject__page">
<p class="eject__kicker">Portfolio · version texte</p>
<h1>${esc(PERSON.name)}</h1>
<p class="eject__lead">${esc(PERSON.lead)} ${esc(PERSON.place)}.</p>
<h2>Profil</h2><p>${esc(PERSON.profile)}</p>
<h2>Compétences</h2><dl>${SKILLS.map((s) => `<dt>${esc(s.title)}</dt><dd>${esc(s.text)}</dd>`).join("")}</dl>
<h2>Projets</h2>${PROJECTS.map((p) => `<h3>${esc(p.name)}</h3><p>${esc(p.text)}</p><p>Code : <a href="${p.repo}">${bare(p.repo)}</a></p>`).join("")}
<h2>Contact</h2><p><a href="mailto:${EMAIL}">${EMAIL}</a></p><p><a href="${GITHUB}">${bare(GITHUB)}</a></p>
</article></main></noscript>`;
  const person = { "@context": "https://schema.org", "@type": "Person", name: PERSON.name, url: SITE_URL,
    jobTitle: "Élève ingénieur en informatique", email: `mailto:${EMAIL}`, sameAs: [GITHUB] };
  return {
    name: "contenu-statique",
    transformIndexHtml: (html) => html
      .replaceAll("%SITE_URL%", SITE_URL)
      .replace("<!--structured-data-->", `<script type="application/ld+json">${JSON.stringify(person)}</script>`)
      .replace("<!--noscript-text-->", text),
  };
}

// Site statique : chemins relatifs, pour être servi depuis n'importe quel dossier.
export default defineConfig({
  base: "./",
  plugins: [react(), staticContent()],
  build: {
    target: "es2022",
    // three.js dans son propre fichier : il change rarement, le navigateur le garde en cache
    rollupOptions: { output: { manualChunks: (id) => (id.includes("node_modules/three") ? "three" : undefined) } },
  },
});
