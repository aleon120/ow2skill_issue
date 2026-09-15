import React, { useEffect, useState } from "react";
import { fetchCompositions } from "../api/client.js";

const ROLE_LABEL = { tank: "Tanque", dps: "Daño", support: "Soporte" };
const ROLE_ORDER = ["tank", "dps", "support"];

function CandidateThumb({ src, alt }) {
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

function topNote(candidate) {
  const notes = [
    ...(candidate.synergyDetail || []),
    ...(candidate.archetypeSynergyDetail || []),
    ...(candidate.compositionDetail || []),
  ];
  return notes[0]?.note ?? null;
}

export default function CompositionGuide({ heroId, mode, onSelectHero }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!heroId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchCompositions(heroId, mode)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [heroId, mode]);

  if (!heroId) {
    return (
      <div className="panel hero-detail-panel hero-detail-empty">
        <p className="empty-state">Elegí un héroe ancla para armar una composición a su alrededor.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel hero-detail-panel">
        <p className="empty-state">No se pudo cargar la composición: {error}</p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="panel hero-detail-panel hero-detail-empty">
        <p className="empty-state">Armando la composición...</p>
      </div>
    );
  }

  const anyRoleWithSlots = ROLE_ORDER.some((role) => data.slotsNeeded[role] > 0);

  return (
    <div className="panel hero-detail-panel">
      <div className="panel-header">
        <span className="eyebrow">Composición alrededor de {data.hero.name}</span>
        <h2>
          Jugá en torno a <span className={`role-tag role-${data.hero.role}`}>{ROLE_LABEL[data.hero.role]}</span> {data.hero.name}
        </h2>
      </div>
      <p className="hero-section-hint">
        Sugerencias por sinergia curada, combo de arquetipo de tanque, balance de composición (mezcla de dps/soporte) y meta
        actual — en modo {data.mode}. No depende de mapa ni de rivales.
      </p>

      {!anyRoleWithSlots && <p className="empty-state">Este modo no deja más lugares libres para {data.hero.name}.</p>}

      {ROLE_ORDER.map((role) => {
        const needed = data.slotsNeeded[role];
        if (needed <= 0) return null;
        const list = data.groups[role] || [];
        return (
          <div className="hero-section composition-role-block" key={role}>
            <h3 className="hero-section-title">
              <span className={`role-tag role-${role}`}>{ROLE_LABEL[role]}</span>
              {needed > 1 ? ` — necesitás ${needed}` : " — necesitás 1"}
            </h3>
            {list.length === 0 ? (
              <p className="hero-ref-empty">No hay candidatos disponibles.</p>
            ) : (
              <div className="hero-ref-grid">
                {list.map((c) => (
                  <button
                    type="button"
                    key={c.hero.id}
                    className="hero-ref-card composition-card"
                    onClick={() => onSelectHero(c.hero.id)}
                    title={c.hero.name}
                  >
                    <CandidateThumb src={`/heroes/${c.hero.id}.png`} alt={c.hero.name} />
                    <span className="hero-ref-name composition-card-name">
                      <span className="composition-card-title-row">
                        {c.hero.name}
                        <span className="composition-score">{c.total > 0 ? `+${c.total}` : c.total}</span>
                      </span>
                      {topNote(c) && <span className="composition-card-note">{topNote(c)}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}