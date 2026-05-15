import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type StreakState, updateStreak
} from "./streaks";
import {
  type GardenState, addGardenReward, type RewardEvent, initialGardenState
} from "./gardenProgress";

interface GamificationContextValue {
  streakState: StreakState;
  gardenState: GardenState;
  completeSession: () => void;
  addReward: (event: RewardEvent) => void;
}

const initialStreakState: StreakState = {
  currentStreak: 0,
  lastSessionDate: null,
  longestStreak: 0,
};

const GamificationContext = createContext<GamificationContextValue | null>(null);

function readStorageState<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) as T : fallback;
  } catch {
    return fallback;
  }
}

export function GamificationProvider({ children }: { children: ReactNode }) {
  const [streakState, setStreakState] = useState<StreakState>(() => {
    return readStorageState("streakState", initialStreakState);
  });

  const [gardenState, setGardenState] = useState<GardenState>(() => {
    return readStorageState("gardenState", initialGardenState);
  });

  useEffect(() => {
    localStorage.setItem("streakState", JSON.stringify(streakState));
  }, [streakState]);

  useEffect(() => {
    localStorage.setItem("gardenState", JSON.stringify(gardenState));
  }, [gardenState]);

  const completeSession = useCallback(() => {
    setStreakState(prev => updateStreak(prev));
    setGardenState(prev => addGardenReward(prev, "session_complete"));
  }, []);

  const addReward = useCallback((event: RewardEvent) => {
    setGardenState(prev => addGardenReward(prev, event));
  }, []);

  const value = useMemo(
    () => ({ streakState, gardenState, completeSession, addReward }),
    [streakState, gardenState, completeSession, addReward]
  );

  return createElement(GamificationContext.Provider, { value }, children);
}

export function useGamification() {
  const context = useContext(GamificationContext);

  if (!context) {
    throw new Error("useGamification must be used within GamificationProvider");
  }

  return context;
}
