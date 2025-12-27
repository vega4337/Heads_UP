import React, { useMemo } from "react";
import ScreenShell from "./ScreenShell.jsx";

export default function Home({ categories, roundSeconds, setRoundSeconds, onStart }) {
  const list = useMemo(() => Object.entries(categories), [categories]);

  return (
    <ScreenShell
      title="Heads Up Clone"
      subtitle="Choose a category, set the timer, then hold the phone to your forehead. Tilt DOWN = Correct, tilt UP = Pass. Buttons also work."
    >
      <div className="smallRow">
        <span className="pill">Round time</span>
        <input
          aria-label="Round seconds"
          type="number"
          min="15"
          max="180"
          step="5"
          value={roundSeconds}
          onChange={(e) => setRoundSeconds(Number(e.target.value || 60))}
          style={{
            width: 110,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.05)",
            color: "var(--text)"
          }}
        />
        <span className="pill">seconds</span>
      </div>

      <div style={{ height: 12 }} />

      <div className="grid">
        {list.map(([key, cat]) => (
          <button key={key} className="catBtn" onClick={() => onStart(key)}>
            <div className="catTitle">{cat.name}</div>
            <p className="catMeta">{cat.words.length} prompts</p>
          </button>
        ))}
      </div>

      <div style={{ height: 14 }} />
      <p className="p" style={{ marginBottom: 0 }}>
        iPhone tip: after opening in Safari, use Share → “Add to Home Screen” for fullscreen play.
      </p>
    </ScreenShell>
  );
}
