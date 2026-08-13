import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FourButtonContext,
  type FourButtonContextValue,
  type FourButtonHandler,
} from "@/features/input/fourButtonContext";
import {
  DEFAULT_FOUR_BUTTON_CONFIG,
  getKeyboardKeyIdentity,
  mapKeyboardEventToSlot,
  parseFourButtonConfig,
  type ButtonSlot,
  type FourButtonKeyConfig,
  type RawFourButtonConfig,
} from "@/features/input/keyConfig";

interface FourButtonProviderProps extends PropsWithChildren {
  readonly config?: RawFourButtonConfig;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.closest("input, textarea, select, [contenteditable='true']") !== null
  );
}

function resolveConfig(config: RawFourButtonConfig | undefined): {
  parsed: FourButtonKeyConfig | null;
  error: string | null;
} {
  try {
    return {
      parsed:
        config === undefined
          ? DEFAULT_FOUR_BUTTON_CONFIG
          : parseFourButtonConfig(config),
      error: null,
    };
  } catch (error) {
    return {
      parsed: null,
      error: error instanceof Error ? error.message : "Unknown four-button config error.",
    };
  }
}

export function FourButtonProvider({
  children,
  config,
}: FourButtonProviderProps) {
  const resolved = useMemo(() => resolveConfig(config), [config]);
  const handlerRef = useRef<FourButtonHandler | null>(null);
  const pressedSlotsRef = useRef(new Set<ButtonSlot>());
  const lastAcceptedAtRef = useRef(new Map<ButtonSlot, number>());
  const [activeSlot, setActiveSlot] = useState<ButtonSlot | null>(null);

  const registerHandler = useCallback((handler: FourButtonHandler) => {
    handlerRef.current = handler;
    return () => {
      if (handlerRef.current === handler) handlerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const keyConfig = resolved.parsed;
    const pressedSlots = pressedSlotsRef.current;
    const lastAcceptedAt = lastAcceptedAtRef.current;
    let activePhysicalCode: string | null = null;
    let activeKeyIdentity: string | null = null;

    const releaseAllButtons = () => {
      pressedSlots.clear();
      activePhysicalCode = null;
      activeKeyIdentity = null;
      setActiveSlot(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        keyConfig === null ||
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const slot = mapKeyboardEventToSlot(keyConfig, event);
      if (slot === null) return;
      event.preventDefault();

      if (event.repeat || pressedSlots.size > 0) return;

      const now = performance.now();
      const previousAcceptedAt = lastAcceptedAt.get(slot);
      if (
        previousAcceptedAt !== undefined &&
        now - previousAcceptedAt < keyConfig.debounceMs
      ) {
        return;
      }

      pressedSlots.add(slot);
      lastAcceptedAt.set(slot, now);
      activePhysicalCode =
        event.code.length > 0 && event.code !== "Unidentified" ? event.code : null;
      activeKeyIdentity = getKeyboardKeyIdentity(event.key);
      setActiveSlot(slot);
      handlerRef.current?.(slot);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (keyConfig === null || pressedSlots.size !== 1) return;
      const isSamePhysicalPress = activePhysicalCode !== null
        ? event.code === activePhysicalCode
        : activeKeyIdentity !== null && getKeyboardKeyIdentity(event.key) === activeKeyIdentity;
      if (!isSamePhysicalPress) return;
      const slot = pressedSlots.values().next().value;
      if (slot === undefined) return;

      pressedSlots.delete(slot);
      activePhysicalCode = null;
      activeKeyIdentity = null;
      setActiveSlot((current) => {
        if (current !== slot) return current;
        return Array.from(pressedSlots).at(-1) ?? null;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseAllButtons);
    document.addEventListener("visibilitychange", releaseAllButtons);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseAllButtons);
      document.removeEventListener("visibilitychange", releaseAllButtons);
      pressedSlots.clear();
      lastAcceptedAt.clear();
      activePhysicalCode = null;
      activeKeyIdentity = null;
    };
  }, [resolved]);

  const value = useMemo<FourButtonContextValue>(
    () => ({
      activeSlot,
      configReady: resolved.parsed !== null,
      error: resolved.error,
      registerHandler,
    }),
    [activeSlot, registerHandler, resolved.error, resolved.parsed],
  );

  return (
    <FourButtonContext.Provider value={value}>
      {children}
    </FourButtonContext.Provider>
  );
}
