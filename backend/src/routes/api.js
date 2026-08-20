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
