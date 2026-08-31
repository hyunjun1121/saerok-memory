import { getRuntimeMarketConfig, getMarketStorageKey } from "@/config/market";
import {
  TelemetryBatchClient,
  createFetchTelemetryTransport,
} from "@/features/analytics/batchClient";
import {
  createRandomIdentity,
  createRoutineSessionId,
} from "@/features/analytics/identity";
import { HaruLessonTelemetryTracker } from "@/features/analytics/lessonTracker";
import { createTelemetryOutbox } from "@/features/analytics/outbox";
import {
  HaruTelemetryRuntime,
  type TelemetryCaptureContext,
} from "@/features/analytics/runtime";
import type {
  TelemetryEnvelope,
  TelemetryEventName,
  TelemetryPayloadMap,
} from "@/features/analytics/types";
import {
  submitHaruActivitySession,
  submitHaruQuestionAttempt,
} from "@/features/profile/haruDataApi";
import {
  getHaruConsent,
  getHaruConsentRevision,
  subscribeToHaruConsent,
} from "@/features/profile/haruConsentStorage";

const FLUSH_INTERVAL_MS = 15_000;

let runtime: HaruTelemetryRuntime | null | undefined;
let listenerCleanup: (() => void) | undefined;
let telemetryStarted = false;
let lastRoute: string | undefined;

function getRuntime(): HaruTelemetryRuntime | null {
  if (runtime !== undefined) return runtime;
  try {
    const config = getRuntimeMarketConfig();
    const outbox = createTelemetryOutbox({
      databaseName: `haru-telemetry-${config.market}`,
    });
    runtime = new HaruTelemetryRuntime({
      config,
      getConsent: getHaruConsent,
      outbox,
      batchClient: new TelemetryBatchClient(
        outbox,
        createFetchTelemetryTransport(),
      ),
    });
  } catch {
    runtime = null;
  }
  return runtime;
}

function runQuietly(operation: Promise<unknown>): void {
  void operation.catch(() => undefined);
}

export function hashTelemetryContent(...codedParts: readonly string[]): string {
  let hash = 0x811c9dc5;
  for (const character of codedParts.join("\u001f")) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a-${hash.toString(16).padStart(8, "0")}`;
}

export interface HaruNavigationTimingSource {
  getEntriesByType(type: string): readonly PerformanceEntry[];
}

export function getHaruNavigationRenderLatency(
  source: HaruNavigationTimingSource | undefined = globalThis.performance,
): number | null {
  if (!source) return null;
  const entry = source.getEntriesByType("navigation")[0] as
    | (PerformanceEntry & { domContentLoadedEventEnd?: number })
    | undefined;
  if (!entry || typeof entry.domContentLoadedEventEnd !== "number") return null;
  const latency = entry.domContentLoadedEventEnd - entry.startTime;
  if (!Number.isFinite(latency) || latency < 0) return null;
  return Math.min(600_000, Math.round(latency));
}

export function captureHaruTelemetry<Name extends TelemetryEventName>(
  eventName: Name,
  payload: TelemetryPayloadMap[Name],
  context?: TelemetryCaptureContext,
): Promise<boolean> {
  const current = getRuntime();
  return current ? current.capture(eventName, payload, context) : Promise.resolve(false);
}

export function flushHaruTelemetry(): Promise<unknown> {
  return getRuntime()?.flush() ?? Promise.resolve(undefined);
}

export function clearHaruTelemetry(): Promise<void> {
  return getRuntime()?.clear() ?? Promise.resolve();
}

export function getPendingHaruTelemetryEvents(): Promise<TelemetryEnvelope[]> {
  return getRuntime()?.listPendingEvents() ?? Promise.resolve([]);
}

export function createHaruLessonTelemetryTracker(): HaruLessonTelemetryTracker | null {
  if (!getRuntime()) return null;
  const config = getRuntimeMarketConfig();
  return new HaruLessonTelemetryTracker({
    nowMs: Date.now,
    createRoutineSessionId,
    createQuestionInstanceId: () => createRandomIdentity("question"),
    capture: captureHaruTelemetry,
    submitSession: (input) =>
      submitHaruActivitySession(input, { market: config.market }),
    submitAttempt: (input) =>
      submitHaruQuestionAttempt(input, { market: config.market }),
    contentPackVersion: config.contentPackVersion,
    consentRevision: () => getHaruConsentRevision(getHaruConsent()),
    canStoreActivity: () => getHaruConsent().longitudinalUsageStorage,
  });
}

export function recordHaruRouteView(route: string): void {
  const normalized = route.split(/[?#]/u, 1)[0] || "/";
  if (normalized === lastRoute) return;
  const navigationKind = lastRoute === undefined ? "initial" : "push";
  lastRoute = normalized;
  runQuietly(
    captureHaruTelemetry(
      "route_viewed",
      { navigationKind },
      { routeId: normalized },
    ),
  );
}

export function startHaruTelemetry(): () => void {
  if (telemetryStarted || typeof window === "undefined") {
    return () => undefined;
  }
  telemetryStarted = true;
  const config = getRuntimeMarketConfig();
  const launchKey = getMarketStorageKey("analytics:launched", config.market);
  let launchKind: "fresh" | "returning" = "fresh";
  try {
    launchKind = localStorage.getItem(launchKey) === "1" ? "returning" : "fresh";
    localStorage.setItem(launchKey, "1");
  } catch {
    // Storage can be unavailable; launch remains an anonymous fresh visit.
  }
  runQuietly(
    captureHaruTelemetry("app_opened", {
      launchKind,
      online: navigator.onLine,
    }),
  );

  let performanceCaptured = false;
  let disposed = false;
  const captureNavigationPerformance = () => {
    if (performanceCaptured || disposed) return;
    performanceCaptured = true;
    const value = getHaruNavigationRenderLatency();
    if (value !== null) {
      runQuietly(
        captureHaruTelemetry("performance_measured", {
          metric: "render_latency",
          value,
        }),
      );
    }
  };
  if (document.readyState === "complete") {
    queueMicrotask(captureNavigationPerformance);
  } else {
    window.addEventListener("load", captureNavigationPerformance, { once: true });
  }

  const onVisibility = () => {
    runQuietly(
      captureHaruTelemetry("app_visibility_changed", {
        visibility: document.visibilityState === "hidden" ? "hidden" : "visible",
      }),
    );
  };
  const onOnline = () => {
    runQuietly(captureHaruTelemetry("network_changed", { state: "online" }));
    runQuietly(flushHaruTelemetry());
  };
  const onOffline = () => {
    runQuietly(captureHaruTelemetry("network_changed", { state: "offline" }));
  };
  const onPageHide = () => {
    runQuietly(flushHaruTelemetry());
  };
  const onError = () => {
    runQuietly(
      captureHaruTelemetry("client_error", {
        source: "window",
        code: "runtime_error",
        recoverable: true,
      }),
    );
  };

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onError);
  const interval = window.setInterval(() => runQuietly(flushHaruTelemetry()), FLUSH_INTERVAL_MS);
  const unsubscribeConsent = subscribeToHaruConsent(() => {
    const current = getRuntime();
    if (current) runQuietly(current.handleConsentChanged());
  });

  listenerCleanup = () => {
    disposed = true;
    window.removeEventListener("load", captureNavigationPerformance);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onError);
    window.clearInterval(interval);
    unsubscribeConsent();
    telemetryStarted = false;
    listenerCleanup = undefined;
  };
  return listenerCleanup;
}

export function stopHaruTelemetry(): void {
  listenerCleanup?.();
}
