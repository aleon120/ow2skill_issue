import React from "react";

const ROLE_LABEL = { tank: "Tanque", dps: "Daño", support: "Soporte" };

const STATUS_LABEL = {
  risk: "En riesgo",
  ok: "Parejo",
  strong: "Favorable",
};

function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{STATUS_LABEL[status]}</span>;
}

export default function TeamCheckPanel({ data, loading, error, mode = "5v5" }) {
  const tankWeight = mode === "6v6" ? "1.3" : "1.5";
  if (error) {
    return (
      <div className="panel">
        <div className="panel-header">
          <span className="eyebrow">04 · Matchups</span>
          <h2>Sugerencia de cambios</h2>
        </div>
        <p className="empty-state">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="panel">
        <div className="panel-header">
          <span className="eyebrow">04 · Matchups</span>
          <h2>Analizando matchups...</h2>
        </div>
      </div>
    );
  }

  if (!data || data.team.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header">
          <span className="eyebrow">04 · Matchups</span>
          <h2>Sugerencia de cambios</h2>
        </div>
        <p className="empty-state">
          Elegí héroes en tu equipo (y en el enemigo) para ver si conviene cambiar a alguno según los matchups directos.
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="eyebrow">04 · Matchups</span>
        <h2>Sugerencia de cambios</h2>
      </div>
      <p className="hint">
        El peso de cada matchup depende del rol: tanque vs. tanque (x{tankWeight} en {mode}), dps vs. dps y soporte
        vs. tanque/dps pesan más que el resto. Los voladores además restan si el rival tiene un dps hitscan o
        francotirador. Entre tanques sin counter declarado, aplica el triángulo de subtipos: poke &gt; brawl &gt;
        dive &gt; poke.
      </p>

      <div className="team-check-table">
        {data.team.map((row) => (
          <div key={row.hero.id} className={`team-check-row status-border-${row.status}`}>
            <div className="team-check-row-top">
              <span className="result-name">
                {row.hero.name}
                <span className={`role-tag role-${row.hero.role} small`}>{ROLE_LABEL[row.hero.role]}</span>
              </span>
              <StatusBadge status={row.status} />
              <span className="result-score">{row.matchupScore}</span>
            </div>

            {row.matchupDetail.length > 0 && (
              <ul className="team-check-detail">
                {row.matchupDetail.map((d, i) => (
                  <li key={i} className={d.relation === "counter" ? "positive" : "negative"}>
                    {d.note}
                  </li>
                ))}
              </ul>
            )}

            {row.status === "risk" && row.suggestions.length > 0 && (
              <div className="swap-suggestions">
                <span className="detail-label">Considerá cambiar a</span>
                <div className="chip-row">
                  {row.suggestions.map((s) => (
                    <span key={s.hero.id} className="swap-chip">
                      {s.hero.name} <span className="swap-chip-score">+{s.improvement}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {row.status === "risk" && row.suggestions.length === 0 && (
              <p className="detail-block muted">Matchup complicado, pero no hay una alternativa clara dentro del mismo rol.</p>
            )}
          </div>
        ))}
      </div>

      {data.compositionWarnings && data.compositionWarnings.length > 0 && (
        <div className="composition-warnings">
          <span className="detail-label">Composición del equipo</span>
          {data.compositionWarnings.map((w, i) => (
            <div key={i} className="composition-warning-row">
              <p className="detail-block negative">{w.message}</p>
              {w.suggestions.length > 0 && (
                <div className="chip-row">
                  {w.suggestions.map((s) => (
                    <span key={s.id} className="swap-chip">
                      {s.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
