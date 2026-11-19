import { PERSON } from "../content/profile";

/* Visible dès la première image, avant la 3D : qui, quoi, et un accès direct au texte. */
export function Loading({ done, failed, onText }: { done: boolean; failed: boolean; onText: () => void }) {
  return (
    <div className="loading" data-done={done || failed}>
      <div className="loading__card">
        <p className="loading__name">{PERSON.name}</p>
        <p className="loading__lead">{PERSON.lead}</p>
        <p className="loading__state">Mise sous tension du cockpit…</p>
        <button type="button" className="loading__text" onClick={onText}>Lire la version texte</button>
      </div>
    </div>
  );
}
