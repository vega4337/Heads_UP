// src/components/Home.jsx
import React from "react";

export default function Home({
  categories,
  roundSeconds,
  setRoundSeconds,
  onStart,
}) {
  const entries = categories
    ? Array.isArray(categories)
      ? categories
      : Object.entries(categories).map(([key, val]) => ({
          key,
          ...val,
        }))
    : [];

  return (
    <div className="shell">
      <div className="card">
        <h1 className="h1">Heads Up Clone</h1>
        <p className="p">
          Setup in portrait. Gameplay is best in landscape.
        </p>

        <div className="smallRow">
          <span className="pill">Round time</span>

          <label className="selectWrap" aria-label="Round time">
            <select
              className="select"
              value={roundSeconds}
              onChange={(e) => setRoundSeconds(Number(e.target.value))}
            >
              <option value={30}>30 seconds</option>
              <option value={60}>60 seconds</option>
            </select>
          </label>
        </div>

        <div className="grid" style={{ marginTop: 12 }}>
          {entries.map((c) => {
            const count = Array.isArray(c.prompts)
              ? c.prompts.length
              : Array.isArray(c.words)
                ? c.words.length
                : 0;

            return (
              <button
                key={c.key}
                className="catBtn"
                onClick={() => onStart(c.key)}
              >
                <p className="catTitle">{c.name || c.key}</p>
                <p className="catMeta">{count} prompts</p>
              </button>
            );
          })}
        </div>

        <p className="hint" style={{ marginTop: 12 }}>
          Tip: On iPhone, turn OFF orientation lock for landscape play.
        </p>
      </div>
    </div>
  );
}
