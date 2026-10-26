import { useEffect, useLayoutEffect, useRef } from 'react';
import { findHaruChoiceIndex, HARU_CHOICE_KEY_BINDINGS } from '@/features/lessons/haruInputBindings';

export function usePilotButtons(onPress: (index: number) => void, enabled: boolean): void {
  const handler = useRef(onPress);
  const active = useRef(enabled);
  useLayoutEffect(() => { handler.current = onPress; active.current = enabled; }, [onPress, enabled]);
  useEffect(() => {
    const pressed = new Set<string>();
    let lastAccepted = -Infinity;
    const down = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!active.current || event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const index = findHaruChoiceIndex(HARU_CHOICE_KEY_BINDINGS, event);
      if (index < 0) return;
      event.preventDefault();
      if (pressed.size || performance.now() - lastAccepted < 200) return;
      pressed.add(event.code || event.key);
      lastAccepted = performance.now();
      handler.current(index);
    };
    const up = (event: KeyboardEvent) => pressed.delete(event.code || event.key);
    const clear = () => pressed.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, []);
}
