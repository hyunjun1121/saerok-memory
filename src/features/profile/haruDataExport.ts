import { normalizeMarket, type MarketCode } from "@/config/market";
import { getCognitiveRoutineResults } from "@/features/cognitive/cognitiveRoutineStorage";
import { getCaregiverObservationRecords } from "@/features/family/caregiverObservationStorage";
import { getWeeklyRewardState } from "@/features/gamification/weeklyRewards";
import { getHaruAdminUsageRecord } from "@/features/lessons/haruAdminUsageRecordStorage";
import { getHaruDemoSessions } from "@/features/lessons/haruDemoSessionStorage";
import { getMemoryCards } from "@/features/memory/memoryCardStorage";
import { getPendingHaruTelemetryEvents } from "@/features/analytics/client";
import { getHaruConsent } from "@/features/profile/haruConsentStorage";
import type { HaruRemoteDataExport } from "@/features/profile/haruDataApi";
import { getLearnerProfile } from "@/features/profile/learnerProfileStorage";

export interface HaruLocalDataExport {
  schemaVersion: "1.0";
  exportedAt: string;
  market: MarketCode;
  consent: unknown;
  profile: unknown;
  sessions: unknown[];
  activityRecord: unknown;
  cognitiveResults: unknown[];
  memoryCards: unknown[];
  caregiverObservations: unknown[];
  weeklyReward: unknown;
  telemetry: unknown[];
}

function runtimeMarket(): MarketCode {
  return normalizeMarket(import.meta.env.VITE_HARU_MARKET);
}

export function buildHaruLocalDataExport(
  now = new Date(),
  market = runtimeMarket(),
): HaruLocalDataExport {
  return {
    schemaVersion: "1.0",
    exportedAt: now.toISOString(),
    market,
    consent: getHaruConsent(),
    profile: getLearnerProfile(),
    sessions: getHaruDemoSessions(),
    activityRecord: getHaruAdminUsageRecord(),
    cognitiveResults: getCognitiveRoutineResults(),
    memoryCards: getMemoryCards(),
    caregiverObservations: getCaregiverObservationRecords(),
    weeklyReward: getWeeklyRewardState(now),
    // Telemetry outbox is attached by the analytics integration layer. Keep a
    // stable category even when IndexedDB is unavailable or analytics is off.
    telemetry: [],
  };
}

export type HaruTelemetryExportLoader = () => Promise<readonly unknown[]>;

export async function buildHaruLocalDataExportWithTelemetry(
  now = new Date(),
  market = runtimeMarket(),
  loadTelemetry: HaruTelemetryExportLoader = getPendingHaruTelemetryEvents,
): Promise<HaruLocalDataExport> {
  const payload = buildHaruLocalDataExport(now, market);
  const telemetry = await loadTelemetry();

  return {
    ...payload,
    telemetry: [...telemetry],
  };
}

function exportReplacer(_key: string, value: unknown): unknown {
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return {
      omitted: true,
      reason: "binary-audio-is-not-embedded-in-json",
      size: value.size,
      type: value.type || null,
    };
  }
  return value;
}

export function serializeHaruLocalDataExport(value: unknown): string {
  return JSON.stringify(value, exportReplacer, 2);
}

export async function downloadHaruLocalDataExport(
  now = new Date(),
  market = runtimeMarket(),
  loadTelemetry: HaruTelemetryExportLoader = getPendingHaruTelemetryEvents,
): Promise<boolean> {
  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function" ||
    typeof URL.revokeObjectURL !== "function"
  ) {
    return false;
  }

  let objectUrl: string | undefined;
  try {
    const payload = await buildHaruLocalDataExportWithTelemetry(
      now,
      market,
      loadTelemetry,
    );
    const blob = new Blob([serializeHaruLocalDataExport(payload)], {
      type: "application/json;charset=utf-8",
    });
    objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `haru-data-${payload.market}-${now.toISOString().slice(0, 10)}.json`;
    link.click();
    return true;
  } catch {
    return false;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export function downloadHaruRemoteDataExport(
  payload: HaruRemoteDataExport,
): boolean {
  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function" ||
    typeof URL.revokeObjectURL !== "function"
  ) {
    return false;
  }

  let objectUrl: string | undefined;
  try {
    const blob = new Blob([serializeHaruLocalDataExport(payload)], {
      type: "application/json;charset=utf-8",
    });
    objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `haru-server-data-${payload.market}-${payload.generatedAt.slice(0, 10)}.json`;
    link.click();
    return true;
  } catch {
    return false;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
