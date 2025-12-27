// src/components/Game.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  requestMotionPermission,
  startTiltCalibration,
  startTiltListener,
} from "../utils/motion.js";
import { shuffleArray } from "../utils/shuffle.js";

function resolveCategory(categories, categoryKey) {
  if (!categories || !categoryKey) return null;

  if (typeof categories === "object" && !Array.isArray(categories)) {
    return categories[categoryKey] || null;
  }

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
    const list = category?.prompts || category?.words || [];
    return Array.isArray(list) ? list : [];
  }, [category]);

  // stages: ready -> calibrating -> playing
  const [stage, setStage] = useState("ready");
  const stageRef = useRef(stage);
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  const [tiltStatus, setTiltStatus] = useState("Tilt not enabled.");
  const [secondsLeft, setSecondsLeft] = useState(roundSeconds);

  const [deck, setDeck] = useState([]);
  const [index, setIndex] = useState(0);

  const [correctCount, setCorrectCount] = useState(0);
  const [passCount, setPassCount] = useState(0);
  const [items, setItems] = useState([]); // { word, outcome }

  // refs for sensor callbacks
  const deckRef = useRef([]);
  const indexRef = useRef(0);
  const correctRef = useRef(0);
  const passRef = useRef(0);
  const itemsRef = useRef([]);

  const timerRef = useRef(null);
  const tiltRef = useRef(null);
  const calibratorRef = useRef(null);

  const calibrationRef = useRef(null); // { axis, downSign }

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
    if (tiltRef.current) {
      tiltRef.current.stop?.();
      tiltRef.current = null;
    }
  }

  function stopCalibration() {
    if (calibratorRef.current) {
      calibratorRef.current.stop?.();
      calibratorRef.current = null;
    }
  }

  function finishRound() {
    stopTilt();
    stopCalibration();
    stopTimer();

    const finalItems = itemsRef.current;
    const result = {
      categoryKey,
      categoryName: category?.name || "Category",
      roundSeconds,
      total: finalItems.length,
      correctCount: correctRef.current,
      passCount: passRef.current,
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
          setTimeout(() => finishRound(), 0);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function advance(outcome) {
    if (stageRef.current !== "playing") return;

    const d = deckRef.current;
    const i = indexRef.current;
    if (!d.length || i >= d.length) return;

    const word = d[i];

    const nextItems = [...itemsRef.current, { word, outcome }];
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

    const nextIndex = i + 1;
    indexRef.current = nextIndex;
    setIndex(nextIndex);

    if (nextIndex >= d.length) finishRound();
  }

  async function enableTilt() {
    if (!deckRef.current.length) return;

    setTiltStatus("Requesting motion permission…");
    const ok = await requestMotionPermission();
    if (!ok) {
      setTiltStatus("Motion permission denied. Enable Motion & Orientation access and reload.");
      return;
    }

    stopTilt();
    stopCalibration();
    stopTimer();

    setStage("calibrating");
    setTiltStatus("Calibrating… hold steady, then tilt DOWN once.");

    calibratorRef.current = startTiltCalibration({
      thresholdDeg: 30,
      neutralDeg: 16,
      cooldownMs: 800,
      smoothing: 0.35,
      onStatus: (msg) => setTiltStatus(msg),
      onCalibrated: ({ axis, downSign }) => {
        calibrationRef.current = { axis, downSign };
        setTiltStatus(
          `Calibrated. Axis: ${axis.toUpperCase()}. Tilt DOWN = Correct, Tilt UP = Pass.`
        );

        // Start actual listener using calibration
        stopTilt();
        tiltRef.current = startTiltListener({
          axis,
          downSign,
          thresholdDeg: 30,
          neutralDeg: 16,
          cooldownMs: 800,
          smoothing: 0.35,
          onStatus: (msg) => setTiltStatus(msg),
          onAction: (dir) => {
            if (dir === "down") advance("correct");
            if (dir === "up") advance("pass");
          },
        });

        setStage("playing");
        startTimer();
      },
    });
  }

  // Reset everything when category changes
  useEffect(() => {
    const shuffled = shuffleArray(prompts);
    setDeck(shuffled);
    setIndex(0);

    setCorrectCount(0);
    setPassCount(0);
    setItems([]);

    setSecondsLeft(roundSeconds);
    setStage("ready");
    setTiltStatus("Tilt not enabled.");

    deckRef.current = shuffled;
    indexRef.current = 0;
    correctRef.current = 0;
    passRef.current = 0;
    itemsRef.current = [];
    calibrationRef.current = null;

    stopTilt();
    stopCalibration();
    stopTimer();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryKey]);

  useEffect(() => {
    return () => {
      stopTilt();
      stopCalibration();
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
                ? "Timer starts only after you calibrate. Turn OFF iPhone orientation lock for landscape."
                : "Hold to forehead. Tilt DOWN = Correct. Tilt UP = Pass."}
            </p>
          </div>
          <div className="pill">
            {stage === "playing" ? `${secondsLeft}s` : `${roundSeconds}s`}
          </div>
        </div>

        {stage === "ready" && (
          <>
            <div className="smallRow">
              <button className="btn primary" onClick={enableTilt}>
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

        {stage !== "ready" && (
          <>
            <div className="pill" style={{ marginTop: 10 }}>
              {tiltStatus}
            </div>

            <div className="bigPromptWrap" style={{ marginTop: 14 }}>
              <h2
                className="bigPrompt"
                style={{
                  fontSize: "clamp(44px, 10vw, 96px)",
                  padding: "24px 12px",
                }}
              >
                {currentWord}
              </h2>
            </div>

            {stage === "playing" && (
              <>
                <div className="hint">
                  Tip: after a tilt, return to neutral before tilting again (prevents double-counting).
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
          </>
        )}
      </div>
    </div>
  );
}
