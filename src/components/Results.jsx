// src/components/Results.jsx
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

  const correct = results.correct ?? results.correctCount ?? 0;
  const passed = results.passed ?? results.passCount ?? 0;
  const total = results.total ?? (correct + passed);

  // Support either structure:
  // 1) results.events = [{word, result: 'correct'|'pass'}]
  // 2) results.correctWords / results.passedWords arrays
  const correctWords =
    results.correctWords ??
    (results.events ? results.events.filter(e => e.result === "correct").map(e => e.word) : []);

  const passedWords =
    results.passedWords ??
    (results.events ? results.events.filter(e => e.result === "pass").map(e => e.word) : []);

  return (
    <ScreenShell
      title="Results"
      subtitle={`${results.categoryName ?? "Round"} • ${results.roundSeconds ?? ""}${results.roundSeconds ? "s" : ""}`}
    >
      <div className="kpiRow">
        <div className="kpi">
          <p className="kpiLabel">Total</p>
          <p className="kpiValue">{total}</p>
        </div>
        <div className="kpi">
          <p className="kpiLabel">Correct</p>
          <p className="kpiValue" style={{ color: "var(--good)" }}>{correct}</p>
        </div>
        <div className="kpi">
          <p className="kpiLabel">Pass</p>
          <p className="kpiValue" style={{ color: "var(--bad)" }}>{passed}</p>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div className="bigPromptWrap">
        <p className="p" style={{ margin: 0 }}>
          Correct words: {correctWords.length} • Passed words: {passedWords.length}
        </p>
      </div>

      <ul className="list">
        {results.events?.length
          ? results.events.map((e, i) => (
              <li key={i} className="item">
                <span style={{ fontWeight: 700 }}>{e.word}</span>
                <span className={`badge ${e.result === "correct" ? "good" : "bad"}`}>
                  {e.result.toUpperCase()}
                </span>
              </li>
            ))
          : [
              ...correctWords.map((w) => ({ word: w, result: "correct" })),
              ...passedWords.map((w) => ({ word: w, result: "pass" }))
            ].map((e, i) => (
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
