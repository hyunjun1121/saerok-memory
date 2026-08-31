import { getMarketStorageKey, type MarketCode } from "@/config/market";
import { readJson, removeKey, writeJson } from "@/utils/safeStorage";

export interface PendingHaruRemoteDeletion {
  requestId: string;
  market: MarketCode;
  requestedAt: string;
}

const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function storageKey(market: MarketCode): string {
  return getMarketStorageKey("privacy:deletion-request", market);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parsePendingDeletion(
  value: unknown,
  market: MarketCode,
): PendingHaruRemoteDeletion | null {
  if (
    !isRecord(value) ||
    value.market !== market ||
    typeof value.requestId !== "string" ||
    !REQUEST_ID_PATTERN.test(value.requestId) ||
    typeof value.requestedAt !== "string" ||
    !Number.isFinite(Date.parse(value.requestedAt))
  ) {
    return null;
  }
  return {
    requestId: value.requestId,
    market,
    requestedAt: value.requestedAt,
  };
}

export function getPendingHaruRemoteDeletion(
  market: MarketCode,
): PendingHaruRemoteDeletion | null {
  return parsePendingDeletion(
    readJson<unknown>(storageKey(market), null),
    market,
  );
}

export function savePendingHaruRemoteDeletion(
  pending: PendingHaruRemoteDeletion,
): boolean {
  const normalized = parsePendingDeletion(pending, pending.market);
  return normalized ? writeJson(storageKey(pending.market), normalized) : false;
}

export function clearPendingHaruRemoteDeletion(market: MarketCode): boolean {
  return removeKey(storageKey(market));
}
