import React from "react";
import ScreenShell from "./ScreenShell.jsx";

export default function Results({ results, onHome }) {
  if (!results) {
    return (
      <ScreenShell title="Results" subtitle="No results.">
        <button className="btn primary" onClick={onHome}>Home</button>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Results"
      subtitle={`${results.categoryName} • ${results.roundSeconds}s`}
    >
      <div className="kpiRow">
        <div className="kpi">
          <p className="kpiLabel">Total</p>
          <p className="kpiValue">{results.total}</p>
        </div>
        <div className="kpi">
          <p className="kpiLabel">Correct</p>
          <p className="kpiValue" style={{ color: "var(--good)" }}>{results.correct}</p>
        </div>
        <div className="kpi">
          <p className="kpiLabel">Pass</p>
          <p className="kpiValue" style={{ color: "var(--bad)" }}>{results.passed}</p>
        </div>
      </div>

      <ul className="list">
        {results.events.map((e, i) => (
          <li key={i} className="item">
            <span style={{ fontWeight: 700 }}>{e.word}</span>
            <span className={`badge ${e.result === "correct" ? "good" : "bad"}`}>
              {e.result.toUpperCase()}
            </span>
          </li>
        ))}
      </ul>

      <div className="smallRow" style={{ marginTop: 14 }}>
        <button className="btn primary" onClick={onHome}>Home</button>
      </div>
    </ScreenShell>
  );
}
