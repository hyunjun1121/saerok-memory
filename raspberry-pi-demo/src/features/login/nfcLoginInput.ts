import { useEffect, useRef } from "react";

export interface NfcLoginKeyboardEvent {
  readonly key: string;
  readonly code: string;
  readonly repeat?: boolean;
  readonly isComposing?: boolean;
  readonly defaultPrevented?: boolean;
  readonly shiftKey?: boolean;
  readonly altKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
}

/**
 * The kiosk NFC reader is configured as a keyboard wedge that emits one 5.
 * Keep this separate from the four-button mapping so 5 can never activate a
 * lesson control after the login screen has been dismissed.
 */
export function isNfcLoginKey(event: NfcLoginKeyboardEvent): boolean {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.repeat ||
    event.shiftKey ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  ) {
    return false;
  }

  return event.key === "5" || event.code === "Digit5";
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.closest("input, textarea, select, [contenteditable='true']") !== null
  );
}

/** Listen for one NFC keyboard-wedge press and invoke the authentication callback. */
export function useNfcLoginInput(onAuthenticated: () => void): void {
  const callbackRef = useRef(onAuthenticated);
  const handledRef = useRef(false);

  useEffect(() => {
    callbackRef.current = onAuthenticated;
  }, [onAuthenticated]);

  useEffect(() => {
    handledRef.current = false;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || !isNfcLoginKey(event)) return;
      event.preventDefault();
      if (handledRef.current) return;
      handledRef.current = true;
      callbackRef.current();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
