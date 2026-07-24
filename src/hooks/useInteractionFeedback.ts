import { useCallback } from "react";
import {
  type InteractionCue,
  playInteractionCue,
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
  const playCue = useCallback((cue: InteractionCue): Promise<void> => {
    if (!isSoundFeedbackEnabled()) {
      return Promise.resolve();
    }

    if (cue === "select" || cue === "confirm") {
      vibrateLightly(15);
    } else if (cue === "success" || cue === "routineComplete") {
      vibrateLightly([18, 40, 18]);
    }
    return playInteractionCue(cue);
  }, []);

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
    speakCalmly(text, lang);
  }, []);

  return { playCue, tap, success, speak };
}
