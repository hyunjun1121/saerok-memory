import { useState, useEffect } from "react";
import {
  StreakState, updateStreak
} from "./streaks";
import {
  GardenState, addGardenReward, RewardEvent, initialGardenState
} from "./gardenProgress";

export function useGamification() {
  const [streakState, setStreakState] = useState<StreakState>(() => {
    const saved = localStorage.getItem("streakState");
    if (saved) return JSON.parse(saved);
    return { currentStreak: 0, lastSessionDate: null, longestStreak: 0 };
  });

  const [gardenState, setGardenState] = useState<GardenState>(() => {
    const saved = localStorage.getItem("gardenState");
    if (saved) return JSON.parse(saved);
    return initialGardenState;
  });

  useEffect(() => {
    localStorage.setItem("streakState", JSON.stringify(streakState));
  }, [streakState]);

  useEffect(() => {
    localStorage.setItem("gardenState", JSON.stringify(gardenState));
  }, [gardenState]);

  const completeSession = () => {
    setStreakState(prev => updateStreak(prev));
    setGardenState(prev => addGardenReward(prev, "session_complete"));
  };

  const addReward = (event: RewardEvent) => {
    setGardenState(prev => addGardenReward(prev, event));
  };

  return { streakState, gardenState, completeSession, addReward };
}
