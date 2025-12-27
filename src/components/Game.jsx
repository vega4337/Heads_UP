// src/components/Game.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getScreenAngle, requestMotionPermission, toPitch } from "../utils/motion.js";
import { shuffle } from "../utils/shuffle.js";

export default function Game({ categoryKey, categories, roundSeconds, onFinish, onQuit }) {
  const category = categories?.[categoryKey];
  const categoryName = category?.name ?? "Category";

  const prompts = useMemo(() => {
    const list = category?.prompts ?? [];
    return shuffle([...list]); // fresh order each round
  }, [categoryKey]);

  // Flow:
  // 1) Setup screen (Enable Tilt) - timer NOT running
  // 2) Play screen - timer starts and big word shows
  const [phase, setPhase] = useState("setup"); // "setup" | "play"
  const [secondsLeft, setSecondsLeft] = useState(roundSeconds);
  const [idx, setIdx] = useState(0);
  const [history, setHistory] = useState([]); // { word, outcome: "correct"|"pass", t }
  const [error, setError] = useState("");

  // Sensitivity / gating
  const TILT_THRESHOLD = 22;   // bigger = less sensitive
  const NEUTRAL_THRESHOLD = 12; // must return near-neutral before next action
  const COOLDOWN_MS = 900;

  const enabledRef = useRef(false);
  const armedRef = useRef(true);
  const lastActionMsRef = useRef(0);

  const promptsRef = useRef(prompts);
  const idxRef = useRef(idx);

  useEffect(() => { promptsRef.current = prompts; }, [prompts]);
  useEffect(() => { idxRef.current = idx; }, [idx]);

  // Reset when category changes
  useEffect(() => {
    setPhase("setup");
    setSecondsLeft(roundSeconds);
    setIdx(0);
    setHistory([]);
    setError("");
    enabledRef.current = false;
    armedRef.current = true;
    lastActionMsRef.current = 0;
  }, [categoryKey, roundSeconds]);

  const currentWord = prompts?.[idx] ?? "";

  function record(outcome) {
    const list = promptsRef.current;
    const i = idxRef.current;
    const word = list?.[i] ?? "";

    if (!word) return;

    setHistory((prev) => [...prev, { word, outcome, t: Date.now() }]);

    setIdx((prev) => {
      const next = list.length ? (prev + 1) % list.length : 0;
      idxRef.current = next;
      return next;
    });
  }

  function stopTilt() {
    if (!enabledRef.current) return;
    enabledRef.current = false;
    window.removeEventListener("deviceorientation", onOrientation, true);
  }

  function finishRound() {
    stopTilt();

    const correctWords = history.filter((h) => h.outcome === "correct").map((h) => h.word);
    const passedWords = history.filter((h) => h.outcome === "pass").map((h) => h.word);

    const result = {
      categoryKey,
      categoryName,
      roundSeconds,
      total: history.length,
      correctCount: correctWords.length,
      passCount: passedWords.length,
      correctWords,
      passedWords,
      history,
    };

    onFinish(result);
  }

  // Timer only runs in PLAY phase
  useEffect(() => {
    if (phase !== "play") return;
    if (secondsLeft <= 0) {
      finishRound();
      return;
    }

    const id = setTimeout(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);

    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, secondsLeft]);

  // Orientation handler (needs stable reference)
  function onOrientation(e) {
    if (!enabledRef.current) return;

    const now = Date.now();
    const beta = e.beta;
    const gamma = e.gamma;

    const angle = getScreenAngle();
    let pitch = toPitch(beta, gamma, angle);

    // If user is holding phone to forehead, pitch will fluctuate.
    // Gate: must come back near neutral between actions.
    if (Math.abs(pitch) < NEUTRAL_THRESHOLD) {
      armedRef.current = true;
      return;
    }

    if (!armedRef.current) return;
    if (now - lastActionMsRef.current < COOLDOWN_MS) return;

    // Determine action
    // Convention: tilt DOWN = correct, tilt UP = pass
    // If yours feels reversed, swap the comparisons below.
    if (pitch > TILT_THRESHOLD) {
      lastActionMsRef.current = now;
      armedRef.current = false;
      record("correct");
      return;
    }

    if (pitch < -TILT_THRESHOLD) {
      lastActionMsRef.current = now;
      armedRef.current = false;
      record("pass");
      return;
    }
  }

  async function enableTiltAndStart() {
    setError("");

    const perm = await requestMotionPermission();
    if (perm !== "granted") {
      setError("Motion permission was denied. Enable it in iPhone Settings > Safari > Motion & Orientation Access.");
      return;
    }

    if (!promptsRef.current.length) {
      setError("No prompts found in this category.");
      return;
    }

    // Start round now (timer begins only after this)
    setSecondsLeft(roundSeconds);
    setIdx(0);
    idxRef.current = 0;
    setHistory([]);
    armedRef.current = true;
    lastActionMsRef.current = 0;

    enabledRef.current = true;
    window.addEventListener("deviceorientation", onOrientation, true);

    setPhase("play");
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => stopTilt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- UI ----------

  if (phase === "setup") {
    return (
      <div className="shell">
        <div className="card gameSetup">
          <div className="setupHeader">
            <div className="h1 setupTitle">{categoryName}</div>
            <p className="p setupSub">
              Timer will start only after you tap <b>Enable Tilt</b>.
              Turn OFF iPhone orientation lock for landscape testing.
            </p>
          </div>

          <div className="setupCard">
            <div className="setupRow">
              <div className="setupLabel">Round time</div>
              <div className="setupValue">{roundSeconds}s</div>
            </div>

            <div className="setupRow">
              <div className="setupLabel">How to play</div>
              <div className="setupValue">
                Hold the phone to your forehead. Tilt <b>DOWN</b> = Correct. Tilt <b>UP</b> = Pass.
              </div>
            </div>

            <div className="setupButtons">
              <button className="primaryBtn" onClick={enableTiltAndStart}>
                Enable Tilt
              </button>
              <button className="ghostBtn" onClick={onQuit}>
                Back
              </button>
            </div>

            {error ? <div className="setupError">{error}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  // PLAY PHASE
  return (
    <div className="shell">
      <div className="playScreen">
        <div className="topBar">
          <div className="pill">{categoryName}</div>
          <div className="timer">{secondsLeft}s</div>
        </div>

        <div className="bigWord">{currentWord}</div>

        <div className="hint warn">
          Tilt <b>DOWN</b> = Correct • Tilt <b>UP</b> = Pass
        </div>

        {/* No Pass/Correct buttons (per your request) */}
        <div className="smallRow" style={{ marginTop: 18 }}>
          <button className="btn danger" onClick={finishRound}>
            End Round
          </button>
          <button className="btn" onClick={onQuit}>
            Quit
          </button>
        </div>
      </div>
    </div>
  );
}
