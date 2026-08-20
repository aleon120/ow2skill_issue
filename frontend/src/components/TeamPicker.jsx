import React from "react";
import ImageTile from "./ImageTile.jsx";

const ROLE_LABEL = { tank: "Tanque", dps: "Daño", support: "Soporte" };
const ROLE_ORDER = ["tank", "dps", "support"];

export default function TeamPicker({ title, eyebrow, heroes, selectedIds, onToggle, maxSize = 5 }) {
  const byRole = ROLE_ORDER.map((role) => ({
    role,
    list: heroes.filter((h) => h.role === role),
  }));

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <span className="counter-pill">{selectedIds.length}/{maxSize}</span>
      </div>
      {byRole.map(({ role, list }) => (
        <div className="role-block" key={role}>
          <div className={`role-tag role-${role}`}>{ROLE_LABEL[role]}</div>
          <div className="tile-row">
            {list.map((h) => {
              const active = selectedIds.includes(h.id);
              const full = selectedIds.length >= maxSize && !active;
              return (
                <ImageTile
                  key={h.id}
                  src={`/heroes/${h.id}.png`}
                  alt={h.name}
                  active={active}
                  disabled={full}
                  onClick={() => onToggle(h.id)}
                  ringClass={`ring-${role}`}
                  variant="hero"
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
