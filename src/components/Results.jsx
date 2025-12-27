// src/components/Results.jsx
import React, { useMemo } from "react";

export default function Results({ results, onHome }) {
  const computed = useMemo(() => {
    if (!results) return null;

    const history = Array.isArray(results.history) ? results.history : [];

    const correctWords = results.correctWords ?? history.filter((h) => h.outcome === "correct").map((h) => h.word);
    const passedWords = results.passedWords ?? history.filter((h) => h.outcome === "pass").map((h) => h.word);

    return {
      categoryName: results.categoryName ?? "Results",
      roundSeconds: results.roundSeconds ?? 0,
      total: results.total ?? history.length,
      correctCount: results.correctCount ?? correctWords.length,
      passCount: results.passCount ?? passedWords.length,
      correctWords,
      passedWords,
      history,
    };
  }, [results]);

  if (!computed) {
    return (
      <div className="shell">
        <div className="card">
          <div className="h1">Results</div>
          <p className="p">No results found.</p>
          <button className="btn primary" onClick={onHome}>Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="card">
        <div className="h1">Results</div>
        <p className="p">
          {computed.categoryName} • {computed.roundSeconds}s
        </p>

        <div className="kpiRow">
          <div className="kpi">
            <p className="kpiLabel">Total</p>
            <p className="kpiValue">{computed.total}</p>
          </div>
          <div className="kpi">
            <p className="kpiLabel">Correct</p>
            <p className="kpiValue" style={{ color: "var(--good)" }}>{computed.correctCount}</p>
          </div>
          <div className="kpi">
            <p className="kpiLabel">Pass</p>
            <p className="kpiValue" style={{ color: "var(--bad)" }}>{computed.passCount}</p>
          </div>
        </div>

        <div className="bigPromptWrap" style={{ marginTop: 14 }}>
          <div className="p" style={{ margin: 0 }}>
            Correct words: {computed.correctCount} • Passed words: {computed.passCount}
          </div>
        </div>

        <ul className="list">
          {computed.history.map((h, i) => (
            <li className="item" key={`${h.word}-${i}`}>
              <div style={{ fontWeight: 700 }}>{h.word}</div>
              <span className={`badge ${h.outcome === "correct" ? "good" : "bad"}`}>
                {h.outcome === "correct" ? "CORRECT" : "PASS"}
              </span>
            </li>
          ))}
        </ul>

        <div className="smallRow" style={{ marginTop: 16 }}>
          <button className="btn primary" onClick={onHome}>Back to Home</button>
        </div>
      </div>
    </div>
  );
}
