import React, { useEffect, useState, useCallback } from "react";
import MapSelector from "../components/MapSelector.jsx";
import TeamPicker from "../components/TeamPicker.jsx";
import ResultsPanel from "../components/ResultsPanel.jsx";
import TeamCheckPanel from "../components/TeamCheckPanel.jsx";
import PreferencesPanel from "../components/PreferencesPanel.jsx";
import {
  fetchHeroes,
  fetchMaps,
  fetchPlaystyles,
  fetchModes,
  fetchRecommendation,
  fetchTeamCheck,
} from "../api/client.js";

const ROLE_LABEL = { tank: "tanque", dps: "daño", support: "soporte" };

/**
 * Página de draft genérica: contiene toda la lógica que antes vivía en
 * CalculatorPage.jsx, pero parametrizada por `mode` ("5v5" | "6v6") en vez
 * de asumir siempre la formación 1-2-2. Los límites de roles y el tamaño de
 * plantel se piden a /api/modes (misma fuente de verdad que usa el backend
 * para el motor de recomendación), así que no hay valores duplicados a mano
 * acá que puedan desalinearse.
 *
 * CalculatorPage.jsx y SixVSixPage.jsx son wrappers finos de este componente.
 */
export default function DraftPage({ mode }) {
  const [heroes, setHeroes] = useState([]);
  const [maps, setMaps] = useState([]);
  const [playstylesByRole, setPlaystylesByRole] = useState(null);
  const [modes, setModes] = useState(null);
  const [mapId, setMapId] = useState(null);
  const [allyIds, setAllyIds] = useState([]);
  const [enemyIds, setEnemyIds] = useState([]);
  const [preferences, setPreferences] = useState({ tank: [], dps: [], support: [] });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [teamCheck, setTeamCheck] = useState(null);
  const [teamCheckLoading, setTeamCheckLoading] = useState(false);
  const [teamCheckError, setTeamCheckError] = useState(null);

  useEffect(() => {
    Promise.all([fetchHeroes(), fetchMaps(), fetchPlaystyles(), fetchModes()])
      .then(([h, m, p, mo]) => {
        setHeroes(h);
        setMaps(m);
        setPlaystylesByRole(p);
        setModes(mo);
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  // Al cambiar de pestaña (5v5 <-> 6v6) el draft en curso ya no es válido
  // (distinta cantidad de tanques permitidos), así que se reinicia.
  useEffect(() => {
    setAllyIds([]);
    setEnemyIds([]);
    setResult(null);
    setTeamCheck(null);
  }, [mode]);

  const modeInfo = modes?.[mode];
  const maxSize = modeInfo?.rosterSize ?? (mode === "6v6" ? 6 : 5);
  const roleLimits = modeInfo?.roleLimits;

  const toggleAlly = (id) => {
    setAllyIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < maxSize ? [...prev, id] : prev));
  };
  const toggleEnemy = (id) => {
    setEnemyIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < maxSize ? [...prev, id] : prev));
  };
  const togglePreference = (role, style) => {
    setPreferences((prev) => {
      const current = prev[role] || [];
      const next = current.includes(style) ? current.filter((s) => s !== style) : [...current, style];
      return { ...prev, [role]: next };
    });
  };

  const runRecommendation = useCallback(() => {
    if (!mapId) return;
    setLoading(true);
    setError(null);
    fetchRecommendation({ mapId, allyIds, enemyIds, preferences, mode })
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [mapId, allyIds, enemyIds, preferences, mode]);

  useEffect(() => {
    runRecommendation();
  }, [runRecommendation]);

  useEffect(() => {
    if (allyIds.length === 0) {
      setTeamCheck(null);
      return;
    }
    setTeamCheckLoading(true);
    setTeamCheckError(null);
    fetchTeamCheck({ mapId, allyIds, enemyIds, preferences, mode })
      .then(setTeamCheck)
      .catch((e) => setTeamCheckError(e.message))
      .finally(() => setTeamCheckLoading(false));
  }, [mapId, allyIds, enemyIds, preferences, mode]);

  if (loadError) {
    return <p className="empty-state">No se pudo conectar con el backend: {loadError}</p>;
  }

  const isLastPick = allyIds.length === maxSize - 1;

  return (
    <>
      {roleLimits && (
        <p className="hint mode-hint">
          Formación {mode}: <strong>{roleLimits.tank}</strong> {ROLE_LABEL.tank}
          {roleLimits.tank > 1 ? "s" : ""} · <strong>{roleLimits.dps}</strong> {ROLE_LABEL.dps} ·{" "}
          <strong>{roleLimits.support}</strong> {ROLE_LABEL.support}.
        </p>
      )}

      <section className="preferences-section">
        <PreferencesPanel playstylesByRole={playstylesByRole} preferences={preferences} onToggle={togglePreference} />
      </section>

      <section className="map-section">
        <MapSelector maps={maps} selectedMapId={mapId} onSelect={setMapId} />
      </section>

      <section className="teams-row">
        <TeamPicker
          title="Tu equipo"
          eyebrow="02A · Aliados"
          heroes={heroes}
          selectedIds={allyIds}
          onToggle={toggleAlly}
          maxSize={maxSize}
        />
        <TeamPicker
          title="Equipo enemigo"
          eyebrow="02B · Rivales"
          heroes={heroes}
          selectedIds={enemyIds}
          onToggle={toggleEnemy}
          maxSize={maxSize}
        />
      </section>

      <section className="analysis-section">
        <ResultsPanel data={result} loading={loading} error={error} isLastPick={isLastPick} />
        <TeamCheckPanel data={teamCheck} loading={teamCheckLoading} error={teamCheckError} mode={mode} />
      </section>
    </>
  );
}
