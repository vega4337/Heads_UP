// src/components/Game.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { requestMotionPermission, startTiltListener } from "../utils/motion.js";
import { shuffleArray } from "../utils/shuffle.js";

function resolveCategory(categories, categoryKey) {
  if (!categories || !categoryKey) return null;

  // If categories is an object keyed by categoryKey
  if (typeof categories === "object" && !Array.isArray(categories)) {
    return categories[categoryKey] || null;
  }

  // If categories is an array of objects
  if (Array.isArray(categories)) {
    return categories.find((c) => c.key === categoryKey) || null;
  }

  return null;
}

export default function Game({
  categoryKey,
  categories,
  roundSeconds,
  onFinish,
  onQuit,
}) {
  const category = useMemo(
    () => resolveCategory(categories, categoryKey),
    [categories, categoryKey]
  );

  const prompts = useMemo(() => {
    const list =
      category?.prompts ||
      category?.words || // tolerate alternate naming
      [];
    return Array.isArray(list) ? list : [];
  }, [category]);

  // Stage control
  // "ready" -> waiting to enable tilt
  // "playing" -> timer running, tilt active
  // "done" -> finished (we call onFinish)
  const [stage, setStage] = useState("ready");

  // Tilt
  const [tiltEnabled, setTiltEnabled] = useState(false);
  const [tiltStatus, setTiltStatus] = useState("Tilt not enabled.");
  const [invertTilt, setInvertTilt] = useState(false);

  // Timer
  const [secondsLeft, setSecondsLeft] = useState(roundSeconds);

  // Deck + display
  const [deck, setDeck] = useState([]);
  const [index, setIndex] = useState(0);

  // Stats
  const [correctCount, setCorrectCount] = useState(0);
  const [passCount, setPassCount] = useState(0);
  const [items, setItems] = useState([]); // { word, outcome: "correct"|"pass" }

  // Refs for sensor callbacks (avoid stale closures)
  const deckRef = useRef([]);
  const indexRef = useRef(0);
  const correctRef = useRef(0);
  const passRef = useRef(0);
  const itemsRef = useRef([]);
  const stageRef = useRef(stage);

  const tiltControllerRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  // Initialize deck when category changes
  useEffect(() => {
    const shuffled = shuffleArray(prompts);
    setDeck(shuffled);
    setIndex(0);

    setCorrectCount(0);
    setPassCount(0);
    setItems([]);

    setSecondsLeft(roundSeconds);

    setTiltEnabled(false);
    setTiltStatus("Tilt not enabled.");
    setStage("ready");

    deckRef.current = shuffled;
    indexRef.current = 0;
    correctRef.current = 0;
    passRef.current = 0;
    itemsRef.current = [];

    // cleanup listeners/timer when switching categories
    stopTilt();
    stopTimer();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryKey]);

  // Keep refs in sync
  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    correctRef.current = correctCount;
  }, [correctCount]);

  useEffect(() => {
    passRef.current = passCount;
  }, [passCount]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function stopTilt() {
    if (tiltControllerRef.current) {
      tiltControllerRef.current.stop?.();
      tiltControllerRef.current = null;
    }
  }

  function finishRound() {
    stopTilt();
    stopTimer();
    setStage("done");

    const finalItems = itemsRef.current;
    const finalCorrect = correctRef.current;
    const finalPass = passRef.current;

    const result = {
      categoryKey,
      categoryName: category?.name || "Category",
      roundSeconds,
      total: finalItems.length,
      correctCount: finalCorrect,
      passCount: finalPass,
      correctWords: finalItems.filter((x) => x.outcome === "correct").map((x) => x.word),
      passedWords: finalItems.filter((x) => x.outcome === "pass").map((x) => x.word),
      items: finalItems,
    };

    onFinish?.(result);
  }

  function startTimer() {
    stopTimer();
    setSecondsLeft(roundSeconds);

    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          // time up
          setTimeout(() => finishRound(), 0);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function advanceWithOutcome(outcome) {
    if (stageRef.current !== "playing") return;

    const d = deckRef.current;
    const i = indexRef.current;

    if (!d || !d.length) return;
    if (i < 0 || i >= d.length) return;

    const word = d[i];

    // record
    const nextItem = { word, outcome };
    const nextItems = [...itemsRef.current, nextItem];
    itemsRef.current = nextItems;
    setItems(nextItems);

    if (outcome === "correct") {
      const c = correctRef.current + 1;
      correctRef.current = c;
      setCorrectCount(c);
    } else {
      const p = passRef.current + 1;
      passRef.current = p;
      setPassCount(p);
    }

    // advance index exactly once
    const nextIndex = i + 1;
    indexRef.current = nextIndex;
    setIndex(nextIndex);

    // if ran out of words, finish early
    if (nextIndex >= d.length) {
      finishRound();
    }
  }

  async function enableTiltAndStart() {
    if (!deckRef.current.length) return;

    setTiltStatus("Requesting motion permission…");
    const ok = await requestMotionPermission();
    if (!ok) {
      setTiltStatus("Motion permission denied. Enable it in Safari settings and reload.");
      return;
    }

    stopTilt(); // in case user taps twice
    setTiltStatus("Calibrating… hold steady for a moment.");

    // Start listener; it calibrates baseline on first good sensor sample
    tiltControllerRef.current = startTiltListener({
      invert: invertTilt,
      thresholdDeg: 28,
      neutralDeg: 12,
      cooldownMs: 700,
      smoothing: 0.35,
      onReady: () => {
        setTiltEnabled(true);
        setTiltStatus("Tilt enabled. Tilt DOWN = Correct. Tilt UP = Pass.");
        setStage("playing");
        startTimer();
      },
      onAction: (dir) => {
        // dir: "down" or "up"
        // Map to outcomes
        if (dir === "down") advanceWithOutcome("correct");
        if (dir === "up") advanceWithOutcome("pass");
      },
    });
  }

  // If invertTilt changes while playing, restart tilt listener to apply it
  useEffect(() => {
    if (stage !== "playing") return;
    // restart tilt listener with new invert
    stopTilt();
    tiltControllerRef.current = startTiltListener({
      invert: invertTilt,
      thresholdDeg: 28,
      neutralDeg: 12,
      cooldownMs: 700,
      smoothing: 0.35,
      onReady: () => {
        setTiltEnabled(true);
        setTiltStatus("Tilt enabled. Tilt DOWN = Correct. Tilt UP = Pass.");
      },
      onAction: (dir) => {
        if (dir === "down") advanceWithOutcome("correct");
        if (dir === "up") advanceWithOutcome("pass");
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invertTilt]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTilt();
      stopTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!category) {
    return (
      <div className="shell">
        <div className="card">
          <h1 className="h1">Game</h1>
          <p className="p">No category selected.</p>
          <button className="btn" onClick={onQuit}>Back</button>
        </div>
      </div>
    );
  }

  if (!prompts.length) {
    return (
      <div className="shell">
        <div className="card">
          <h1 className="h1">{category?.name || "Category"}</h1>
          <p className="p">No prompts found in this category.</p>
          <button className="btn" onClick={onQuit}>Back</button>
        </div>
      </div>
    );
  }

  const currentWord = deck[index] ?? "";

  return (
    <div className="shell">
      <div className="card">
        <div className="row">
          <div>
            <h1 className="h1">{category?.name || "Category"}</h1>
            <p className="p">
              {stage === "ready"
                ? "Timer starts only after you tap Enable Tilt. Turn OFF iPhone orientation lock for landscape testing."
                : "Hold to forehead. Tilt DOWN = Correct. Tilt UP = Pass."}
            </p>
          </div>

          <div className="pill">
            {stage === "playing" ? `${secondsLeft}s` : `${roundSeconds}s`}
          </div>
        </div>

        {stage === "ready" && (
          <>
            <div className="smallRow" style={{ marginTop: 8 }}>
              <label className="pill" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={invertTilt}
                  onChange={(e) => setInvertTilt(e.target.checked)}
                  style={{ transform: "scale(1.2)" }}
                />
                Invert tilt
              </label>
            </div>

            <div className="smallRow">
              <button className="btn primary" onClick={enableTiltAndStart}>
                Enable Tilt
              </button>
              <button className="btn" onClick={onQuit}>
                Back
              </button>
            </div>

            <div className="pill danger" style={{ marginTop: 10 }}>
              {tiltStatus}
            </div>

            <div className="pill" style={{ marginTop: 10 }}>
              Prompts available: {prompts.length}
            </div>
          </>
        )}

        {stage === "playing" && (
          <>
            <div className="pill" style={{ marginTop: 10 }}>
              {tiltStatus}
            </div>

            <div className="bigPromptWrap" style={{ marginTop: 14 }}>
              <h2
                className="bigPrompt"
                style={{
                  // Bigger on phones / landscape
                  fontSize: "clamp(44px, 10vw, 96px)",
                  padding: "24px 12px",
                }}
              >
                {currentWord}
              </h2>
            </div>

            <div className="hint">
              Keep the phone steady between tilts (return to neutral) so it counts only once.
            </div>

            <div className="smallRow" style={{ justifyContent: "space-between" }}>
              <span className="pill good">Correct: {correctCount}</span>
              <span className="pill danger">Pass: {passCount}</span>
              <button className="btn" onClick={finishRound}>
                End Round
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
