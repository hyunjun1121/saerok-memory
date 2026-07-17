// Defensive localStorage helpers. Tolerate: missing storage (SSR/private mode),
// invalid JSON, QuotaExceeded, and security exceptions. Callers still own
// domain-level sanitization for their parsed values.

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function readJson<T>(key: string, fallback: T): T {
  if (!hasLocalStorage()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null || raw === undefined) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`safeStorage: failed to parse key "${key}"`, error);
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T): boolean {
  if (!hasLocalStorage()) {
    return false;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    // QuotaExceededError, private mode, disabled storage, etc.
    console.error(`safeStorage: failed to write key "${key}"`, error);
    return false;
  }
}

export function removeKey(key: string): void {
  if (!hasLocalStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.error(`safeStorage: failed to remove key "${key}"`, error);
  }
}

// Read-only JSON parse that never throws. Useful when a caller wants to inspect
// raw storage (e.g. LessonScreen memory cards) without crashing the routine.
export function readJsonArray<T>(key: string): T[] {
  const value = readJson<unknown>(key, []);
  return Array.isArray(value) ? (value as T[]) : [];
}
