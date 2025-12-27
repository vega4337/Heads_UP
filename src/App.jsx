import React, { useMemo, useState } from "react";
import Home from "./components/Home.jsx";
import Game from "./components/Game.jsx";
import Results from "./components/Results.jsx";
import { CATEGORIES } from "./data/words.js";

export default function App() {
  const [screen, setScreen] = useState("home"); // home | game | results
  const [categoryKey, setCategoryKey] = useState(null);
  const [roundSeconds, setRoundSeconds] = useState(60);
  const [results, setResults] = useState(null);

  const categories = useMemo(() => CATEGORIES, []);

  const start = (key) => {
    setCategoryKey(key);
    setResults(null);
    setScreen("game");
  };

  const finish = (gameResults) => {
    setResults(gameResults);
    setScreen("results");
  };

  const goHome = () => {
    setCategoryKey(null);
    setResults(null);
    setScreen("home");
  };

  if (screen === "home") {
    return (
      <Home
        categories={categories}
        roundSeconds={roundSeconds}
        setRoundSeconds={setRoundSeconds}
        onStart={start}
      />
    );
  }

  if (screen === "game") {
    return (
      <Game
        categoryKey={categoryKey}
        categories={categories}
        roundSeconds={roundSeconds}
        onFinish={finish}
        onQuit={goHome}
      />
    );
  }

  return <Results results={results} onHome={goHome} />;
}
