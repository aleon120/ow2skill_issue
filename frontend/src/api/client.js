const BASE = import.meta.env.VITE_API_URL || "/api";

export async function fetchHeroes() {
  const res = await fetch(`${BASE}/heroes`);
  if (!res.ok) throw new Error("No se pudieron cargar los héroes");
  return res.json();
}

// Ficha completa de un héroe puntual: counters, counteredBy, synergizesWith,
// tags, mapPreference, etc. Usado en la pestaña "Personajes" (guía de counters).
export async function fetchHeroDetail(heroId) {
  const res = await fetch(`${BASE}/heroes/${heroId}`);
  if (!res.ok) throw new Error("No se pudo cargar la ficha del héroe");
  return res.json();
}

export async function fetchMaps() {
  const res = await fetch(`${BASE}/maps`);
  if (!res.ok) throw new Error("No se pudieron cargar los mapas");
  return res.json();
}

export async function fetchPlaystyles() {
  const res = await fetch(`${BASE}/playstyles`);
  if (!res.ok) throw new Error("No se pudieron cargar los estilos de juego");
  return res.json();
}

// Modos de juego disponibles ("5v5" / "6v6") con su composición de roles y tamaño de plantel.
// Fuente única de verdad: evita que el frontend hardcodee límites que puedan desalinearse del backend.
export async function fetchModes() {
  const res = await fetch(`${BASE}/modes`);
  if (!res.ok) throw new Error("No se pudieron cargar los modos de juego");
  return res.json();
}

export async function fetchRecommendation({ mapId, allyIds, enemyIds, preferences, mode = "5v5" }) {
  const res = await fetch(`${BASE}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mapId, allyIds, enemyIds, preferences, mode }),
  });
  if (!res.ok) throw new Error("No se pudo calcular la recomendación");
  return res.json();
}

export async function fetchTeamCheck({ mapId, allyIds, enemyIds, preferences, mode = "5v5" }) {
  const res = await fetch(`${BASE}/team-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mapId, allyIds, enemyIds, preferences, mode }),
  });
  if (!res.ok) throw new Error("No se pudo analizar el equipo");
  return res.json();
}
