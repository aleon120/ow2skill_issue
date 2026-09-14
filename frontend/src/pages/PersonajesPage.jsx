import React, { useEffect, useState } from "react";
import ImageTile from "../components/ImageTile.jsx";
import HeroDetailCard from "../components/HeroDetailCard.jsx";
import { fetchHeroes } from "../api/client.js";

const ROLE_LABEL = { tank: "Tanque", dps: "Daño", support: "Soporte" };
const ROLE_ORDER = ["tank", "dps", "support"];

export default function PersonajesPage() {
  const [heroes, setHeroes] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    fetchHeroes()
      .then(setHeroes)
      .catch((e) => setLoadError(e.message));
  }, []);

  const selectedHero = heroes.find((h) => h.id === selectedId) || null;

  if (loadError) {
    return <p className="empty-state">No se pudo conectar con el backend: {loadError}</p>;
  }

  return (
    <section className="personajes-section">
      <div className="panel-header personajes-page-header">
        <span className="eyebrow">Personajes</span>
        <h2>Guía de counters</h2>
      </div>
      <p className="empty-state personajes-intro">
        Elegí un héroe para ver su ficha completa: a quiénes contrarresta, quiénes lo contrarrestan a él, con quién
        sinergiza y cómo rinde según mapa y rango.
      </p>

      <div className="hero-explorer-grid">
        <div className="panel hero-picker-panel">
          <div className="panel-header">
            <span className="eyebrow">Roster</span>
            <h2>Elegí un héroe</h2>
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

        <HeroDetailCard heroId={selectedId} basicHero={selectedHero} onSelectHero={setSelectedId} />
      </div>
    </section>
  );
}