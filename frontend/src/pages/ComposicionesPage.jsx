import React, { useEffect, useState } from "react";
import ImageTile from "../components/ImageTile.jsx";
import CompositionGuide from "../components/CompositionGuide.jsx";
import { fetchHeroes } from "../api/client.js";

const ROLE_LABEL = { tank: "Tanque", dps: "Daño", support: "Soporte" };
const ROLE_ORDER = ["tank", "dps", "support"];
const MODES = [
  { id: "5v5", label: "5vs5" },
  { id: "6v6", label: "6vs6" },
];

export default function ComposicionesPage() {
  const [heroes, setHeroes] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState("5v5");

  useEffect(() => {
    fetchHeroes()
      .then(setHeroes)
      .catch((e) => setLoadError(e.message));
  }, []);

  if (loadError) {
    return <p className="empty-state">No se pudo conectar con el backend: {loadError}</p>;
  }

  return (
    <section className="personajes-section">
      <div className="panel-header personajes-page-header">
        <span className="eyebrow">Composiciones</span>
        <h2>Armá un equipo alrededor de un héroe</h2>
      </div>
      <p className="empty-state personajes-intro">
        Elegí un héroe ancla y te sugerimos con quién combinarlo en cada rol restante, según sinergia, combo de
        arquetipo y balance de composición.
      </p>

      <div className="hero-explorer-grid">
        <div className="panel hero-picker-panel">
          <div className="panel-header">
            <span className="eyebrow">Roster</span>
            <h2>Elegí un héroe ancla</h2>
          </div>

          <div className="mode-toggle" role="group" aria-label="Modo de juego">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`mode-toggle-btn ${mode === m.id ? "mode-toggle-btn-active" : ""}`}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {ROLE_ORDER.map((role) => {
            const list = heroes.filter((h) => h.role === role).sort((a, b) => a.name.localeCompare(b.name, "es"));
            if (list.length === 0) return null;
            return (
              <div className="role-block" key={role}>
                <div className={`role-tag role-${role}`}>{ROLE_LABEL[role]}</div>
                <div className="tile-row">
                  {list.map((h) => (
                    <ImageTile
                      key={h.id}
                      src={`/heroes/${h.id}.png`}
                      alt={h.name}
                      active={selectedId === h.id}
                      onClick={() => setSelectedId(h.id)}
                      ringClass={`ring-${role}`}
                      variant="hero"
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <CompositionGuide heroId={selectedId} mode={mode} onSelectHero={setSelectedId} />
      </div>
    </section>
  );
}