import React, { useEffect, useState } from "react";
import ImageTile from "../components/ImageTile.jsx";
import { fetchHeroes, fetchMaps } from "../api/client.js";

const TIERS = ["S", "A+", "A", "B", "C"];
const TIER_CLASS = { S: "tier-S", "A+": "tier-Ap", A: "tier-A", B: "tier-B", C: "tier-C" };
const TIER_DESC = {
  S: "Dominante en el meta actual",
  "A+": "Muy fuerte, casi siempre buena elección",
  A: "Sólido, viable en la mayoría de composiciones",
  B: "Situacional, rinde bien en contextos puntuales",
  C: "Débil en el meta actual",
};

const ROLE_LABEL = { tank: "Tanque", dps: "Daño", support: "Soporte" };
const ROLE_ORDER = ["tank", "dps", "support"];

const MAP_TYPE_ORDER = ["Control", "Escort", "Hybrid", "Push", "Flashpoint"];

export default function TierlistPage() {
  const [heroes, setHeroes] = useState([]);
  const [maps, setMaps] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([fetchHeroes(), fetchMaps()])
      .then(([h, m]) => {
        setHeroes(h);
        setMaps(m);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <p className="empty-state">No se pudo conectar con el backend: {error}</p>;
  }

  const heroesByTier = TIERS.map((tier) => ({
    tier,
    // Dentro de cada tier: rol primero, alfabético después.
    list: ROLE_ORDER.flatMap((role) =>
      heroes
        .filter((h) => h.metaTier === tier && h.role === role)
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
        .map((h) => ({ ...h, role }))
    ),
  }));

  const mapTypes = [...new Set(maps.map((m) => m.type))].sort(
    (a, b) => MAP_TYPE_ORDER.indexOf(a) - MAP_TYPE_ORDER.indexOf(b)
  );
  const mapsByType = mapTypes.map((type) => ({
    type,
    list: maps.filter((m) => m.type === type).sort((a, b) => a.name.localeCompare(b.name, "es")),
  }));

  return (
    <section className="tierlist-section">
      <div className="panel-header personajes-page-header">
        <span className="eyebrow">Tierlist</span>
        <h2>Meta actual, de un vistazo</h2>
      </div>
      <p className="empty-state personajes-intro">
        Lectura visual del mismo <code>metaTier</code> que usa el motor de recomendaciones, agrupado por tier y, dentro
        de cada uno, por rol. Debajo, los mapas agrupados por modo.
      </p>

      <div className="panel tierlist-panel">
        <div className="panel-header">
          <span className="eyebrow">Héroes</span>
          <h2>Tier list de héroes</h2>
        </div>
        {heroesByTier.map(({ tier, list }) => (
          <div className="tier-heading-block" key={tier}>
            <div className="tier-heading">
              <span className={`tier-badge-lg ${TIER_CLASS[tier]}`}>{tier}</span>
              <span className="tier-heading-desc">{TIER_DESC[tier]}</span>
            </div>
            {list.length === 0 ? (
              <p className="hero-ref-empty">Sin héroes en este tier.</p>
            ) : (
              <div className="tierlist-hero-grid">
                {list.map((h) => (
                  <div className="tierlist-hero-card" key={h.id} title={h.name}>
                    <ImageTile src={`/heroes/${h.id}.png`} alt={h.name} active ringClass={`ring-${h.role}`} onClick={() => {}} />
                    <span className="tierlist-hero-name">{h.name}</span>
                    <span className={`role-tag role-${h.role} small`}>{ROLE_LABEL[h.role]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="panel tierlist-panel">
        <div className="panel-header">
          <span className="eyebrow">Mapas</span>
          <h2>Mapas por modo</h2>
        </div>
        {mapsByType.map(({ type, list }) => (
          <div className="tier-heading-block" key={type}>
            <div className="tier-heading">
              <span className="static-chip map-type-badge">{type}</span>
              <span className="tier-heading-desc">{list.length} mapas</span>
            </div>
            <div className="tierlist-map-grid">
              {list.map((m) => (
                <div className="tierlist-map-card" key={m.id} title={m.name}>
                  <ImageTile src={`/maps/${m.id}.png`} alt={m.name} active variant="map" onClick={() => {}} />
                  <span className="tierlist-map-name">{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}