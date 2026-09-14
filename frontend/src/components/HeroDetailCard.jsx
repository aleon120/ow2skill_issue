import React, { useEffect, useState } from "react";
import { fetchHeroDetail } from "../api/client.js";

const ROLE_LABEL = { tank: "Tanque", dps: "Daño", support: "Soporte" };

const TANK_TYPE_LABEL = { dive: "Dive", brawl: "Brawl", poke: "Poke" };
const DPS_ROLE_LABEL = { hitscan: "Hitscan", flex: "Flex" };
const SUPPORT_ROLE_LABEL = { main: "Main support", flex: "Flex support" };

const PLAYSTYLE_LABEL = {
  aggressive: "Agresivo",
  defensive: "Defensivo",
  hitscan: "Hitscan",
  flanker: "Flanqueador",
  sniper: "Francotirador",
  projectile: "Proyectil",
  zone: "Control de zona",
  healer: "Sanador",
  hybrid: "Híbrido",
  enabler: "Habilitador",
};

const ARCHETYPE_LABEL = { dive: "Dive", brawl: "Brawl", poke: "Poke", zone: "Zone" };

const RANGE_LABEL = { close: "Cerca", mid: "Media distancia", long: "Larga distancia" };

const MAP_PREF_LABEL = {
  open: "Mapa abierto",
  close: "Combate cerrado",
  mixed: "Distancias mixtas",
  long: "Líneas largas",
  chokepoints: "Cuellos de botella",
  flank_routes: "Rutas de flanqueo",
  high_ground: "Terreno elevado",
};

const TIER_CLASS = { S: "tier-S", "A+": "tier-Ap", A: "tier-A", B: "tier-B", C: "tier-C" };

function HeroRefThumb({ src, alt }) {
  const [error, setError] = useState(false);
  const initials = alt
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="hero-ref-thumb">
      {!error ? (
        <img src={src} alt="" onError={() => setError(true)} draggable={false} />
      ) : (
        <span className="image-tile-fallback">{initials}</span>
      )}
    </span>
  );
}

function HeroRefGrid({ refs, emptyLabel, onSelectHero }) {
  if (!refs || refs.length === 0) {
    return <p className="hero-ref-empty">{emptyLabel}</p>;
  }
  return (
    <div className="hero-ref-grid">
      {refs.map((r) => (
        <button type="button" key={r.id} className="hero-ref-card" onClick={() => onSelectHero(r.id)} title={r.name}>
          <HeroRefThumb src={`/heroes/${r.id}.png`} alt={r.name} />
          <span className="hero-ref-name">
            {r.name}
            <span className={`role-tag role-${r.role} small`}>{ROLE_LABEL[r.role]}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export default function HeroDetailCard({ heroId, basicHero, onSelectHero }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!heroId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchHeroDetail(heroId)
      .then(setDetail)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [heroId]);

  if (!heroId) {
    return (
      <div className="panel hero-detail-panel hero-detail-empty">
        <p className="empty-state">Elegí un héroe de la lista para ver su ficha completa y sus counters.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel hero-detail-panel">
        <p className="empty-state">No se pudo cargar la ficha: {error}</p>
      </div>
    );
  }

  if (loading || !detail) {
    return (
      <div className="panel hero-detail-panel hero-detail-empty">
        <p className="empty-state">Cargando ficha de {basicHero?.name ?? "héroe"}...</p>
      </div>
    );
  }

  const roleTypeLabel =
    detail.role === "tank"
      ? TANK_TYPE_LABEL[detail.tankType]
      : detail.role === "dps"
      ? DPS_ROLE_LABEL[detail.dpsRole]
      : SUPPORT_ROLE_LABEL[detail.supportRole];

  return (
    <div className="panel hero-detail-panel">
      <div className="hero-detail-header">
        <div className="hero-portrait-lg">
          <ImageTileLarge src={`/heroes/${detail.id}.png`} alt={detail.name} />
        </div>
        <div className="hero-detail-info">
          <h2 className="hero-detail-name">{detail.name}</h2>
          <div className="badge-row">
            <span className={`role-tag role-${detail.role}`}>{ROLE_LABEL[detail.role]}</span>
            {roleTypeLabel && <span className="static-chip">{roleTypeLabel}</span>}
            {detail.playstyle && <span className="static-chip">{PLAYSTYLE_LABEL[detail.playstyle] ?? detail.playstyle}</span>}
            {detail.metaTier && (
              <span className={`static-chip tier-chip ${TIER_CLASS[detail.metaTier] ?? ""}`}>Tier {detail.metaTier}</span>
            )}
          </div>
          <div className="badge-row">
            {(detail.archetype || []).map((a) => (
              <span className="static-chip" key={a}>{ARCHETYPE_LABEL[a] ?? a}</span>
            ))}
            {(detail.range || []).map((r) => (
              <span className="static-chip" key={r}>{RANGE_LABEL[r] ?? r}</span>
            ))}
          </div>
          <div className="stat-row">
            <span className="detail-label">Movilidad</span>
            <div className="mobility-track">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={`mobility-pip ${n <= (detail.mobility ?? 0) ? "mobility-pip-filled" : ""}`} />
              ))}
            </div>
          </div>
          {detail.mapPreference && detail.mapPreference.length > 0 && (
            <div className="stat-row">
              <span className="detail-label">Rinde bien en</span>
              <div className="badge-row">
                {detail.mapPreference.map((m) => (
                  <span className="static-chip" key={m}>{MAP_PREF_LABEL[m] ?? m}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="hero-section counter-section">
        <h3 className="hero-section-title">✓ Le gana a</h3>
        <p className="hero-section-hint">Elegí a estos héroes cuando la enemiga los tenga a ellos — este héroe los contrarresta directamente.</p>
        <HeroRefGrid refs={detail.counters} emptyLabel="No tiene counters directos registrados." onSelectHero={onSelectHero} />
      </div>

      <div className="hero-section counteredby-section">
        <h3 className="hero-section-title">✕ Es contrarrestado por</h3>
        <p className="hero-section-hint">Si el equipo enemigo elige a estos héroes, {detail.name} queda en desventaja directa.</p>
        <HeroRefGrid refs={detail.counteredBy} emptyLabel="No tiene counters directos conocidos en su contra." onSelectHero={onSelectHero} />
      </div>

      <div className="hero-section synergy-section">
        <h3 className="hero-section-title">◈ Sinergiza con</h3>
        <p className="hero-section-hint">Combina bien con estos héroes dentro del mismo equipo.</p>
        <HeroRefGrid refs={detail.synergizesWith} emptyLabel="No tiene sinergias curadas registradas." onSelectHero={onSelectHero} />
      </div>
    </div>
  );
}

// Portrait grande con el mismo fallback de iniciales que ImageTile, pero sin
// comportarse como botón seleccionable (es solo el retrato del héroe activo).
function ImageTileLarge({ src, alt }) {
  const [error, setError] = useState(false);
  const initials = alt
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return !error ? (
    <img src={src} alt={alt} onError={() => setError(true)} draggable={false} />
  ) : (
    <span className="image-tile-fallback">{initials}</span>
  );
}
