import { useEffect } from "react";

export interface KioskControlsOptions {
  onPrimary: () => void;
  onSelect?: (index: number) => void;
  enabled?: boolean;
}

// Keyboard / physical-button style controls for welfare-center kiosk mode
// (SP-10). Enter or Space activates the primary action; digit keys 1-4 select a
// choice. Designed for a tablet/physical-button setup but degrades gracefully —
// if no keyboard exists, the on-screen large buttons still work.
export function useKioskControls({
  onPrimary,
  onSelect,
  enabled = true,
}: KioskControlsOptions) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        onPrimary();
        return;
      }

      if (onSelect) {
        const digit = Number.parseInt(event.key, 10);
        if (digit >= 1 && digit <= 4) {
          event.preventDefault();
          onSelect(digit - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onPrimary, onSelect]);
}
