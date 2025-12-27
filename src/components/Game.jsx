// src/components/Game.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ScreenShell from "./ScreenShell.jsx";
import { shuffle } from "../utils/shuffle";
import { requestMotionPermission, startTiltListener } from "../utils/motion";

export default function Game({ categoryKey, categories, roundSeconds, onFinish, onQuit }) {
  const category = categories?.[categoryKey];
  const words = useMemo(() => {
    const list = category?.words ? [...category.words] : [];
    return shuffle(list);
  }, [categoryKey, category?.words]);

  const [idx, setIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(Number(roundSeconds) || 60);

  const [correctWords, setCorrectWords] = useState([]);
  const [passedWords, setPassedWords] = useState([]);

  const [tiltEnabled, setTiltEnabled] = useState(false);
  const stopTiltRef = useRef(null);

  const currentWord = words[idx] ?? "";

  // If category is missing, fail gracefully instead of blank screen
  useEffect(() => {
    if (!category) {
      onQuit?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryKey]);

  // Timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  // End round
  useEffect(() => {
    if (timeLeft > 0) return;

    if (stopTiltRef.current) {
      stopTiltRef.current();
      stopTiltRef.current = null;
    }

    const result = {
      categoryName: category?.name ?? categoryKey,
      roundSeconds: Number(roundSeconds) || 60,
      correct: correctWords.length,
      passed: passedWords.length,
      total: correctWords.length + passedWords.length,
      correctWords,
      passedWords
    };

    onFinish?.(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const nextWord = () => {
    setIdx((i) => (i + 1 >= words.length ? 0 : i + 1));
  };

  const markCorrect = () => {
    if (!currentWord) return;
    setCorrectWords((arr) => [...arr, currentWord]);
    nextWord();
  };

  const markPass = () => {
    if (!currentWord) return;
    setPassedWords((arr) => [...arr, currentWord]);
    nextWord();
  };

  const enableTilt = async () => {
    const ok = await requestMotionPermission();
    if (!ok) {
      alert("Motion permission was not granted. Tilt will be disabled; use buttons instead.");
      setTiltEnabled(false);
      return;
    }

    if (stopTiltRef.current) stopTiltRef.current();

    stopTiltRef.current = startTiltListener({
      onDown: markCorrect,
      onUp: markPass,
      enabled: true
    });

    setTiltEnabled(true);
  };

  useEffect(() => {
    return () => {
      if (stopTiltRef.current) {
        stopTiltRef.current();
        stopTiltRef.current = null;
      }
    };
  }, []);

  return (
    <ScreenShell
      title={category?.name ?? "Game"}
      subtitle="Tilt DOWN = Correct, tilt UP = Pass. Buttons also work."
    >
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <button className="btn" onClick={onQuit}>Quit</button>
        <div className="pill">
          <span className="mono">{timeLeft}s</span>
        </div>
      </div>

      <div className="promptCard" style={{ marginTop: 14 }}>
        <div className="promptText">{currentWord}</div>
      </div>

      <div className="row" style={{ gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button className="btn" onClick={markPass}>Pass</button>
        <button className="btn primary" onClick={markCorrect}>Correct</button>
        {!tiltEnabled ? (
          <button className="btn" onClick={enableTilt} title="Tap required on iPhone">
            Enable Tilt
          </button>
        ) : (
          <span className="pill">Tilt enabled</span>
        )}
      </div>

      <div className="smallRow" style={{ marginTop: 12 }}>
        <span className="pill">Correct: {correctWords.length}</span>
        <span className="pill">Pass: {passedWords.length}</span>
      </div>
    </ScreenShell>
  );
}
