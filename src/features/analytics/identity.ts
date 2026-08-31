import type { TelemetryMarket } from "@/features/analytics/types";

export interface RandomIdentitySource {
  randomUUID?: () => string;
  getRandomValues?: (buffer: Uint8Array) => Uint8Array;
}

export interface IdentityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const INSTALLATION_ID_PATTERN = /^inst_(kr|jp)_[a-f0-9]{32}$/;

function defaultRandomSource(): RandomIdentitySource {
  const source = globalThis.crypto;
  if (!source) return {};
  return {
    randomUUID:
      typeof source.randomUUID === "function" ? () => source.randomUUID() : undefined,
    getRandomValues:
      typeof source.getRandomValues === "function"
        ? (buffer) => source.getRandomValues(buffer)
        : undefined,
  };
}

function randomHex(source: RandomIdentitySource): string {
  if (source.randomUUID) {
    const uuidHex = source.randomUUID().replace(/-/g, "").toLowerCase();
    if (/^[a-f0-9]{32}$/.test(uuidHex)) return uuidHex;
  }

  if (source.getRandomValues) {
    const bytes = source.getRandomValues(new Uint8Array(16));
    if (bytes.byteLength === 16) {
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
  }

  throw new Error("Secure random identity source is unavailable");
}

function resolveStorage(storage?: IdentityStorage): IdentityStorage | undefined {
  if (storage) return storage;
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

export function createRandomIdentity(
  prefix: string,
  randomSource: RandomIdentitySource = defaultRandomSource(),
): string {
  if (!/^[a-z][a-z0-9_]{0,31}$/.test(prefix)) {
    throw new Error("Identity prefix must be a stable lowercase token");
  }
  return `${prefix}_${randomHex(randomSource)}`;
}

export function getOrCreateInstallationId(
  market: TelemetryMarket,
  options: { storage?: IdentityStorage; randomSource?: RandomIdentitySource } = {},
): string {
  const storageKey = `haru:analytics:${market}:installation-id`;
  const storage = resolveStorage(options.storage);

  try {
    const saved = storage?.getItem(storageKey);
    if (saved && INSTALLATION_ID_PATTERN.test(saved) && saved.startsWith(`inst_${market}_`)) {
      return saved;
    }
  } catch {
    // Continue with an ephemeral cryptographically random identifier.
  }

  const created = createRandomIdentity(`inst_${market}`, options.randomSource ?? defaultRandomSource());
  try {
    storage?.setItem(storageKey, created);
  } catch {
    // Storage can be disabled; current page may still use the ephemeral identifier.
  }
  return created;
}

export function createVisitId(randomSource: RandomIdentitySource = defaultRandomSource()): string {
  return createRandomIdentity("visit", randomSource);
}

export function createEventId(
  market: TelemetryMarket,
  randomSource: RandomIdentitySource = defaultRandomSource(),
): string {
  return createRandomIdentity(`evt_${market}`, randomSource);
}

export function createRoutineSessionId(
  randomSource: RandomIdentitySource = defaultRandomSource(),
): string {
  return createRandomIdentity("routine", randomSource);
}
