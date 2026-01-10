// src/components/Game.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { shuffleArray } from "../utils/shuffle.js";
import {
  requestMotionPermission,
  startTiltCalibration,
  startTiltListener,
} from "../utils/motion.js";

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

  // stages: ready -> playing
  const [stage, setStage] = useState("ready");
  const [secondsLeft, setSecondsLeft] = useState(roundSeconds);

  const [deck, setDeck] = useState([]);
  const [index, setIndex] = useState(0);

  const [correctCount, setCorrectCount] = useState(0);
  const [passCount, setPassCount] = useState(0);
  const [items, setItems] = useState([]); // { word, outcome }
  const [tiltStatus, setTiltStatus] = useState("Tilt not enabled.");

  const timerRef = useRef(null);
  const tiltCalibrationRef = useRef(null);
  const tiltListenerRef = useRef(null);

  // Keep refs in sync so end/finish is accurate
  const deckRef = useRef([]);
  const indexRef = useRef(0);
  const correctRef = useRef(0);
  const passRef = useRef(0);
  const itemsRef = useRef([]);

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
    if (tiltCalibrationRef.current) {
      tiltCalibrationRef.current.stop();
      tiltCalibrationRef.current = null;
    }
    if (tiltListenerRef.current) {
      tiltListenerRef.current.stop();
      tiltListenerRef.current = null;
    }
  }

  function finishRound() {
    stopTilt();
    stopTimer();

    const finalItems = itemsRef.current;
    const result = {
      categoryKey,
      categoryName: category?.name || "Category",
      roundSeconds,
      total: finalItems.length,
      correctCount: correctRef.current,
      passCount: passRef.current,
      correctWords: finalItems
        .filter((x) => x.outcome === "correct")
        .map((x) => x.word),
      passedWords: finalItems
        .filter((x) => x.outcome === "pass")
        .map((x) => x.word),
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

  async function startRound() {
    // reset round stats
    setCorrectCount(0);
    setPassCount(0);
    setItems([]);
    correctRef.current = 0;
    passRef.current = 0;
    itemsRef.current = [];

    setIndex(0);
    indexRef.current = 0;

    setStage("playing");
    startTimer();

    stopTilt();
    setTiltStatus("Requesting motion permission...");

    const granted = await requestMotionPermission();
    if (!granted) {
      setTiltStatus(
        "Motion permission denied. Enable motion/orientation access to play."
      );
      return;
    }

    tiltCalibrationRef.current = startTiltCalibration({
      onStatus: setTiltStatus,
      onCalibrated: ({ axis, downSign }) => {
        setTiltStatus("Tilt enabled. Down = Correct, Up = Pass.");
        tiltListenerRef.current = startTiltListener({
          axis,
          downSign,
          onStatus: setTiltStatus,
          onAction: (action) => {
            if (action === "down") advance("correct");
            if (action === "up") advance("pass");
          },
        });
      },
    });
  }

  function advance(outcome) {
    if (stage !== "playing") return;

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

  // Initialize deck on category change
  useEffect(() => {
    const shuffled = shuffleArray(prompts);
    setDeck(shuffled);
    deckRef.current = shuffled;

    setStage("ready");
    stopTimer();
    stopTilt();
    setSecondsLeft(roundSeconds);

    setIndex(0);
    indexRef.current = 0;

    setCorrectCount(0);
    setPassCount(0);
    setItems([]);
    correctRef.current = 0;
    passRef.current = 0;
    itemsRef.current = [];

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryKey]);

  // If roundSeconds changes while on ready screen, reflect it
  useEffect(() => {
    if (stage === "ready") setSecondsLeft(roundSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundSeconds]);

  useEffect(() => {
    return () => {
      stopTimer();
      stopTilt();
    };
  }, []);

  if (!category) {
    return (
      <div className="shell">
        <div className="card">
          <h1 className="h1">Game</h1>
          <p className="p">No category selected.</p>
          <button className="btn" onClick={onQuit}>
            Back
          </button>
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
          <button className="btn" onClick={onQuit}>
            Back
          </button>
        </div>
      </div>
    );
  }

  const currentWord = deck[index] ?? "";

  return (
    <div className="gameShell">
      <div className="gameTopBar">
        <div className="gameTitle">
          <div className="gameCategory">{category?.name || "Category"}</div>
          <div className="gameSub">
            Tilt down = Correct. Tilt up = Pass.
          </div>
        </div>

        <div className="gameMeta">
          <div className="gameTimer">{secondsLeft}s</div>
          <button className="btn gameBackBtn" onClick={onQuit}>
            Back
          </button>
        </div>
      </div>

      {stage === "ready" ? (
        <div className="gameReady">
          <div className="card" style={{ width: "min(720px, 100%)" }}>
            <h2 className="h1" style={{ marginBottom: 6 }}>
              Ready?
            </h2>
            <p className="p">
              Rotate to landscape for best play. Timer starts when you tap Start.
            </p>

            <div className="smallRow">
              <button className="btn primary" onClick={startRound}>
                Start
              </button>
              <button className="btn" onClick={onQuit}>
                Change Category
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="gameLayout">
          <div className="centerPane">
            <div className="centerWord">{currentWord}</div>

            <div className="centerStats">
              <span className="pill good">Correct: {correctCount}</span>
              <span className="pill danger">Pass: {passCount}</span>
              <button className="btn" onClick={finishRound}>
                End Round
              </button>
            </div>

            <div className="tiltStatus">{tiltStatus}</div>
          </div>
        </div>
      )}
    </div>
  );
}
