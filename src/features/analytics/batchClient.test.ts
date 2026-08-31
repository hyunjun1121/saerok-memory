import {
  TelemetryBatchClient,
  TelemetryTransportError,
  createFetchTelemetryTransport,
} from "@/features/analytics/batchClient";
import { MemoryOutboxStore, TelemetryOutbox } from "@/features/analytics/outbox";
import { createTelemetryEnvelope, type TelemetryEnvelope } from "@/features/analytics/types";

function makeEvent(sequence: number): TelemetryEnvelope<"app_opened"> {
  return createTelemetryEnvelope(
    {
      eventId: `evt_jp_${sequence.toString(16).padStart(32, "0")}`,
      occurredAt: new Date(sequence * 1_000).toISOString(),
      sequence,
      market: "jp",
      locale: "ja-JP",
      appVersion: "1.0.0",
      contentPackVersion: "jp-2026.08.1",
      installationId: "inst_jp_00112233445566778899aabbccddeeff",
      visitId: "visit_00112233445566778899aabbccddeeff",
      routeId: "/lesson",
      consentRevision: "2026-08-01",
    },
    { eventName: "app_opened", payload: { launchKind: "fresh", online: true } },
  );
}

describe("telemetry batch client", () => {
  it("never sends more than 50 events in one request", async () => {
    const outbox = new TelemetryOutbox(new MemoryOutboxStore(), { now: () => 100_000 });
    for (let sequence = 1; sequence <= 55; sequence += 1) {
      await outbox.enqueue(makeEvent(sequence));
    }
    const send = vi.fn(async (events: readonly TelemetryEnvelope[]) => ({
      acceptedEventIds: events.map(({ eventId }) => eventId),
    }));
    const client = new TelemetryBatchClient(outbox, { send });

    await expect(client.flush()).resolves.toMatchObject({ status: "sent", sentCount: 50 });
    expect(send.mock.calls[0][0]).toHaveLength(50);
    expect(await outbox.count()).toBe(5);
  });

  it("acknowledges accepted/rejected records and retries unmentioned records", async () => {
    const outbox = new TelemetryOutbox(new MemoryOutboxStore(), {
      now: () => 10_000,
      retryDelay: () => 1_000,
    });
    const events = [makeEvent(1), makeEvent(2), makeEvent(3)];
    for (const event of events) await outbox.enqueue(event);

    const client = new TelemetryBatchClient(outbox, {
      send: async () => ({
        acceptedEventIds: [events[0].eventId],
        rejectedEventIds: [events[1].eventId],
      }),
    });

    await expect(client.flush()).resolves.toEqual({
      status: "retry_scheduled",
      sentCount: 1,
      rejectedCount: 1,
      retryCount: 1,
    });
    expect(await outbox.count()).toBe(1);
  });

  it("exposes retryable and permanent transport failures", async () => {
    const retryOutbox = new TelemetryOutbox(new MemoryOutboxStore(), {
      now: () => 10_000,
      retryDelay: () => 1_000,
    });
    await retryOutbox.enqueue(makeEvent(1));
    const retryClient = new TelemetryBatchClient(retryOutbox, {
      send: async () => {
        throw new TelemetryTransportError("offline", { retryable: true, status: 503 });
      },
    });
    await expect(retryClient.flush()).resolves.toMatchObject({
      status: "retry_scheduled",
      retryCount: 1,
    });
    expect(await retryOutbox.count()).toBe(1);

    const permanentOutbox = new TelemetryOutbox(new MemoryOutboxStore(), { now: () => 10_000 });
    await permanentOutbox.enqueue(makeEvent(2));
    const permanentClient = new TelemetryBatchClient(permanentOutbox, {
      send: async () => {
        throw new TelemetryTransportError("invalid", { retryable: false, status: 400 });
      },
    });
    await expect(permanentClient.flush()).resolves.toMatchObject({
      status: "failed_permanent",
      rejectedCount: 1,
    });
    expect(await permanentOutbox.count()).toBe(0);
  });

  it("posts a same-origin versioned batch without reading error bodies", async () => {
    const event = makeEvent(1);
    const fetchImplementation = vi.fn(async () =>
      new Response(JSON.stringify({ acceptedEventIds: [event.eventId] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const transport = createFetchTelemetryTransport(
      "/api/telemetry/v1/batches",
      fetchImplementation as typeof fetch,
    );

    await expect(transport.send([event])).resolves.toEqual({
      acceptedEventIds: [event.eventId],
      rejectedEventIds: undefined,
      retryEventIds: undefined,
    });
    expect(fetchImplementation).toHaveBeenCalledWith(
      "/api/telemetry/v1/batches",
      expect.objectContaining({ method: "POST", credentials: "same-origin", keepalive: true }),
    );
    const fetchCalls = fetchImplementation.mock.calls as unknown as Array<
      [RequestInfo | URL, RequestInit]
    >;
    const request = fetchCalls[0][1];
    const wire = JSON.parse(String(request.body)) as {
      schemaVersion: string;
      events: Array<Record<string, unknown>>;
    };
    expect(wire.schemaVersion).toBe("1.0");
    expect(wire.events[0]).not.toHaveProperty("market");
    expect(wire.events[0]).not.toHaveProperty("locale");
    expect(wire.events[0]).toMatchObject({ eventId: event.eventId });
  });
});
