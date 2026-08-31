import {
  TelemetryOutbox,
  MemoryOutboxStore,
  createTelemetryOutbox,
  getTelemetryRetryDelayMs,
} from "@/features/analytics/outbox";
import { createTelemetryEnvelope, type TelemetryEnvelope } from "@/features/analytics/types";

function makeEvent(sequence: number): TelemetryEnvelope<"app_opened"> {
  return createTelemetryEnvelope(
    {
      eventId: `evt_kr_${sequence.toString(16).padStart(32, "0")}`,
      occurredAt: new Date(sequence * 1_000).toISOString(),
      sequence,
      market: "kr",
      locale: "ko-KR",
      appVersion: "1.0.0",
      contentPackVersion: "kr-2026.08.1",
      installationId: "inst_kr_00112233445566778899aabbccddeeff",
      visitId: "visit_00112233445566778899aabbccddeeff",
      routeId: "/lesson",
      consentRevision: "2026-08-01",
    },
    { eventName: "app_opened", payload: { launchKind: "returning", online: true } },
  );
}

describe("telemetry outbox", () => {
  it("keeps the newest records within retention and count limits", async () => {
    let now = 0;
    const outbox = new TelemetryOutbox(new MemoryOutboxStore(), {
      maxCount: 3,
      maxRetentionMs: 100,
      now: () => now,
    });

    for (let sequence = 1; sequence <= 4; sequence += 1) {
      now = sequence * 10;
      await outbox.enqueue(makeEvent(sequence));
    }
    expect((await outbox.peekBatch()).map(({ event }) => event.sequence)).toEqual([2, 3, 4]);

    now = 131;
    await outbox.prune();
    expect((await outbox.peekBatch()).map(({ event }) => event.sequence)).toEqual([4]);
  });

  it("honors event and byte batch limits", async () => {
    const outbox = new TelemetryOutbox(new MemoryOutboxStore(), { now: () => 1_000 });
    for (let sequence = 1; sequence <= 55; sequence += 1) {
      await outbox.enqueue(makeEvent(sequence));
    }

    expect(await outbox.peekBatch({ maxEvents: 50 })).toHaveLength(50);
    expect(await outbox.peekBatch({ maxBytes: 900 })).toHaveLength(1);
  });

  it("schedules retries, acknowledges success, and supports memory fallback", async () => {
    let now = 1_000;
    const outbox = new TelemetryOutbox(new MemoryOutboxStore(), {
      now: () => now,
      retryDelay: () => 500,
    });
    const first = makeEvent(1);
    const second = makeEvent(2);
    await outbox.enqueue(first);
    await outbox.enqueue(second);

    await outbox.markRetry([first.eventId], "network");
    expect((await outbox.peekBatch()).map(({ event }) => event.eventId)).toEqual([second.eventId]);

    await outbox.acknowledge([second.eventId]);
    expect(await outbox.count()).toBe(1);

    now = 1_500;
    const retried = await outbox.peekBatch();
    expect(retried[0]).toMatchObject({ attempts: 1, lastErrorCode: "network" });
  });

  it("rejects an event that fails the privacy allowlist", async () => {
    const outbox = new TelemetryOutbox(new MemoryOutboxStore());
    const unsafe = {
      ...makeEvent(1),
      payload: { launchKind: "fresh", online: true, transcript: "private" },
    };

    await expect(outbox.enqueue(unsafe as never)).rejects.toThrow("privacy");
    expect(await outbox.count()).toBe(0);
  });

  it("uses the explicit memory fallback and provides bounded exponential backoff", async () => {
    const outbox = createTelemetryOutbox({ indexedDb: null, now: () => 1_000 });
    await outbox.enqueue(makeEvent(1));
    expect(await outbox.count()).toBe(1);

    expect(
      getTelemetryRetryDelayMs(1, { jitterRatio: 0, baseMs: 1_000, maxMs: 5_000 }),
    ).toBe(1_000);
    expect(
      getTelemetryRetryDelayMs(10, { jitterRatio: 0, baseMs: 1_000, maxMs: 5_000 }),
    ).toBe(5_000);
  });

  it("returns a privacy-safe snapshot for user export without retry metadata", async () => {
    const outbox = new TelemetryOutbox(new MemoryOutboxStore(), { now: () => 1_000 });
    await outbox.enqueue(makeEvent(2));
    await outbox.enqueue(makeEvent(1));

    const snapshot = await outbox.listEvents();

    expect(snapshot.map((event) => event.sequence)).toEqual([1, 2]);
    expect(snapshot[0]).not.toHaveProperty("attempts");
    snapshot.pop();
    expect(await outbox.count()).toBe(2);
  });
});
