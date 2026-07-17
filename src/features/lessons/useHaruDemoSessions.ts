import { useEffect, useState } from "react";
import {
  HARU_DEMO_SESSION_STORAGE_KEY,
  HARU_DEMO_SESSION_UPDATED_EVENT,
  getHaruDemoSessions,
  type HaruDemoSession,
} from "@/features/lessons/haruDemoSessionStorage";

export function useHaruDemoSessions(): HaruDemoSession[] {
  const [sessions, setSessions] = useState<HaruDemoSession[]>(() =>
    getHaruDemoSessions(),
  );

  useEffect(() => {
    const refresh = () => setSessions(getHaruDemoSessions());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === HARU_DEMO_SESSION_STORAGE_KEY) refresh();
    };

    window.addEventListener(HARU_DEMO_SESSION_UPDATED_EVENT, refresh);
    window.addEventListener("storage", handleStorage);
    refresh();
    return () => {
      window.removeEventListener(HARU_DEMO_SESSION_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return sessions;
}
