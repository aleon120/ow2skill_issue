import React from "react";

const TABS = [
  { id: "calculo", label: "5vs5" },
  { id: "6v6", label: "6vs6" },
  { id: "stadium", label: "Stadium" },
  { id: "personajes", label: "Personajes" },
  { id: "composiciones", label: "Composiciones" },
];

export default function NavBar({ active, onChange }) {
  return (
    <nav className="nav-bar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`nav-tab ${active === tab.id ? "nav-tab-active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}