// src/components/Game.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ScreenShell from "./ScreenShell.jsx";
import { shuffle } from "../utils/shuffle.js";
import { requestMotionPermission, startTiltListener } from "../utils/motion.js";

export default function Game({
  categoryKey,
  categories,
  roundSeconds,
  onFinish,
  onQuit
}) {
  const category = categories?.[categoryKey];
  const categoryName = category?.name ?? "Category";
  const prompts = useMemo(() => category?.words ?? [], [category]);

  // Flow: "setup" (enable tilt) -> "play" (big word + timer)
  const [phase, setPhase] = useState("setup");

  // Words
  const deckRef = useRef([]);
  const [currentWord, setCurrentWord] = useState("");

  // Keep latest word for tilt callbacks (prevents repeated-word bug)
  const wordRef = useRef("");
  useEffect(() => {
    wordRef.current = currentWord;
  }, [currentWord]);

  // Scoring
  const [correctWords, setCorrectWords] = useState([]);
  const [passedWords, setPassedWords] = useState([]);

  // Timer
  const [secondsLeft, setSecondsLeft] = useState(roundSeconds);
  const timerRef = useRef(null);

  // Tilt
  const stopTiltRef = useRef(null);
  const [tiltEnabled, setTiltEnabled] = useState(false);
  const [tiltError, setTiltError] = useState("");

  // Init deck once per category
  useEffect(() => {
    setPhase("setup");
    setTiltEnabled(false);
    setTiltError("");
    setSecondsLeft(roundSeconds);
    setCorrectWords([]);
    setPassedWords([]);

    // build shuffled deck
    deckRef.current = shuffle([...prompts]);
    // set first word
    const first = deckRef.current.shift() ?? "";
    setCurrentWord(first);

    // cleanup any running stuff
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    if (stopTiltRef.current) stopTiltRef.current();
    stopTiltRef.current = null;

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      if (stopTiltRef.current) stopTiltRef.current();
      stopTiltRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryKey]);

  function nextWord() {
    const next = deckRef.current.shift() ?? "";
    setCurrentWord(next);
  }

  function markCorrect() {
    const w = wordRef.current;
    if (!w) return;
    setCorrectWords((arr) => [...arr, w]);
    nextWord();
  }

  function markPass() {
    const w = wordRef.current;
    if (!w) return;
    setPassedWords((arr) => [...arr, w]);
    nextWord();
  }

  function finishRound() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    if (stopTiltRef.current) stopTiltRef.current();
    stopTiltRef.current = null;

    const correctCount = correctWords.length;
    const passCount = passedWords.length;
    const total = correctCount + passCount;

    onFinish({
      categoryKey,
      categoryName,
      total,
      correctCount,
      passCount,
      correctWords,
      passedWords
    });
  }

  function startTimer() {
    if (timerRef.current) return;

    setSecondsLeft(roundSeconds);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          // Finish after state updates settle
          setTimeout(() => finishRound(), 0);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function enableTiltAndStart() {
    setTiltError("");

    const ok = await requestMotionPermission();
    if (!ok) {
      setTiltError(
        "Motion permission not granted. On iPhone: Settings → Safari → Motion & Orientation Access (enable)."
      );
      return;
    }

    // stop any existing listener (safety)
    if (stopTiltRef.current) stopTiltRef.current();

    stopTiltRef.current = startTiltListener({
      onCorrect: markCorrect,
      onPass: markPass,
      // less sensitive defaults; adjust later if needed
      correctDelta: 28,
      passDelta: 28,
      deadZone: 16,
      cooldownMs: 950
    });

    setTiltEnabled(true);
    setPhase("play");
    startTimer();
  }

  // If user wants to quit mid-round
  function quit() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    if (stopTiltRef.current) stopTiltRef.current();
    stopTiltRef.current = null;

    onQuit?.();
  }

  return (
    <ScreenShell>
      {phase === "setup" ? (
        <div className="gameSetup">
          <div className="setupHeader">
            <div className="setupTitle">{categoryName}</div>
            <div className="setupSub">
              Timer will start after you press <b>Enable Tilt</b>.
            </div>
          </div>

          <div className="setupCard">
            <div className="setupRow">
              <div className="setupLabel">Round time</div>
              <div className="setupValue">{roundSeconds}s</div>
            </div>

            <div className="setupRow">
              <div className="setupLabel">How to play</div>
              <div className="setupValue">
                Hold phone to forehead.
                <br />
                Tilt <b>DOWN</b> = Correct, tilt <b>UP</b> = Pass.
              </div>
            </div>

            {tiltError ? <div className="setupError">{tiltError}</div> : null}

            <div className="setupButtons">
              <button className="primaryBtn" onClick={enableTiltAndStart}>
                Enable Tilt (Start)
              </button>
              <button className="ghostBtn" onClick={quit}>
                Back
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="playScreen">
          <div className="topBar">
            <div className="pill">{categoryName}</div>
            <div className="timer">{secondsLeft}s</div>
          </div>

          <div className="bigWord" aria-live="polite">
            {currentWord || "—"}
          </div>

          <div className="hint">
            Tilt <b>DOWN</b> = Correct • Tilt <b>UP</b> = Pass
          </div>

          {/* Buttons removed intentionally while troubleshooting tilt */}
          {!tiltEnabled ? (
            <div className="hint warn">
              Tilt not enabled. Go back and press Enable Tilt.
            </div>
          ) : null}
        </div>
      )}
    </ScreenShell>
  );
}
