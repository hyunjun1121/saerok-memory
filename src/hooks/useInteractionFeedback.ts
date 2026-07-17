import { useCallback } from "react";
import {
  playSoftSuccessTone,
  playSoftTapTone,
  speakCalmly,
  vibrateLightly,
} from "@/hooks/interactionFeedback";
import { isSoundFeedbackEnabled } from "@/features/profile/learnerProfileStorage";

// Bridges the defensive feedback primitives with the learner's sound setting.
// Visual/text/border feedback always happens at the component level; this hook
// only adds optional sound + vibration on top.
export function useInteractionFeedback() {
  const tap = useCallback(() => {
    if (!isSoundFeedbackEnabled()) return;
    playSoftTapTone();
    vibrateLightly(15);
  }, []);

  const success = useCallback(() => {
    if (!isSoundFeedbackEnabled()) return;
    playSoftSuccessTone();
    vibrateLightly([18, 40, 18]);
  }, []);

  const speak = useCallback((text: string, lang?: string) => {
    if (!isSoundFeedbackEnabled()) return;
    speakCalmly(text, lang);
  }, []);

  return { tap, success, speak };
}
