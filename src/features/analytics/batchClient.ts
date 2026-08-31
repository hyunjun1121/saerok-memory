import {
  TELEMETRY_BATCH_MAX_BYTES,
  TELEMETRY_BATCH_MAX_EVENTS,
  type TelemetryOutbox,
} from "@/features/analytics/outbox";
import type { TelemetryEnvelope } from "@/features/analytics/types";

export interface TelemetryBatchTransportResult {
  acceptedEventIds: readonly string[];
  rejectedEventIds?: readonly string[];
  retryEventIds?: readonly string[];
}

export interface TelemetryBatchTransport {
  send(
    events: readonly TelemetryEnvelope[],
    signal?: AbortSignal,
  ): Promise<TelemetryBatchTransportResult>;
}

export type TelemetryFlushResult =
  | { status: "empty"; sentCount: 0; rejectedCount: 0; retryCount: 0 }
  | { status: "sent"; sentCount: number; rejectedCount: number; retryCount: 0 }
  | {
      status: "retry_scheduled";
      sentCount: number;
      rejectedCount: number;
      retryCount: number;
    }
  | {
      status: "failed_permanent";
      sentCount: 0;
      rejectedCount: number;
      retryCount: 0;
    };

export class TelemetryTransportError extends Error {
  readonly retryable: boolean;
  readonly status?: number;

  constructor(message: string, options: { retryable: boolean; status?: number }) {
    super(message);
    this.name = "TelemetryTransportError";
    this.retryable = options.retryable;
    this.status = options.status;
  }
}

function transportErrorCode(error: unknown): string {
  if (error instanceof TelemetryTransportError && error.status !== undefined) {
    return `http_${error.status}`;
  }
  return error instanceof DOMException && error.name === "AbortError"
    ? "request_aborted"
    : "network_error";
}

function isRetryable(error: unknown): boolean {
  return !(error instanceof TelemetryTransportError) || error.retryable;
}

export class TelemetryBatchClient {
  private activeFlush?: Promise<TelemetryFlushResult>;
  private readonly outbox: TelemetryOutbox;
  private readonly transport: TelemetryBatchTransport;

  constructor(
    outbox: TelemetryOutbox,
    transport: TelemetryBatchTransport,
  ) {
    this.outbox = outbox;
    this.transport = transport;
  }

  flush(options: { signal?: AbortSignal } = {}): Promise<TelemetryFlushResult> {
    if (this.activeFlush) return this.activeFlush;
    this.activeFlush = this.performFlush(options.signal).finally(() => {
      this.activeFlush = undefined;
    });
    return this.activeFlush;
  }

  private async performFlush(signal?: AbortSignal): Promise<TelemetryFlushResult> {
    const records = await this.outbox.peekBatch({
      maxEvents: TELEMETRY_BATCH_MAX_EVENTS,
      maxBytes: TELEMETRY_BATCH_MAX_BYTES,
    });
    if (records.length === 0) {
      return { status: "empty", sentCount: 0, rejectedCount: 0, retryCount: 0 };
    }

    const events = records.map(({ event }) => event);
    const batchIds = new Set(records.map(({ eventId }) => eventId));
    try {
      const response = await this.transport.send(events, signal);
      const acceptedIds = new Set(response.acceptedEventIds.filter((id) => batchIds.has(id)));
      const rejectedIds = new Set(
        (response.rejectedEventIds ?? []).filter(
          (id) => batchIds.has(id) && !acceptedIds.has(id),
        ),
      );
      const retryIds = new Set(
        (response.retryEventIds ?? []).filter(
          (id) => batchIds.has(id) && !acceptedIds.has(id) && !rejectedIds.has(id),
        ),
      );
      for (const eventId of batchIds) {
        if (!acceptedIds.has(eventId) && !rejectedIds.has(eventId)) retryIds.add(eventId);
      }

      await this.outbox.acknowledge([...acceptedIds, ...rejectedIds]);
      if (retryIds.size > 0) await this.outbox.markRetry([...retryIds], "partial_batch_retry");

      if (retryIds.size > 0) {
        return {
          status: "retry_scheduled",
          sentCount: acceptedIds.size,
          rejectedCount: rejectedIds.size,
          retryCount: retryIds.size,
        };
      }
      return {
        status: "sent",
        sentCount: acceptedIds.size,
        rejectedCount: rejectedIds.size,
        retryCount: 0,
      };
    } catch (error) {
      const eventIds = records.map(({ eventId }) => eventId);
      if (isRetryable(error)) {
        await this.outbox.markRetry(eventIds, transportErrorCode(error));
        return {
          status: "retry_scheduled",
          sentCount: 0,
          rejectedCount: 0,
          retryCount: eventIds.length,
        };
      }

      await this.outbox.discard(eventIds);
      return {
        status: "failed_permanent",
        sentCount: 0,
        rejectedCount: eventIds.length,
        retryCount: 0,
      };
    }
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseTransportResponse(value: unknown): TelemetryBatchTransportResult {
  if (typeof value !== "object" || value === null) {
    throw new TelemetryTransportError("Invalid telemetry response", { retryable: true });
  }
  const response = value as Record<string, unknown>;
  if (!isStringArray(response.acceptedEventIds)) {
    throw new TelemetryTransportError("Invalid telemetry response", { retryable: true });
  }
  if (response.rejectedEventIds !== undefined && !isStringArray(response.rejectedEventIds)) {
    throw new TelemetryTransportError("Invalid telemetry response", { retryable: true });
  }
  if (response.retryEventIds !== undefined && !isStringArray(response.retryEventIds)) {
    throw new TelemetryTransportError("Invalid telemetry response", { retryable: true });
  }
  return {
    acceptedEventIds: response.acceptedEventIds,
    rejectedEventIds: response.rejectedEventIds as string[] | undefined,
    retryEventIds: response.retryEventIds as string[] | undefined,
  };
}

export function createFetchTelemetryTransport(
  endpoint = "/api/telemetry/v1/batches",
  fetchImplementation: typeof fetch = fetch,
): TelemetryBatchTransport {
  return {
    async send(events, signal) {
      const wireEvents = events.map((event) => {
        const wireEvent = { ...event } as Record<string, unknown>;
        // Deployment owns country routing. Client overrides are rejected so a
        // Japanese build can never write into the Korean data plane, or vice versa.
        delete wireEvent.market;
        delete wireEvent.locale;
        return wireEvent;
      });
      const response = await fetchImplementation(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schemaVersion: "1.0", events: wireEvents }),
        keepalive: true,
        signal,
      });
      if (!response.ok) {
        throw new TelemetryTransportError("Telemetry request failed", {
          retryable: response.status === 408 || response.status === 429 || response.status >= 500,
          status: response.status,
        });
      }
      return parseTransportResponse(await response.json());
    },
  };
}
