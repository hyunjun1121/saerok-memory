import type { MarketConfig } from "@/config/market";
import {
  TelemetryBatchClient,
  type TelemetryFlushResult,
} from "@/features/analytics/batchClient";
import {
  createEventId as createRandomEventId,
  createVisitId,
  getOrCreateInstallationId,
} from "@/features/analytics/identity";
import {
  createTelemetryOutbox,
  type TelemetryOutbox,
} from "@/features/analytics/outbox";
import {
  createTelemetryEnvelope,
  getTelemetryDataClass,
  type TelemetryEnvelope,
  type TelemetryEventName,
  type TelemetryPayloadMap,
} from "@/features/analytics/types";
import type { HaruConsentState } from "@/features/profile/haruConsentStorage";
import { getHaruConsentRevision } from "@/features/profile/haruConsentStorage";

export interface TelemetryCaptureContext {
  routeId?: string;
  routineSessionId?: string;
  questionInstanceId?: string;
}

export interface HaruTelemetryRuntimeOptions {
  config: MarketConfig;
  getConsent: () => HaruConsentState;
  outbox?: TelemetryOutbox;
  batchClient?: TelemetryBatchClient;
  now?: () => Date;
  getRoute?: () => string;
  installationId?: string;
  visitId?: string;
  createEventId?: () => string;
  appVersion?: string;
}

function safeVersion(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(normalized)
    ? normalized
    : fallback;
}

function routeWithoutPrivateData(route: string): string {
  const path = route.split(/[?#]/u, 1)[0] || "/";
  return /^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]{0,255}$/u.test(path) ? path : "/";
}

export class HaruTelemetryRuntime {
  private readonly config: MarketConfig;
  private readonly getConsent: () => HaruConsentState;
  private readonly outbox: TelemetryOutbox;
  private readonly batchClient?: TelemetryBatchClient;
  private readonly now: () => Date;
  private readonly getRoute: () => string;
  private readonly installationId: string;
  private readonly visitId: string;
  private readonly nextEventId: () => string;
  private readonly appVersion: string;
  private sequence = 0;

  constructor(options: HaruTelemetryRuntimeOptions) {
    this.config = options.config;
    this.getConsent = options.getConsent;
    this.outbox = options.outbox ?? createTelemetryOutbox();
    this.batchClient = options.batchClient;
    this.now = options.now ?? (() => new Date());
    this.getRoute = options.getRoute ?? (() => globalThis.location?.pathname ?? "/");
    this.installationId =
      options.installationId ?? getOrCreateInstallationId(options.config.market);
    this.visitId = options.visitId ?? createVisitId();
    this.nextEventId =
      options.createEventId ?? (() => createRandomEventId(options.config.market));
    this.appVersion = safeVersion(
      options.appVersion ?? import.meta.env.VITE_APP_VERSION,
      "local",
    );
  }

  async capture<Name extends TelemetryEventName>(
    eventName: Name,
    payload: TelemetryPayloadMap[Name],
    context: TelemetryCaptureContext = {},
  ): Promise<boolean> {
    const consent = this.getConsent();
    if (!consent.usageAnalytics) return false;
    if (
      getTelemetryDataClass(eventName) === "activity" &&
      !consent.longitudinalUsageStorage
    ) {
      return false;
    }

    const event = createTelemetryEnvelope(
      {
        eventId: this.nextEventId(),
        occurredAt: this.now().toISOString(),
        sequence: (this.sequence += 1),
        market: this.config.market,
        locale: this.config.locale,
        appVersion: this.appVersion,
        contentPackVersion: this.config.contentPackVersion,
        installationId: this.installationId,
        visitId: this.visitId,
        ...(context.routineSessionId
          ? { routineSessionId: context.routineSessionId }
          : {}),
        ...(context.questionInstanceId
          ? { questionInstanceId: context.questionInstanceId }
          : {}),
        routeId: routeWithoutPrivateData(context.routeId ?? this.getRoute()),
        consentRevision: getHaruConsentRevision(consent),
      },
      { eventName, payload } as never,
    ) as TelemetryEnvelope<Name>;

    await this.outbox.enqueue(event);
    return true;
  }

  async flush(): Promise<TelemetryFlushResult> {
    if (!this.getConsent().usageAnalytics || !this.batchClient) {
      return { status: "empty", sentCount: 0, rejectedCount: 0, retryCount: 0 };
    }
    return this.batchClient.flush();
  }

  async handleConsentChanged(): Promise<void> {
    if (!this.getConsent().usageAnalytics) await this.outbox.clear();
  }

  listPendingEvents(): Promise<TelemetryEnvelope[]> {
    return this.outbox.listEvents();
  }

  clear(): Promise<void> {
    return this.outbox.clear();
  }
}
