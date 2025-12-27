import React, { useEffect, useMemo, useRef, useState } from "react";
import ScreenShell from "./ScreenShell.jsx";
import { shuffle } from "../utils/shuffle.js";
import { createTiltDetector, requestMotionPermissionIfNeeded } from "../utils/motion.js";

function vibrate(pattern = 50) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // ignore
  }
}

export default function Game({ categoryKey, categories, roundSeconds, onFinish, onQuit }) {
  const category = categories[categoryKey];

  const deck = useMemo(() => shuffle(category.words), [category.words]);
  const [idx, setIdx] = useState(0);

  const [timeLeft, setTimeLeft] = useState(roundSeconds);
  const [status, setStatus] = useState("ready"); // ready | playing | ended
  const [motionAllowed, setMotionAllowed] = useState(null); // null | true | false

  const [events, setEvents] = useState([]); // {word, result: 'correct'|'pass'}

  const tiltRef = useRef(null);
  const timerRef = useRef(null);

  const word = deck[idx] ?? "Out of cards";

  const nextCard = () => setIdx((v) => Math.min(v + 1, deck.length));

  const mark = (result) => {
    if (status !== "playing") return;
    if (!deck[idx]) return;

    setEvents((prev) => [...prev, { word: deck[idx], result }]);
    vibrate(result === "correct" ? [30, 40, 30] : 60);
    nextCard();
  };

  const endRound = () => {
    setStatus("ended");
    try { tiltRef.current?.stop(); } catch {}
    clearInterval(timerRef.current);

    const correct = events.filter((e) => e.result === "correct").length;
    const passed = events.filter((e) => e.result === "pass").length;

    onFinish({
      categoryKey,
      categoryName: category.name,
      roundSeconds,
      correct,
      passed,
      total: events.length,
      events
    });
  };

  const startRound = async () => {
    const ok = await requestMotionPermissionIfNeeded();
    setMotionAllowed(ok);

    setEvents([]);
    setIdx(0);
    setTimeLeft(roundSeconds);
    setStatus("playing");

    // Tilt detector
    const detector = createTiltDetector({
      onDown: () => mark("correct"),
      onUp: () => mark("pass"),
      thresholdDeg: 35,
      cooldownMs: 900
    });
    tiltRef.current = detector;
    detector.start();

    // Timer
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          // end after state updates settle
          setTimeout(endRound, 0);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      try { tiltRef.current?.stop(); } catch {}
      clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const correctCount = events.filter((e) => e.result === "correct").length;
  const passCount = events.filter((e) => e.result === "pass").length;

  return (
    <ScreenShell
      title={category.name}
      subtitle={
        status === "ready"
          ? "Tap Start, then hold the phone to your forehead. Tilt DOWN = Correct, tilt UP = Pass."
          : status === "playing"
          ? "Keep it moving—tilt for answers."
          : "Round ended."
      }
    >
      <div className="kpiRow">
        <div className="kpi">
          <p className="kpiLabel">Time left</p>
          <p className="kpiValue">{timeLeft}s</p>
        </div>
        <div className="kpi">
          <p className="kpiLabel">Correct</p>
          <p className="kpiValue" style={{ color: "var(--good)" }}>{correctCount}</p>
        </div>
        <div className="kpi">
          <p className="kpiLabel">Pass</p>
          <p className="kpiValue" style={{ color: "var(--bad)" }}>{passCount}</p>
        </div>
      </div>

      <div className="bigPromptWrap" style={{ marginTop: 14 }}>
        <p className="bigPrompt">{word}</p>
        <div className="hint">
          {status === "ready" ? "Start to begin" : "Tilt down = Correct • Tilt up = Pass"}
        </div>
        {motionAllowed === false ? (
          <div className="hint" style={{ color: "var(--warn)", marginTop: 8 }}>
            Motion permission denied. Use the buttons below.
          </div>
        ) : null}
      </div>

      <div className="smallRow" style={{ marginTop: 14 }}>
        {status !== "playing" ? (
          <button className="btn primary" onClick={startRound}>
            Start
          </button>
        ) : (
          <>
            <button className="btn good" onClick={() => mark("correct")}>
              Correct
            </button>
            <button className="btn danger" onClick={() => mark("pass")}>
              Pass
            </button>
            <button className="btn" onClick={endRound}>
              End
            </button>
          </>
        )}

        <button className="btn" onClick={onQuit}>
          Quit
        </button>
      </div>

      <div style={{ height: 10 }} />
      <p className="p" style={{ marginBottom: 0 }}>
        Note: tilt thresholds vary by how you hold the phone. If it triggers too easily or not enough,
        adjust <code>thresholdDeg</code> in <code>src/utils/motion.js</code>.
      </p>
    </ScreenShell>
  );
}
