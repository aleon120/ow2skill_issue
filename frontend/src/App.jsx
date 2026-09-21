import React, { useState } from "react";
import NavBar from "./components/NavBar.jsx";
import CalculatorPage from "./pages/CalculatorPage.jsx";
import SixVSixPage from "./pages/SixVSixPage.jsx";
import StadiumPage from "./pages/StadiumPage.jsx";
import PersonajesPage from "./pages/PersonajesPage.jsx";
import ComposicionesPage from "./pages/ComposicionesPage.jsx";
import TierlistPage from "./pages/TierlistPage.jsx";

export default function App() {
  const [activeTab, setActiveTab] = useState("calculo");

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-mark">OW2</div>
        <div>
          <h1>Draft Advisor</h1>
          <p>Recomendación de héroes por mapa, counters, sinergias y estilo de juego</p>
        </div>
      </header>

      <NavBar active={activeTab} onChange={setActiveTab} />

      {activeTab === "calculo" && <CalculatorPage />}
      {activeTab === "6v6" && <SixVSixPage />}
      {activeTab === "stadium" && <StadiumPage />}
      {activeTab === "personajes" && <PersonajesPage />}
      {activeTab === "composiciones" && <ComposicionesPage />}
      {activeTab === "tierlist" && <TierlistPage />}

      {/* TODO: reemplazá el href de acá abajo por tu link real de donaciones
          (Buy Me a Coffee, Ko-fi, PayPal.me, etc.) */}
      <a
        href="https://www.patreon.com/LeonHero1"
        target="_blank"
        rel="noopener noreferrer"
        className="donate-badge"
      >
        ☕ ¿Quieres comprarme un café?
      </a>
    </div>
  );
}