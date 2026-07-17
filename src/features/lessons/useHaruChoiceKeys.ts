import { useEffect } from "react";
import {
  findHaruChoiceIndex,
  type HaruChoiceKeyBindings,
} from "@/features/lessons/haruInputBindings";

interface UseHaruChoiceKeysOptions {
  bindings: HaruChoiceKeyBindings;
  enabled: boolean;
  onSelect: (index: number) => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.closest("input, textarea, select, [contenteditable='true']") !== null
  );
}

export function useHaruChoiceKeys({
  bindings,
  enabled,
  onSelect,
}: UseHaruChoiceKeysOptions): void {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const choiceIndex = findHaruChoiceIndex(bindings, event);
      if (choiceIndex < 0) return;

      event.preventDefault();
      onSelect(choiceIndex);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [bindings, enabled, onSelect]);
}
