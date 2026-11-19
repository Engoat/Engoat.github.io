import { useEffect, useState } from "react";
import type { CaptionItem } from "../engine/types";

/* La barre du bas : ce que le cockpit propose à l'instant (liens du dossier, adresse à
   copier, « Passer la visite »…). Elle garde son dernier contenu pendant qu'elle s'efface. */
export function CaptionBar({ items }: { items: CaptionItem[] | null }) {
  const [shown, setShown] = useState<CaptionItem[]>([]);
  useEffect(() => { if (items) setShown(items); }, [items]);
  return (
    <div className="caption" data-on={!!items} role="status" aria-live="polite">
      {shown.map((it, i) => {
        if (it.kind === "text") return <span key={i}>{it.text}</span>;
        if (it.kind === "link") {
          const external = it.href.startsWith("http");
          return <a key={i} href={it.href} {...(external ? { target: "_blank", rel: "noopener" } : {})}>{it.label}</a>;
        }
        return <button key={i} type="button" onClick={() => void it.onClick()}>{it.label}</button>;
      })}
    </div>
  );
}
