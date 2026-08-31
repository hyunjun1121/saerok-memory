import { useCallback, useState } from "react";
import { OfflineLessonScreen } from "@/features/lesson/OfflineLesson";
import { NfcLoginScreen } from "@/features/login/NfcLoginScreen";

/** Keeps NFC authentication in memory for one lesson route session only. */
export function LessonEntryScreen() {
  const [authenticated, setAuthenticated] = useState(false);
  const authenticate = useCallback(() => setAuthenticated(true), []);

  if (!authenticated) return <NfcLoginScreen onAuthenticated={authenticate} />;
  return <OfflineLessonScreen />;
}
