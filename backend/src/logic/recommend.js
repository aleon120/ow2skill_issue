const heroes = require("../data/heroes.json");
const maps = require("../data/maps.json");

const heroById = Object.fromEntries(heroes.map((h) => [h.id, h]));
const mapById = Object.fromEntries(maps.map((m) => [m.id, m]));

function getHero(id) {
  return heroById[id] || null;
}

function getMap(id) {
  return mapById[id] || null;
}

/**
 * Puntaje base de un héroe para un mapa dado, según coincidencia de tags.
 * Además, los tanques dive reciben un bonus extra en mapas con high_ground:
 * su movilidad aérea/de asalto les permite aprovechar el desnivel para
 * flanquear o escapar, algo que los tanques brawl y poke no pueden hacer.
 */
const DIVE_TANK_HIGH_GROUND_BONUS = 2;

function mapScore(hero, map) {
  if (!map) return 0;
  const overlap = hero.mapPreference.filter((t) => map.tags.includes(t));
  let score = overlap.length * 1.5; // cada tag coincidente suma 1.5 puntos

  if (hero.role === "tank" && hero.tankType === "dive" && map.tags.includes("high_ground")) {
    score += DIVE_TANK_HIGH_GROUND_BONUS;
  }

  return round1(score);
}

/**
 * Puntaje de rango: cuánto coincide el/los rango(s) de combate del héroe
 * (hero.range, ej: ["close","mid"]) con el/los rango(s) del mapa (map.range).
 * Un héroe versátil en 2 o 3 rangos tiene más chances de coincidir que uno
 * de un solo rango (ej: Widowmaker solo "long").
 */
