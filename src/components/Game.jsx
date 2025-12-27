// src/components/Game.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { requestMotionPermission, startTiltListener } from "../utils/motion.js";
import { shuffleArray } from "../utils/shuffle.js";

function resolveCategory(categories, categoryKey) {
  if (!categories || !categoryKey) return null;

  // If categories is an object map: { popCulture: { name, words: [...] }, ... }
  if (!Array.isArray(categories) && typeof categories === "object") {
    return categories[categoryKey] || null;
  }

  // If categories is an array: [{ key, name, words }, ...]
  if (Array.isArray(categories)) {
    return (
      categories.find((c) => c.key === categoryKey || c.id === categoryKey) || null
    );
  }

  return null;
}

function resolveWords(cat) {
  if (!cat) return [];
  // Common shapes
  if (Array.isArray(cat.words)) return cat.words;
  if (Array.isArray(cat.prompts)) return cat.prompts;
  if (Array.isArray(cat.items)) return cat.items;
  // If cat itself is an array
  if (Array.isArray(cat)) return cat;
  return [];
}

export default function Game({
  categoryKey,
  categories,
  roundSeconds,
  onFinish,
  onQuit,
}) {
  const cat = useMemo(
    () => resolveCategory(categories, categoryKey),
    [categories, categoryKey]
  );

  const categoryName = cat?.name || cat?.title || categoryKey || "Category";
  const baseWords = useMemo(() => resolveWords(cat), [cat]);
  const hasWords = baseWords.length > 0;

  // Setup stage vs running stage
  const [tiltEnabled, setTiltEnabled] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Round state (starts when tilt enabled)
  const [secondsLeft, setSecondsLeft] = useState(roundSeconds);
  const [deck, setDeck] = useState([]);
  const [idx, setIdx] = useState(0);
  const [log, setLog] = useState([]); // [{ word, verdict: "correct"|"pass", ts }]

  const timerRef = useRef(null);
  const stopTiltRef = useRef(null);

  const currentWord = deck[idx] || "";

  // Reset whenever category changes
  useEffect(() => {
    // cleanup
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    if (stopTiltRef.current) stopTiltRef.current();
    stopTiltRef.current = null;

    setTiltEnabled(false);
    setPermissionGranted(false);

    setSecondsLeft(roundSeconds);
    setDeck([]);
    setIdx(0);
    setLog([]);
  }, [categoryKey, roundSeconds]);

  async function enableTiltAndStart() {
    if (!hasWords) return;

    const ok = await requestMotionPermission();
    setPermissionGranted(ok);

    if (!ok) {
      // Keep on setup screen; user can retry
      return;
    }

    // Start round now
    const shuffled = shuffleArray([...baseWords]);
    setDeck(shuffled);
    setIdx(0);
    setLog([]);
    setSecondsLeft(roundSeconds);
    setTiltEnabled(true);
  }

  function finishRound(reason = "time") {
    // stop listeners
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    if (stopTiltRef.current) stopTiltRef.current();
    stopTiltRef.current = null;

    const correctWords = log.filter((x) => x.verdict === "correct").map((x) => x.word);
    const passedWords = log.filter((x) => x.verdict === "pass").map((x) => x.word);

    const result = {
      reason,
      categoryKey,
      categoryName,
      seconds: roundSeconds,
      total: log.length,
      correctCount: correctWords.length,
      passCount: passedWords.length,
      correctWords,
      passedWords,
      history: log,
    };

    onFinish(result);
  }

  // Start timer + tilt listener only after tiltEnabled
  useEffect(() => {
    if (!tiltEnabled) return;

    // Timer
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) return 0;
        return s - 1;
      });
    }, 1000);

    // Tilt listener (debounced/hysteresis in motion.js)
    stopTiltRef.current = startTiltListener((action) => {
      // action is "correct" or "pass"

      // Use functional updates so we log the correct word (no repeats)
      setDeck((d) => d); // no-op, keeps state stable
      setIdx((i) => {
        const word = deck[i] || ""; // NOTE: deck from closure can be stale
        return i;
      });

      // To avoid stale closure issues, derive word from latest state using refs
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;

      if (stopTiltRef.current) stopTiltRef.current();
      stopTiltRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiltEnabled]);

  // Refs to avoid stale closures for deck/idx
  const deckRef = useRef(deck);
  const idxRef = useRef(idx);
  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);
  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);

  // Install tilt listener using refs (stable + correct logging)
  useEffect(() => {
    if (!tiltEnabled) return;

    // Replace any previous listener (safety)
    if (stopTiltRef.current) stopTiltRef.current();

    stopTiltRef.current = startTiltListener((action) => {
      const d = deckRef.current;
      const i = idxRef.current;
      const word = d[i];

      if (!word) return;

      setLog((prev) => [...prev, { word, verdict: action, ts: Date.now() }]);

      // Advance to next word
      setIdx((prevIdx) => {
        const next = prevIdx + 1;
        if (next >= d.length) return 0; // loop deck
        return next;
      });
    });

    return () => {
      if (stopTiltRef.current) stopTiltRef.current();
      stopTiltRef.current = null;
    };
  }, [tiltEnabled]);

  // When timer hits 0, end round
  useEffect(() => {
    if (!tiltEnabled) return;
    if (secondsLeft === 0) finishRound("time");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, tiltEnabled]);

  // SETUP SCREEN (no timer running yet)
  if (!tiltEnabled) {
    return (
      <div className="card">
        <h1 className="h1">{categoryName}</h1>
        <p className="p">
          Timer will start only after you tap <b>Enable Tilt</b>. Turn OFF iPhone orientation
          lock for landscape testing.
        </p>

        <div className="kpiRow">
          <div className="kpi">
            <p className="kpiLabel">Round time</p>
            <p className="kpiValue">{roundSeconds}s</p>
          </div>
          <div className="kpi">
            <p className="kpiLabel">How to play</p>
            <p className="kpiValue" style={{ fontSize: 14, fontWeight: 600 }}>
              Hold the phone to your forehead. Tilt <b>DOWN</b> = Correct. Tilt <b>UP</b> = Pass.
            </p>
          </div>
          <div className="kpi">
            <p className="kpiLabel">Prompts</p>
            <p className="kpiValue">{baseWords.length}</p>
          </div>
        </div>

        <div className="smallRow">
          <button className="btn primary" onClick={enableTiltAndStart} disabled={!hasWords}>
            Enable Tilt
          </button>
          <button className="btn" onClick={onQuit}>Back</button>
        </div>

        {!hasWords && (
          <div className="pill danger" style={{ marginTop: 12 }}>
            No prompts found in this category.
          </div>
        )}

        {!permissionGranted && (
          <div className="hint" style={{ marginTop: 10 }}>
            If iOS asks for Motion & Orientation access, tap Allow.
          </div>
        )}
      </div>
    );
  }

  // RUNNING SCREEN (big word, landscape-friendly)
  return (
    <div className="card">
      <div className="row">
        <div>
          <div className="pill">{categoryName}</div>
        </div>
        <div className="pill primary">{secondsLeft}s</div>
      </div>

      <div className="bigPromptWrap">
        <p className="bigPrompt">{currentWord}</p>
      </div>

      <p className="hint">
        Tilt DOWN = Correct • Tilt UP = Pass
      </p>

      {/* Buttons removed per your request while we troubleshoot tilt */}
      <div className="smallRow" style={{ justifyContent: "center" }}>
        <button className="btn danger" onClick={() => finishRound("manual")}>
          End Round
        </button>
      </div>
    </div>
  );
}
