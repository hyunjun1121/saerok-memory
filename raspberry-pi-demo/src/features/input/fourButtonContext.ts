import { createContext, useContext, useEffect, useLayoutEffect, useRef } from "react";
import type { ButtonSlot } from "@/features/input/keyConfig";

export type FourButtonHandler = (slot: ButtonSlot) => void;

export interface FourButtonStatus {
  readonly activeSlot: ButtonSlot | null;
  readonly configReady: boolean;
  readonly error: string | null;
}

export interface FourButtonContextValue extends FourButtonStatus {
  readonly registerHandler: (handler: FourButtonHandler) => () => void;
}

export const FourButtonContext = createContext<FourButtonContextValue | null>(null);

function useFourButtonContext(): FourButtonContextValue {
  const context = useContext(FourButtonContext);
  if (context === null) {
    throw new Error("Four-button hooks must be used inside FourButtonProvider.");
  }
  return context;
}

export function useFourButtonHandler(
  handler: FourButtonHandler | null,
  enabled = true,
): void {
  const { registerHandler } = useFourButtonContext();
  const latestHandlerRef = useRef(handler);

  useLayoutEffect(() => {
    latestHandlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return undefined;
    return registerHandler((slot) => latestHandlerRef.current?.(slot));
  }, [enabled, registerHandler]);
}

export function useFourButtonStatus(): FourButtonStatus {
  const { activeSlot, configReady, error } = useFourButtonContext();
  return { activeSlot, configReady, error };
}
