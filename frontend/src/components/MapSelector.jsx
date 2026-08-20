import React from "react";
import ImageTile from "./ImageTile.jsx";

export default function MapSelector({ maps, selectedMapId, onSelect }) {
  const grouped = maps.reduce((acc, m) => {
    acc[m.type] = acc[m.type] || [];
    acc[m.type].push(m);
    return acc;
  }, {});

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="eyebrow">01 · Terreno</span>
        <h2>Selecciona el mapa</h2>
      </div>
      <div className="map-groups">
        {Object.entries(grouped).map(([type, list]) => (
          <div className="map-group" key={type}>
            <div className="map-group-label">{type}</div>
            <div className="tile-row">
              {list.map((m) => (
                <ImageTile
                  key={m.id}
                  src={`/maps/${m.id}.png`}
                  alt={m.name}
                  active={selectedMapId === m.id}
                  onClick={() => onSelect(m.id)}
                  variant="map"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
