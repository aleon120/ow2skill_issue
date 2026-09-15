const express = require("express");
const router = express.Router();
const {
  recommend,
  teamCheck,
  heroes,
  maps,
  PLAYSTYLES_BY_ROLE,
  ROLE_LIMITS_BY_MODE,
  rosterSize,
} = require("../logic/recommend");

const VALID_MODES = Object.keys(ROLE_LIMITS_BY_MODE); // ["5v5", "6v6"]

function isValidMode(mode) {
  return VALID_MODES.includes(mode);
}

// Lista de héroes
router.get("/heroes", (req, res) => {
  res.json(
    heroes.map((h) => ({
      id: h.id,
      name: h.name,
      role: h.role,
      archetype: h.archetype,
      playstyle: h.playstyle,
      range: h.range,
      mobility: h.mobility,
      metaTier: h.metaTier,
      tankType: h.tankType,
      dpsRole: h.dpsRole,
      supportRole: h.supportRole,
    }))
  );
});

// Ficha completa de un héroe: incluye counters/counteredBy/synergizesWith,
// mapPreference y tags — todo lo que la vista "Personajes" necesita para
// mostrar la guía de matchups de un héroe puntual. Los ids de counters/
// counteredBy/synergizesWith se resuelven a { id, name, role } para que el
// frontend no tenga que cruzar contra la lista completa de héroes.
function resolveHeroRefs(ids = []) {
  return ids
    .map((id) => heroes.find((h) => h.id === id))
    .filter(Boolean)
    .map((h) => ({ id: h.id, name: h.name, role: h.role }));
}

router.get("/heroes/:id", (req, res) => {
  const hero = heroes.find((h) => h.id === req.params.id);
  if (!hero) {
    return res.status(404).json({ error: "Héroe no encontrado" });
  }
  res.json({
    id: hero.id,
    name: hero.name,
    role: hero.role,
    archetype: hero.archetype,
    range: hero.range,
    mobility: hero.mobility,
    tags: hero.tags,
    mapPreference: hero.mapPreference,
    metaTier: hero.metaTier,
    playstyle: hero.playstyle,
    tankType: hero.tankType,
    dpsRole: hero.dpsRole,
    supportRole: hero.supportRole,
    counters: resolveHeroRefs(hero.counters),
    counteredBy: resolveHeroRefs(hero.counteredBy),
    synergizesWith: resolveHeroRefs(hero.synergizesWith),
  });
});

// Sugerencias de composición: dado un héroe ancla, qué compañeros conviene
// elegir para completar el equipo (sin depender de mapa ni de rivales, solo
// sinergia + balance de composición + meta). Reutiliza el mismo motor que
// /recommend, pero sin exigir mapId y agrupando el resultado por rol para
// que el frontend pueda mostrar "tanques sugeridos / dps sugeridos / soporte
// sugerido" directamente.
const COMPOSITIONS_TOP_N = 6;

router.get("/compositions/:heroId", (req, res) => {
  const hero = heroes.find((h) => h.id === req.params.heroId);
  if (!hero) {
    return res.status(404).json({ error: "Héroe no encontrado" });
  }
  const mode = req.query.mode || "5v5";
  if (!isValidMode(mode)) {
    return res.status(400).json({ error: `Modo inválido, tiene que ser uno de: ${VALID_MODES.join(", ")}` });
  }

  const result = recommend({ mapId: null, allyIds: [hero.id], enemyIds: [], preferences: {}, mode });

  const groups = { tank: [], dps: [], support: [] };
  for (const rec of result.recommendations) {
    const role = rec.hero.role;
    if (groups[role] && groups[role].length < COMPOSITIONS_TOP_N) {
      groups[role].push({
        hero: rec.hero,
        total: rec.total,
        synergyDetail: rec.synergyDetail,
        archetypeSynergyDetail: rec.archetypeSynergyDetail,
        compositionDetail: rec.compositionDetail,
      });
    }
  }

  const roleLimits = ROLE_LIMITS_BY_MODE[mode];
  const slotsNeeded = Object.fromEntries(
    Object.entries(roleLimits).map(([role, limit]) => [role, Math.max(0, limit - (hero.role === role ? 1 : 0))])
  );

  res.json({
    hero: { id: hero.id, name: hero.name, role: hero.role },
    mode,
    roleLimits,
    slotsNeeded,
    groups,
  });
});

// Lista de mapas
router.get("/maps", (req, res) => {
  res.json(maps.map((m) => ({ id: m.id, name: m.name, type: m.type, tags: m.tags, range: m.range })));
});

// Vocabulario de estilos de juego disponibles por rol (para armar los selectores del frontend)
router.get("/playstyles", (req, res) => {
  res.json(PLAYSTYLES_BY_ROLE);
});

// Modos de juego disponibles y su composición de roles (1-2-2 en 5v5, 2-2-2 en 6v6).
// El frontend usa esto como fuente única de verdad en vez de hardcodear los límites.
router.get("/modes", (req, res) => {
  res.json(
    VALID_MODES.reduce((acc, mode) => {
      acc[mode] = { roleLimits: ROLE_LIMITS_BY_MODE[mode], rosterSize: rosterSize(mode) };
      return acc;
    }, {})
  );
});

// Motor de recomendación principal
// body: { mapId, allyIds: [], enemyIds: [], preferences?: { tank: [], dps: [], support: [] }, mode?: "5v5" | "6v6" }
router.post("/recommend", (req, res) => {
  const { mapId, allyIds = [], enemyIds = [], preferences = {}, mode = "5v5" } = req.body || {};

  if (!mapId) {
    return res.status(400).json({ error: "Falta mapId" });
  }
  if (!isValidMode(mode)) {
    return res.status(400).json({ error: `Modo inválido, tiene que ser uno de: ${VALID_MODES.join(", ")}` });
  }
  const maxRoster = rosterSize(mode);
  if (allyIds.length > maxRoster) {
    return res.status(400).json({ error: `No puede haber más de ${maxRoster} aliados en modo ${mode}` });
  }
  if (enemyIds.length > maxRoster) {
    return res.status(400).json({ error: `No puede haber más de ${maxRoster} enemigos en modo ${mode}` });
  }

  const result = recommend({ mapId, allyIds, enemyIds, preferences, mode });
  res.json(result);
});

// Analiza el equipo aliado ya elegido y sugiere cambios según el equipo enemigo
// body: { mapId, allyIds: [], enemyIds: [], preferences?: { tank: [], dps: [], support: [] }, mode?: "5v5" | "6v6" }
router.post("/team-check", (req, res) => {
  const { mapId, allyIds = [], enemyIds = [], preferences = {}, mode = "5v5" } = req.body || {};

  if (allyIds.length === 0) {
    return res.status(400).json({ error: "Elegí al menos un héroe aliado para analizar" });
  }
  if (!isValidMode(mode)) {
    return res.status(400).json({ error: `Modo inválido, tiene que ser uno de: ${VALID_MODES.join(", ")}` });
  }
  const maxRoster = rosterSize(mode);
  if (allyIds.length > maxRoster) {
    return res.status(400).json({ error: `No puede haber más de ${maxRoster} aliados en modo ${mode}` });
  }
  if (enemyIds.length > maxRoster) {
    return res.status(400).json({ error: `No puede haber más de ${maxRoster} enemigos en modo ${mode}` });
  }

  const result = teamCheck({ mapId, allyIds, enemyIds, preferences, mode });
  res.json(result);
});

module.exports = router;