import React from "react";

const ROLE_LABEL = { tank: "Tanque", dps: "Daño", support: "Soporte" };

const PLAYSTYLE_LABEL = {
  aggressive: "Agresivo",
  defensive: "Defensivo",
  hitscan: "Hitscan",
  flanker: "Flanqueador",
  sniper: "Francotirador",
  projectile: "Proyectil",
  zone: "Control de área",
  healer: "Sanador puro",
  hybrid: "Híbrido (heal + daño)",
  enabler: "Utilidad / peel",
};

export default function PreferencesPanel({ playstylesByRole, preferences, onToggle }) {
  if (!playstylesByRole) return null;

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="eyebrow">00 · Preferencias</span>
        <h2>Tu estilo de juego</h2>
      </div>
      <p className="hint">
        Opcional. Si marcás un estilo para un rol, solo se van a recomendar héroes de ese rol que calcen — el resto se
        descarta directamente (ej: si elegís "Flanqueador" en daño, Widowmaker queda afuera).
      </p>
      {Object.entries(playstylesByRole).map(([role, styles]) => (
        <div className="role-block" key={role}>
          <div className={`role-tag role-${role}`}>{ROLE_LABEL[role]}</div>
          <div className="chip-row">
            {styles.map((style) => {
              const active = preferences[role]?.includes(style);
              return (
                <button
                  key={style}
                  type="button"
                  className={`chip ${active ? "chip-active" : ""}`}
                  onClick={() => onToggle(role, style)}
                >
                  {PLAYSTYLE_LABEL[style] || style}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