function rangeScore(hero, map) {
  if (!map || !hero.range) return 0;
  const overlap = hero.range.filter((r) => map.range.includes(r));
  return round1(overlap.length * 1.3); // cada rango coincidente suma 1.3 puntos
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Cuánto le importa a cada rol el matchup contra cada rol enemigo.
 * Un tanque se preocupa sobre todo del tanque rival (ej: D.Va vs Zarya).
 * Un dps se preocupa sobre todo del dps rival.
 * Un soporte se preocupa de tanque y dps rival por igual, pero poco de otros soportes.
 *
 * Depende del modo (5v5 / 6v6) porque en 6v6 hay DOS tanques por equipo:
 * cada matchup individual tanque-vs-tanque pesa un poco menos (1.5 -> 1.3)
 * porque la responsabilidad de pelear al tanque rival ya no recae en un
 * único héroe, sino que se reparte entre los dos. El resto de los pesos
 * (dps/soporte) no cambia entre modos.
 */
const ROLE_MATCHUP_WEIGHT_BY_MODE = {
  "5v5": {
    tank: { tank: 1.5, dps: 0.6, support: 0.5 },
    dps: { tank: 0.6, dps: 1.4, support: 0.7 },
    support: { tank: 1.0, dps: 1.0, support: 0.5 },
  },
  "6v6": {
    tank: { tank: 1.3, dps: 0.6, support: 0.5 },
    dps: { tank: 0.6, dps: 1.4, support: 0.7 },
    support: { tank: 1.0, dps: 1.0, support: 0.5 },
  },
};

const DEFAULT_MODE = "5v5";

function matchupWeight(heroRole, enemyRole, mode = DEFAULT_MODE) {
  const table = ROLE_MATCHUP_WEIGHT_BY_MODE[mode] || ROLE_MATCHUP_WEIGHT_BY_MODE[DEFAULT_MODE];
  return table[heroRole]?.[enemyRole] ?? 1;
}

/**
 * Triángulo de counters entre subtipos de tanque (hero.tankType):
 *   poke  > brawl  (el poke desgasta al brawl antes de que llegue a pegar)
 *   brawl > dive   (el brawl tiene el sustain/cc para aguantar y punishear el dive)
 *   dive  > poke   (el dive salta directo a la backline del poke, que no tiene con qué defenderse de cerca)
 * TANK_TYPE_BEATS[x] = el subtipo que x vence.
 */
const TANK_TYPE_BEATS = { poke: "brawl", brawl: "dive", dive: "poke" };
const TANK_TYPE_LABEL = { dive: "dive", brawl: "brawl", poke: "poke" };
const TANK_TRIANGLE_BONUS = 4;

/**
 * Puntaje del triángulo de subtipos de tanque. Solo compara tanque contra tanque.
 * Es un *fallback*: si ya existe una relación de counter explícita y curada entre
 * esos dos héroes puntuales (counters/counteredBy), esta función no se usa —
 * la relación curada manda sin diluirse (mismo criterio que ya usa counterScore()
 * para sus ajustes genéricos por tag, ver el flag `directHit` más abajo).
 */
function tankTypeScore(hero, enemy, mode) {
  if (hero.role !== "tank" || enemy.role !== "tank") return 0;
  if (!hero.tankType || !enemy.tankType || hero.tankType === enemy.tankType) return 0;
  const w = matchupWeight("tank", "tank", mode);
  if (TANK_TYPE_BEATS[hero.tankType] === enemy.tankType) return round1(TANK_TRIANGLE_BONUS * w);
  if (TANK_TYPE_BEATS[enemy.tankType] === hero.tankType) return round1(-TANK_TRIANGLE_BONUS * w);
  return 0;
}

/**
 * Puntaje de counter: cuánto contrarresta `hero` a los héroes enemigos,
 * y cuánto es contrarrestado por ellos. El peso de cada matchup depende
 * del rol de ambos héroes (ver ROLE_MATCHUP_WEIGHT), y se suma una
 * penalización posicional para héroes voladores (dps/soporte) frente a
 * hitscan o francotiradores enemigos.
 */
function counterScore(hero, enemyIds, mode = DEFAULT_MODE) {
  let score = 0;
  const detail = [];
  for (const enemyId of enemyIds) {
    const enemy = getHero(enemyId);
    if (!enemy) continue;

    const w = matchupWeight(hero.role, enemy.role, mode);
    let directHit = false;

    if (hero.counters.includes(enemyId) || enemy.counteredBy.includes(hero.id)) {
      const pts = round1(5 * w);
      score += pts;
      directHit = true;
      detail.push({ enemy: enemy.name, relation: "counter", note: `${hero.name} es fuerte contra ${enemy.name}` });
    }
    if (hero.counteredBy.includes(enemyId) || enemy.counters.includes(hero.id)) {
      const pts = round1(-5 * w);
      score += pts;
      directHit = true;
      detail.push({ enemy: enemy.name, relation: "countered_by", note: `${hero.name} es débil contra ${enemy.name}` });
    }

    // Los ajustes genéricos por tags/subtipo solo aplican si no hubo ya un counter directo
    // registrado contra este mismo enemigo (para no contradecir una relación explícita,
    // ej: Kiriko cuenta como counter directo de Ana aunque Ana tenga el tag "anti-dive").
    if (!directHit) {
      if (enemy.tags?.includes("flying") && hero.tags?.includes("anti-flyer")) {
        score += round1(2 * w);
        detail.push({ enemy: enemy.name, relation: "counter", note: `${hero.name} castiga héroes voladores como ${enemy.name}` });
      }
      if (enemy.tags?.includes("anti-dive") && hero.archetype.includes("dive")) {
        score += round1(-1 * w);
        detail.push({ enemy: enemy.name, relation: "countered_by", note: `${enemy.name} tiene herramientas anti-dive` });
      }

      const triangle = tankTypeScore(hero, enemy, mode);
      if (triangle > 0) {
        score += triangle;
        detail.push({
          enemy: enemy.name,
          relation: "counter",
          note: `Tanque ${TANK_TYPE_LABEL[hero.tankType]} vs. tanque ${TANK_TYPE_LABEL[enemy.tankType]}: ventaja de subtipo`,
        });
      } else if (triangle < 0) {
        score += triangle;
        detail.push({
          enemy: enemy.name,
          relation: "countered_by",
          note: `Tanque ${TANK_TYPE_LABEL[hero.tankType]} vs. tanque ${TANK_TYPE_LABEL[enemy.tankType]}: desventaja de subtipo`,
        });
      }
    }

    // Penalización posicional: un aliado volador (dps o soporte) queda muy expuesto
    // si el enemigo tiene un dps hitscan o francotirador que lo puede bajar del aire.
    if (
      hero.role !== "tank" &&
      hero.tags?.includes("flying") &&
      enemy.role === "dps" &&
      (enemy.tags?.includes("hitscan") || enemy.tags?.includes("sniper"))
    ) {
      score -= 3;
      detail.push({
        enemy: enemy.name,
        relation: "countered_by",
        note: `${hero.name} vuela y queda expuesto al hitscan de ${enemy.name}`,
      });
    }
  }
  return { score: round1(score), detail };
}

/**
 * Umbral de movilidad (1-5) a partir del cual un héroe enemigo se considera
 * una "amenaza móvil" (dive, flanqueo, tanque agresivo, etc.).
 */
const MOBILITY_THREAT_THRESHOLD = 4;

/**
 * Puntaje de movilidad: cuando el equipo enemigo tiene héroes muy móviles
 * (ej: D.Va, Genji, Tracer, Wrecking Ball — mobility >= 4), la propia
 * movilidad ayuda a perseguirlos, escapar o reposicionarse. Pero si el héroe
 * ya es un counter directo de esa amenaza (ej: Brigitte vs dive), no se suma
 * este bonus para no duplicar lo que ya premia counterScore().
 */
function mobilityScore(hero, enemyIds) {
  const threats = [];
  for (const enemyId of enemyIds) {
    const enemy = getHero(enemyId);
    if (!enemy) continue;
    if ((enemy.mobility ?? 0) < MOBILITY_THREAT_THRESHOLD) continue;

    const alreadyCounters = hero.counters.includes(enemyId) || enemy.counteredBy.includes(hero.id);
    if (alreadyCounters) continue;

    threats.push(enemy);
  }

  if (threats.length === 0) return { score: 0, detail: [] };

  const score = round1((hero.mobility ?? 0) * 0.6);
  const names = threats.map((t) => t.name).join(", ");
  const detail = [
    {
      relation: "mobility",
      note: `El rival tiene héroes muy móviles (${names}); tu movilidad (${hero.mobility ?? 0}/5) ayuda a mantener el ritmo`,
    },
  ];
  return { score, detail };
}


const PLAYSTYLES_BY_ROLE = {
  tank: ["aggressive", "defensive"],
  dps: ["hitscan", "flanker", "sniper", "projectile", "zone"],
  support: ["healer", "hybrid", "enabler"],
};

/**
 * Devuelve true si el héroe pasa el filtro de preferencia de estilo de juego
 * para su rol. Si no hay preferencia definida para ese rol, no filtra nada.
 * Este filtro es un descarte duro: si no calza, el héroe queda afuera de
 * las recomendaciones (no solo puntúa menos).
 */
function matchesPreference(hero, preferences) {
  const prefs = preferences?.[hero.role];
  if (!prefs || prefs.length === 0) return true;
  return prefs.includes(hero.playstyle);
}

/**
 * Puntaje de meta: bonifica o penaliza según qué tan fuerte es el héroe
 * en el parche/tier list actual (independiente del mapa o del draft).
 * metaWeight 1.0 = neutral. >1.0 = pick fuerte del meta. <1.0 = por debajo del meta.
 */
function metaScore(hero) {
  const weight = hero.metaWeight ?? 1.0;
  return Math.round((weight - 1) * 10 * 10) / 10; // ej: 1.3 -> +3, 0.75 -> -2.5
}

/**
 * Puntaje de sinergia: cuánto sinergiza `hero` con los aliados ya elegidos.
 */
function synergyScore(hero, allyIds) {
  let score = 0;
  const detail = [];
  for (const allyId of allyIds) {
    const ally = getHero(allyId);
    if (!ally || ally.id === hero.id) continue;

    if (hero.synergizesWith.includes(allyId) || ally.synergizesWith.includes(hero.id)) {
      score += 3;
      detail.push({ ally: ally.name, note: `Buena combinación entre ${hero.name} y ${ally.name}` });
    }
    // mismo arquetipo = comp coherente (dive con dive, brawl con brawl, etc.)
    const sharedArchetype = hero.archetype.filter((a) => ally.archetype.includes(a));
    if (sharedArchetype.length > 0) {
      score += 1;
      detail.push({ ally: ally.name, note: `Comparten estilo de juego (${sharedArchetype.join(", ")}) con ${ally.name}` });
    }
  }
  return { score, detail };
}

/**
 * Helpers de clasificación usados por las sinergias de subtipo de tanque
 * y por el balance de composición de dps/soporte.
 */
const RANGED_SUPPORT_THRESHOLD_ROLE = "long"; // soporte que puede curar a distancia
const MOBILE_FLEX_DPS_THRESHOLD = 4; // movilidad mínima para considerar "alta movilidad"

function isRangedSupport(h) {
  return h.role === "support" && !!h.range?.includes(RANGED_SUPPORT_THRESHOLD_ROLE);
}
function isMobileFlexDps(h) {
  return h.role === "dps" && h.dpsRole === "flex" && (h.mobility ?? 0) >= MOBILE_FLEX_DPS_THRESHOLD;
}
function isFlankerFlexDps(h) {
  return h.role === "dps" && h.dpsRole === "flex" && h.playstyle === "flanker";
}
function isSpeedSupport(h) {
  return h.role === "support" && !!h.tags?.includes("speed-boost");
}
function isMidOrLongRange(h) {
  return !!(h.range?.includes("mid") || h.range?.includes("long"));
}

/**
 * Sinergia de composición según el subtipo de tanque en el equipo (propio o el
 * candidato evaluado). Es simétrica: no importa si el tanque ya está en el
 * equipo y se evalúa el acompañante, o viceversa.
 *
 *  - dive  + dps flex de alta movilidad (ej. Tracer) o soporte que cura a distancia (range "long")
 *  - brawl + dps flex flanqueador (playstyle "flanker") o soporte que da velocidad (tag "speed-boost")
 *  - poke  + cualquier héroe (de cualquier rol) con rango mid o long — el equipo entero juega a distancia
 *
 * El bonus de poke es más chico porque su condición es mucho más amplia
 * (cualquier rol, dos rangos) y si no se modera, se acumula demasiado rápido
 * en equipos de 5-6 héroes.
 */
const DIVE_BRAWL_SYNERGY_BONUS = 3;
const POKE_SYNERGY_BONUS = 1.5;

function tankArchetypeSynergyScore(hero, allyIds) {
  let score = 0;
  const detail = [];
  for (const allyId of allyIds) {
    const ally = getHero(allyId);
    if (!ally || ally.id === hero.id) continue;

    const heroIsDiveTank = hero.role === "tank" && hero.tankType === "dive";
    const allyIsDiveTank = ally.role === "tank" && ally.tankType === "dive";
    if ((heroIsDiveTank && (isMobileFlexDps(ally) || isRangedSupport(ally))) ||
        (allyIsDiveTank && (isMobileFlexDps(hero) || isRangedSupport(hero)))) {
      score += DIVE_BRAWL_SYNERGY_BONUS;
      detail.push({ ally: ally.name, note: `Combo de dive entre ${hero.name} y ${ally.name}` });
    }

    const heroIsBrawlTank = hero.role === "tank" && hero.tankType === "brawl";
    const allyIsBrawlTank = ally.role === "tank" && ally.tankType === "brawl";
    if ((heroIsBrawlTank && (isFlankerFlexDps(ally) || isSpeedSupport(ally))) ||
        (allyIsBrawlTank && (isFlankerFlexDps(hero) || isSpeedSupport(hero)))) {
      score += DIVE_BRAWL_SYNERGY_BONUS;
      detail.push({ ally: ally.name, note: `Combo de brawl entre ${hero.name} y ${ally.name}` });
    }

    const heroIsPokeTank = hero.role === "tank" && hero.tankType === "poke";
    const allyIsPokeTank = ally.role === "tank" && ally.tankType === "poke";
    if ((heroIsPokeTank && isMidOrLongRange(ally)) || (allyIsPokeTank && isMidOrLongRange(hero))) {
      score += POKE_SYNERGY_BONUS;
      detail.push({ ally: ally.name, note: `Combo de poke (juego a distancia) entre ${hero.name} y ${ally.name}` });
    }
  }
  return { score: round1(score), detail };
}

/**
 * Balance de composición de dps: se prefiere un dps hitscan + un dps flex.
 * Si el equipo ya tiene un dps y el candidato es el segundo:
 *   - roles distintos (hitscan + flex) -> bonus
 *   - mismo rol (hitscan+hitscan o flex+flex) -> penalización,
 *     EXCEPTO doble hitscan en mapas con tag "long" (ahí se permite sin penalizar).
 * Solo se evalúa al elegir exactamente el 2do dps del equipo; con 0 o 2+ dps ya
 * puestos no hay nada que comparar (no se puede saber contra cuál del "segundo"
 * se compara), así que no se aplica ajuste.
 */
const DPS_MIX_BONUS = 3;
const DPS_SAME_ROLE_PENALTY = 3;

function dpsBalanceScore(hero, allyIds, map) {
  if (hero.role !== "dps") return { score: 0, detail: [] };
  const existingDps = allyIds.map(getHero).filter(Boolean).filter((h) => h.role === "dps");
  if (existingDps.length !== 1) return { score: 0, detail: [] };

  const otherDps = existingDps[0];
  if (!hero.dpsRole || !otherDps.dpsRole) return { score: 0, detail: [] };

  const detail = [];
  let score = 0;
  if (hero.dpsRole !== otherDps.dpsRole) {
    score += DPS_MIX_BONUS;
    detail.push({ ally: otherDps.name, note: `Buena mezcla de dps: hitscan + flex junto a ${otherDps.name}` });
  } else {
    const bothHitscan = hero.dpsRole === "hitscan";
    const longMapException = bothHitscan && !!map?.tags?.includes("long");
    if (longMapException) {
      detail.push({ ally: otherDps.name, note: `Doble hitscan permitido en mapas de rango largo` });
    } else {
      score -= DPS_SAME_ROLE_PENALTY;
      detail.push({
        ally: otherDps.name,
        note: `Dos dps ${hero.dpsRole === "hitscan" ? "hitscan" : "flex"} (${hero.name} + ${otherDps.name}): composición poco flexible`,
      });
    }
  }
  return { score: round1(score), detail };
}

/**
 * Balance de composición de soporte: penaliza tener dos main support (falta
 * flexibilidad de utilidad/movilidad). Zenyatta está exento: si él es uno de
 * los dos main support, no se aplica la penalización. Solo se evalúa al
 * elegir exactamente el 2do soporte del equipo, mismo criterio que dps.
 */
const SUPPORT_MAIN_PENALTY = 3;

function supportBalanceScore(hero, allyIds) {
  if (hero.role !== "support") return { score: 0, detail: [] };
  const existingSupport = allyIds.map(getHero).filter(Boolean).filter((h) => h.role === "support");
  if (existingSupport.length !== 1) return { score: 0, detail: [] };

  const otherSupport = existingSupport[0];
  if (!hero.supportRole || !otherSupport.supportRole) return { score: 0, detail: [] };

  const detail = [];
  let score = 0;
  if (hero.supportRole === "main" && otherSupport.supportRole === "main") {
    const zenyattaInvolved = hero.id === "zenyatta" || otherSupport.id === "zenyatta";
    if (!zenyattaInvolved) {
      score -= SUPPORT_MAIN_PENALTY;
      detail.push({
        ally: otherSupport.name,
        note: `Dos main support (${hero.name} + ${otherSupport.name}): conviene un flex support para dar flexibilidad`,
      });
    }
  }
  return { score: round1(score), detail };
}

/**
 * Revisa el equipo ya elegido en busca de problemas de composición que no
 * dependen del rival: doble main support, y doble dps del mismo dpsRole
 * (fuera de la excepción de mapas long). Se calcula sobre el `team` final,
 * a diferencia de dpsBalanceScore/supportBalanceScore que solo se activan
 * mientras se está eligiendo exactamente el 2do dps/soporte.
 */
function detectCompositionWarnings(allyIds, map, preferences) {
  const allies = allyIds.map(getHero).filter(Boolean);
  const warnings = [];

  const supportPair = allies.filter((h) => h.role === "support");
  if (supportPair.length === 2 && supportPair.every((h) => h.supportRole === "main")) {
    const [a, b] = supportPair;
    if (a.id !== "zenyatta" && b.id !== "zenyatta") {
      const flexCandidates = heroes
        .filter((h) => h.role === "support" && h.supportRole === "flex" && !allyIds.includes(h.id) && matchesPreference(h, preferences))
        .map((h) => ({ id: h.id, name: h.name }))
        .slice(0, 4);
      warnings.push({
        type: "double_main_support",
        message: `${a.name} y ${b.name} son los dos main support: falta flexibilidad. Conviene cambiar uno por un flex support.`,
        heroes: [a.id, b.id],
        suggestions: flexCandidates,
      });
    }
  }

  const dpsPair = allies.filter((h) => h.role === "dps");
  if (dpsPair.length === 2 && dpsPair[0].dpsRole && dpsPair[0].dpsRole === dpsPair[1].dpsRole) {
    const [a, b] = dpsPair;
    const bothHitscan = a.dpsRole === "hitscan";
    const longMapException = bothHitscan && !!map?.tags?.includes("long");
    if (!longMapException) {
      const otherRole = bothHitscan ? "flex" : "hitscan";
      const swapCandidates = heroes
        .filter((h) => h.role === "dps" && h.dpsRole === otherRole && !allyIds.includes(h.id) && matchesPreference(h, preferences))
        .map((h) => ({ id: h.id, name: h.name }))
        .slice(0, 4);
      warnings.push({
        type: "double_dps_role",
        message: `${a.name} y ${b.name} son los dos dps ${bothHitscan ? "hitscan" : "flex"}: conviene mezclar con un dps ${otherRole}.`,
        heroes: [a.id, b.id],
        suggestions: swapCandidates,
      });
    }
  }

  return warnings;
}

/**
 * Analiza el equipo aliado ya elegido contra el equipo enemigo y devuelve,
 * por cada héroe aliado, su estado de matchup (fuerte / normal / en riesgo)
 * y sugerencias de cambio dentro del mismo rol cuando el matchup es malo.
 * También devuelve `compositionWarnings` con problemas de composición del
 * equipo que no dependen del rival (doble main support, doble dps del mismo tipo).
 */
function teamCheck({ mapId, allyIds = [], enemyIds = [], preferences = {}, mode = DEFAULT_MODE }) {
  const map = getMap(mapId);

  const RISK_THRESHOLD = -3.5;
  const STRONG_THRESHOLD = 3.5;

  const team = allyIds
    .map((allyId) => getHero(allyId))
    .filter(Boolean)
    .map((hero) => {
      const otherAllies = allyIds.filter((id) => id !== hero.id);
      const cScore = counterScore(hero, enemyIds, mode);

      let status = "ok";
      if (cScore.score <= RISK_THRESHOLD) status = "risk";
      else if (cScore.score >= STRONG_THRESHOLD) status = "strong";

      let suggestions = [];
      if (status === "risk") {
        const sameRoleCandidates = heroes.filter(
          (h) => h.role === hero.role && !allyIds.includes(h.id) && matchesPreference(h, preferences)
        );

        suggestions = sameRoleCandidates
          .map((candidate) => {
            const candidateCounter = counterScore(candidate, enemyIds, mode);
            const candidateSynergy = synergyScore(candidate, otherAllies);
            const candidateArchetypeSynergy = tankArchetypeSynergyScore(candidate, otherAllies);
            const candidateComposition =
              candidate.role === "dps"
                ? dpsBalanceScore(candidate, otherAllies, map)
                : candidate.role === "support"
                ? supportBalanceScore(candidate, otherAllies)
                : { score: 0, detail: [] };
            const candidateMap = mapScore(candidate, map);
            const candidateRange = rangeScore(candidate, map);
            const candidateMeta = metaScore(candidate);
            const candidateMobility = mobilityScore(candidate, enemyIds);
            const total = round1(
              candidateCounter.score +
                candidateSynergy.score +
                candidateArchetypeSynergy.score +
                candidateComposition.score +
                candidateMap +
                candidateRange +
                candidateMeta +
                candidateMobility.score
            );
            return {
              hero: { id: candidate.id, name: candidate.name, role: candidate.role },
              total,
              matchupScore: candidateCounter.score,
              improvement: round1(candidateCounter.score - cScore.score),
            };
          })
          // solo candidatos que realmente mejoran el matchup actual
          .filter((c) => c.improvement > 0)
          .sort((a, b) => b.total - a.total)
          .slice(0, 2);
      }

      return {
        hero: { id: hero.id, name: hero.name, role: hero.role },
        matchupScore: cScore.score,
        matchupDetail: cScore.detail,
        status,
        suggestions,
      };
    });

  return {
    map: map ? { id: map.id, name: map.name, type: map.type, tags: map.tags, range: map.range } : null,
    mode,
    team,
    compositionWarnings: detectCompositionWarnings(allyIds, map, preferences),
  };
}

/**
 * Composición ideal por roles según el modo:
 * - 5v5: 1 tanque, 2 daño, 2 soporte.
 * - 6v6: 2 tanques, 2 daño, 2 soporte (formación clásica).
 */
const ROLE_LIMITS_BY_MODE = {
  "5v5": { tank: 1, dps: 2, support: 2 },
  "6v6": { tank: 2, dps: 2, support: 2 },
};

function rosterSize(mode = DEFAULT_MODE) {
  const limits = ROLE_LIMITS_BY_MODE[mode] || ROLE_LIMITS_BY_MODE[DEFAULT_MODE];
  return Object.values(limits).reduce((a, b) => a + b, 0);
}

function roleNeed(allyIds, mode = DEFAULT_MODE) {
  const limits = ROLE_LIMITS_BY_MODE[mode] || ROLE_LIMITS_BY_MODE[DEFAULT_MODE];
  const counts = { tank: 0, dps: 0, support: 0 };
  for (const id of allyIds) {
    const h = getHero(id);
    if (h) counts[h.role] += 1;
  }
  const need = {};
  for (const role of Object.keys(limits)) {
    need[role] = Math.max(0, limits[role] - counts[role]);
  }
  return { counts, need };
}

/**
 * Recomienda los mejores héroes dado un mapa, aliados ya elegidos y enemigos.
 * Cuando ya se llenaron todos los roles salvo uno (4/5 en 5v5, 5/6 en 6v6),
 * prioriza fuertemente el rol faltante (último héroe del draft).
 */
function recommend({ mapId, allyIds = [], enemyIds = [], excludeIds = [], preferences = {}, mode = DEFAULT_MODE }) {
  const map = getMap(mapId);
  const { need } = roleNeed(allyIds, mode);
  const excluded = new Set([...allyIds, ...excludeIds]);

  const restrictToMissingRole = allyIds.length === rosterSize(mode) - 1;
  let missingRole = null;
  if (restrictToMissingRole) {
    missingRole = Object.entries(need).find(([, n]) => n > 0)?.[0] || null;
  }

  const candidates = heroes.filter((h) => {
    if (excluded.has(h.id)) return false;
    if (restrictToMissingRole && missingRole) {
      if (h.role !== missingRole) return false;
    }
    if (!matchesPreference(h, preferences)) return false;
    return true;
  });

  const results = candidates.map((hero) => {
    const mScore = mapScore(hero, map);
    const rScore = rangeScore(hero, map);
    const cScore = counterScore(hero, enemyIds, mode);
    const sScore = synergyScore(hero, allyIds);
    const archScore = tankArchetypeSynergyScore(hero, allyIds);
    const compScore =
      hero.role === "dps"
        ? dpsBalanceScore(hero, allyIds, map)
        : hero.role === "support"
        ? supportBalanceScore(hero, allyIds)
        : { score: 0, detail: [] };
    const metaAdj = metaScore(hero);
    const mobScore = mobilityScore(hero, enemyIds);
    const total =
      mScore + rScore + cScore.score + sScore.score + archScore.score + compScore.score + metaAdj + mobScore.score;
    return {
      hero: { id: hero.id, name: hero.name, role: hero.role, archetype: hero.archetype, playstyle: hero.playstyle },
      total: Math.round(total * 10) / 10,
      breakdown: {
        mapScore: mScore,
        rangeScore: rScore,
        counterScore: cScore.score,
        synergyScore: sScore.score,
        archetypeSynergyScore: archScore.score,
        compositionScore: compScore.score,
        metaScore: metaAdj,
        mobilityScore: mobScore.score,
      },
      counterDetail: cScore.detail,
      synergyDetail: sScore.detail,
      archetypeSynergyDetail: archScore.detail,
      compositionDetail: compScore.detail,
      mobilityDetail: mobScore.detail,
    };
  });

  results.sort((a, b) => b.total - a.total);

  return {
    map: map ? { id: map.id, name: map.name, type: map.type, tags: map.tags, range: map.range } : null,
    mode,
    missingRole,
    roleCounts: roleNeed(allyIds, mode).counts,
    recommendations: results,
  };
}

module.exports = {
  recommend,
  teamCheck,
  getHero,
  getMap,
  heroes,
  maps,
  PLAYSTYLES_BY_ROLE,
  ROLE_LIMITS_BY_MODE,
  rosterSize,
};
