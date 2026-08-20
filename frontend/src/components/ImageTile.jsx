import React, { useState } from "react";

/**
 * Botón cuadrado que muestra solo una imagen (sin nombre visible).
 * El nombre queda disponible como tooltip (title) por accesibilidad,
 * pero no se renderiza como texto en el tile.
 * Si la imagen no existe todavía (404), muestra un fallback con las
 * iniciales en vez de un ícono de imagen rota.
 */
export default function ImageTile({ src, alt, active, onClick, disabled, ringClass = "", variant = "hero" }) {
  const [error, setError] = useState(false);

  const initials = alt
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      type="button"
      className={`image-tile image-tile-${variant} ${active ? "image-tile-active" : ""} ${ringClass}`}
      onClick={onClick}
      disabled={disabled}
      title={alt}
      aria-label={alt}
    >
      {!error ? (
        <img src={src} alt={alt} onError={() => setError(true)} draggable={false} />
      ) : (
        <span className="image-tile-fallback">{initials}</span>
      )}
    </button>
  );
}
