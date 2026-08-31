import {
  getMarketConfig,
  getMarketStorageKey,
  type MarketCode,
} from "@/config/market";
import { removeKey, writeJson } from "@/utils/safeStorage";

export interface HaruEnrollment {
  participantId: string;
  market: MarketCode;
  locale: "ko-KR" | "ja-JP";
  enrolledAt: string;
}

export type HaruEnrollmentResult =
  | ({ status: "enrolled" } & HaruEnrollment)
  | {
      status:
        | "invalid_code"
        | "rejected"
        | "unavailable"
        | "market_mismatch"
        | "invalid_response"
        | "storage_failed";
    };

export interface RedeemHaruParticipantCodeOptions {
  market: MarketCode;
  installationId: string;
  consentRevision: string;
  fetchImplementation?: typeof fetch;
  now?: Date;
}

const PARTICIPANT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CODE_PATTERN = /^[A-Z2-9]{8}$/u;

function storageKey(market: MarketCode): string {
  return getMarketStorageKey("enrollment", market);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEnrollment(value: unknown, expectedMarket: MarketCode): HaruEnrollment | null {
  if (!isRecord(value)) return null;
  const expectedLocale = getMarketConfig(expectedMarket).locale;
  if (
    typeof value.participantId !== "string" ||
    !PARTICIPANT_ID_PATTERN.test(value.participantId) ||
    value.market !== expectedMarket ||
    value.locale !== expectedLocale ||
    typeof value.enrolledAt !== "string" ||
    !Number.isFinite(Date.parse(value.enrolledAt))
  ) {
    return null;
  }
  return {
    participantId: value.participantId,
    market: expectedMarket,
    locale: expectedLocale,
    enrolledAt: value.enrolledAt,
  };
}

export function getHaruEnrollment(market: MarketCode): HaruEnrollment | null {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey(market));
    return raw ? parseEnrollment(JSON.parse(raw) as unknown, market) : null;
  } catch {
    return null;
  }
}

export function clearHaruEnrollment(market: MarketCode): boolean {
  return removeKey(storageKey(market));
}

export async function redeemHaruParticipantCode(
  rawCode: string,
  options: RedeemHaruParticipantCodeOptions,
): Promise<HaruEnrollmentResult> {
  const code = rawCode.trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) return { status: "invalid_code" };
  if (!new RegExp(`^inst_${options.market}_[a-f0-9]{32}$`, "u").test(options.installationId)) {
    return { status: "invalid_response" };
  }

  const fetchImplementation = options.fetchImplementation ?? fetch;
  let response: Response;
  try {
    response = await fetchImplementation("/api/enrollment/v1/redeem", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code,
        installationId: options.installationId,
        consentRevision: options.consentRevision,
      }),
    });
  } catch {
    return { status: "unavailable" };
  }
  if (!response.ok) {
    return { status: response.status >= 500 ? "unavailable" : "rejected" };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { status: "invalid_response" };
  }
  if (!isRecord(payload)) return { status: "invalid_response" };

  const expected = getMarketConfig(options.market);
  if (payload.market !== options.market || payload.locale !== expected.locale) {
    return { status: "market_mismatch" };
  }
  if (
    typeof payload.participantId !== "string" ||
    !PARTICIPANT_ID_PATTERN.test(payload.participantId)
  ) {
    return { status: "invalid_response" };
  }

  const enrollment: HaruEnrollment = {
    participantId: payload.participantId,
    market: options.market,
    locale: expected.locale,
    enrolledAt: (options.now ?? new Date()).toISOString(),
  };
  if (!writeJson(storageKey(options.market), enrollment)) {
    return { status: "storage_failed" };
  }
  if (!getHaruEnrollment(options.market)) return { status: "storage_failed" };
  return { status: "enrolled", ...enrollment };
}
