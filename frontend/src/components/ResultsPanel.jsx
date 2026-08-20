import React, { useState } from "react";

const ROLE_LABEL = { tank: "Tanque", dps: "Daño", support: "Soporte" };

function ScoreBar({ breakdown, total, maxTotal }) {
  const clampedTotal = Math.max(total, 0.001);
  const pct = Math.min(100, (Math.max(total, 0) / Math.max(maxTotal, 1)) * 100);
  return (
    <div className="score-bar-track">
      <div className="score-bar-fill" style={{ width: `${pct}%` }}>
        <span className="score-bar-segments">
          <span className="seg seg-map" style={{ flexGrow: Math.max(breakdown.mapScore, 0) }} />
          <span className="seg seg-range" style={{ flexGrow: Math.max(breakdown.rangeScore, 0) }} />
          <span className="seg seg-counter" style={{ flexGrow: Math.max(breakdown.counterScore, 0) }} />
          <span className="seg seg-synergy" style={{ flexGrow: Math.max(breakdown.synergyScore, 0) }} />
          <span className="seg seg-archetype" style={{ flexGrow: Math.max(breakdown.archetypeSynergyScore, 0) }} />
          <span className="seg seg-composition" style={{ flexGrow: Math.max(breakdown.compositionScore, 0) }} />
          <span className="seg seg-meta" style={{ flexGrow: Math.max(breakdown.metaScore, 0) }} />
          <span className="seg seg-mobility" style={{ flexGrow: Math.max(breakdown.mobilityScore, 0) }} />
        </span>
      </div>
    </div>
  );
}

export default function ResultsPanel({ data, loading, error, isLastPick }) {
  const [expandedId, setExpandedId] = useState(null);

  if (error) {
    return (
      <div className="panel results-panel">
        <div className="panel-header">
          <span className="eyebrow">03 · Análisis</span>
          <h2>Ocurrió un problema</h2>
        </div>
        <p className="empty-state">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="panel results-panel">
        <div className="panel-header">
          <span className="eyebrow">03 · Análisis</span>
          <h2>Calculando...</h2>
        </div>
        <p className="empty-state">Cruzando datos de mapa, counters y sinergias.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="panel results-panel">
        <div className="panel-header">
          <span className="eyebrow">03 · Análisis</span>
          <h2>Esperando selección</h2>
        </div>
        <p className="empty-state">Elegí un mapa para empezar a ver recomendaciones.</p>
      </div>
    );
  }

  const maxTotal = Math.max(...data.recommendations.map((r) => r.total), 1);
  const top = data.recommendations.slice(0, 8);

  const pickedCount = data.roleCounts ? Object.values(data.roleCounts).reduce((a, b) => a + b, 0) : null;
  const pickNumber = pickedCount != null ? pickedCount + 1 : null;

  return (
    <div className="panel results-panel">
      <div className="panel-header">
        <span className="eyebrow">03 · Análisis</span>
        <h2>{isLastPick && pickNumber ? `Mejor ${pickNumber}º héroe` : "Héroes recomendados"}</h2>
      </div>

      {isLastPick && data.missingRole && (
        <p className="hint">
          Rol faltante detectado: <strong>{ROLE_LABEL[data.missingRole]}</strong>. Mostrando solo opciones de ese rol.
        </p>
      )}

      <div className="legend">
        <span><i className="dot dot-map" /> Mapa</span>
        <span><i className="dot dot-range" /> Rango</span>
        <span><i className="dot dot-counter" /> Counter</span>
        <span><i className="dot dot-synergy" /> Sinergia</span>
        <span><i className="dot dot-archetype" /> Combo tanque</span>
        <span><i className="dot dot-composition" /> Composición</span>
        <span><i className="dot dot-meta" /> Meta</span>
        <span><i className="dot dot-mobility" /> Movilidad</span>
      </div>

      <ol className="results-list">
        {top.map((r, idx) => {
          const expanded = expandedId === r.hero.id;
          return (
            <li key={r.hero.id} className={`result-row ${idx === 0 ? "result-top" : ""}`}>
              <button
                type="button"
                className="result-row-header"
                onClick={() => setExpandedId(expanded ? null : r.hero.id)}
              >
                <span className="result-rank">{idx + 1}</span>
                <span className="result-name">
                  {r.hero.name}
                  <span className={`role-tag role-${r.hero.role} small`}>{ROLE_LABEL[r.hero.role]}</span>
                </span>
                <span className="result-score">{r.total}</span>
              </button>
              <ScoreBar breakdown={r.breakdown} total={r.total} maxTotal={maxTotal} />

              {expanded && (
                <div className="result-detail">
                  <p className="result-detail-line">
                    Mapa: <strong>{r.breakdown.mapScore}</strong> · Rango: <strong>{r.breakdown.rangeScore}</strong> · Counters: <strong>{r.breakdown.counterScore}</strong> · Sinergia: <strong>{r.breakdown.synergyScore}</strong> · Combo tanque: <strong>{r.breakdown.archetypeSynergyScore}</strong> · Composición: <strong>{r.breakdown.compositionScore}</strong> · Meta: <strong>{r.breakdown.metaScore}</strong> · Movilidad: <strong>{r.breakdown.mobilityScore}</strong>
                  </p>
                  {r.counterDetail.length > 0 && (
                    <div className="detail-block">
                      <span className="detail-label">Contra el equipo enemigo</span>
                      <ul>
                        {r.counterDetail.map((d, i) => (
                          <li key={i} className={d.relation === "counter" ? "positive" : "negative"}>{d.note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.mobilityDetail && r.mobilityDetail.length > 0 && (
                    <div className="detail-block">
                      <span className="detail-label">Movilidad</span>
                      <ul>
                        {r.mobilityDetail.map((d, i) => (
                          <li key={i} className="positive">{d.note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.synergyDetail.length > 0 && (
                    <div className="detail-block">
                      <span className="detail-label">Con tu equipo</span>
                      <ul>
                        {r.synergyDetail.map((d, i) => (
                          <li key={i} className="positive">{d.note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.archetypeSynergyDetail && r.archetypeSynergyDetail.length > 0 && (
                    <div className="detail-block">
                      <span className="detail-label">Combo de subtipo de tanque</span>
                      <ul>
                        {r.archetypeSynergyDetail.map((d, i) => (
                          <li key={i} className="positive">{d.note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.compositionDetail && r.compositionDetail.length > 0 && (
                    <div className="detail-block">
                      <span className="detail-label">Composición del equipo</span>
                      <ul>
                        {r.compositionDetail.map((d, i) => (
                          <li key={i} className={d.note.includes("poco flexible") || d.note.includes("conviene") ? "negative" : "positive"}>
                            {d.note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.counterDetail.length === 0 &&
                    r.synergyDetail.length === 0 &&
                    (!r.mobilityDetail || r.mobilityDetail.length === 0) &&
                    (!r.archetypeSynergyDetail || r.archetypeSynergyDetail.length === 0) &&
                    (!r.compositionDetail || r.compositionDetail.length === 0) && (
                      <p className="detail-block muted">Sin interacciones directas registradas; el puntaje viene principalmente del mapa y el rango.</p>
                    )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
