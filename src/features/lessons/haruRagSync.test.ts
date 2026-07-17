import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getHaruAdminUsageRecord,
  startHaruAdminUsageSession,
} from "@/features/lessons/haruAdminUsageRecordStorage";
import {
  enqueueHaruRagUserDeletion,
  enqueueHaruRagRecord,
  flushHaruRagOutbox,
  getHaruRagDeletionOutbox,
  getHaruRagOutbox,
  haruRagContentHash,
} from "@/features/lessons/haruRagSync";

type FetchLike = typeof fetch;

function currentRecord() {
  startHaruAdminUsageSession(1, new Date("2026-07-20T01:00:00.000Z"));
  const record = getHaruAdminUsageRecord();
  if (!record) throw new Error("missing test admin record");
  return record;
}

function okFetch() {
  return vi.fn(async () => ({ ok: true, status: 200 })) as unknown as FetchLike;
}

describe("Haru RAG sync outbox", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  it("posts canonical full JSON with idempotency headers and clears on success", async () => {
    vi.stubEnv("VITE_RAG_API_TOKEN", "local-secret");
    const record = currentRecord();
    const fetchImpl = okFetch();

    expect(getHaruRagOutbox()).toHaveLength(1);
    await flushHaruRagOutbox({ fetchImpl, force: true });

    expect(getHaruRagOutbox()).toHaveLength(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("http://127.0.0.1:8000/api/ingest/json");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual(
      expect.objectContaining({
        "Content-Type": "application/json",
        "Idempotency-Key": `haru-${haruRagContentHash(record)}`,
        "X-Haru-Content-Hash": haruRagContentHash(record),
        Authorization: "Bearer local-secret",
      }),
    );
    expect(JSON.parse(String(init.body))).toEqual(record);
    expect(localStorage.getItem("haruRagSyncOutbox") ?? "").not.toContain("local-secret");
  });

  it("keeps an offline write and retries the same payload later", async () => {
    currentRecord();
    const offline = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as FetchLike;

    await flushHaruRagOutbox({ fetchImpl: offline, force: true, now: () => 1_000 });

    expect(getHaruRagOutbox()).toEqual([
      expect.objectContaining({ attempts: 1, nextAttemptAt: 3_000 }),
    ]);

    const online = okFetch();
    await flushHaruRagOutbox({ fetchImpl: online, force: true, now: () => 3_000 });
    expect(online).toHaveBeenCalledTimes(1);
    expect(getHaruRagOutbox()).toHaveLength(0);
  });

  it("coalesces newer snapshots per dataset/user and hashes canonical key order", () => {
    const first = currentRecord();
    const firstHash = getHaruRagOutbox()[0].contentHash;
    const next = structuredClone(first);
    next.dataset.generated_at = "2026-07-20T10:00:01+09:00";

    enqueueHaruRagRecord(next, new Date("2026-07-20T01:00:01.000Z"));

    expect(getHaruRagOutbox()).toHaveLength(1);
    expect(getHaruRagOutbox()[0]).toEqual(
      expect.objectContaining({
        contentHash: haruRagContentHash(next),
        attempts: 0,
      }),
    );
    expect(getHaruRagOutbox()[0].contentHash).not.toBe(firstHash);
    expect(JSON.parse(getHaruRagOutbox()[0].payload)).toEqual(next);
    expect(haruRagContentHash({ b: 2, a: 1 })).toBe(haruRagContentHash({ a: 1, b: 2 }));
  });

  it("drops queued data instead of sending after longitudinal consent is false", async () => {
    const record = currentRecord();
    const withdrawn = structuredClone(record);
    withdrawn.user.consents.longitudinal_usage_storage = false;

    enqueueHaruRagRecord(withdrawn);
    const fetchImpl = okFetch();
    await flushHaruRagOutbox({ fetchImpl, force: true });

    expect(getHaruRagOutbox()).toHaveLength(0);
    expect(getHaruRagDeletionOutbox()).toHaveLength(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/users/USR-000001",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("persists an offline deletion tombstone and never re-ingests that user first", async () => {
    const record = currentRecord();
    expect(enqueueHaruRagUserDeletion(record.user.user_id)).toBe(true);
    expect(getHaruRagOutbox()).toHaveLength(0);

    enqueueHaruRagRecord(record);
    expect(getHaruRagOutbox()).toHaveLength(0);

    const offline = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as FetchLike;
    await flushHaruRagOutbox({ fetchImpl: offline, force: true, now: () => 1_000 });

    expect(getHaruRagDeletionOutbox()).toEqual([
      expect.objectContaining({ userId: "USR-000001", attempts: 1, nextAttemptAt: 3_000 }),
    ]);
    expect(offline).toHaveBeenCalledTimes(1);

    const online = okFetch();
    await flushHaruRagOutbox({ fetchImpl: online, force: true, now: () => 3_000 });
    expect(getHaruRagDeletionOutbox()).toHaveLength(0);
    const [url, init] = (online as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("http://127.0.0.1:8000/api/users/USR-000001");
    expect(init).toEqual(expect.objectContaining({ method: "DELETE" }));
  });

  it("keeps deletion queued until optional Neo4j cleanup is complete", async () => {
    const record = currentRecord();
    enqueueHaruRagUserDeletion(record.user.user_id);
    const incomplete = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ complete: false, sqlite_deleted: true, neo4j_deleted: false }),
    })) as unknown as FetchLike;

    await flushHaruRagOutbox({ fetchImpl: incomplete, force: true, now: () => 1_000 });

    expect(getHaruRagDeletionOutbox()).toEqual([
      expect.objectContaining({ userId: "USR-000001", attempts: 1, nextAttemptAt: 3_000 }),
    ]);
  });

  it("dead-letters permanent ingest errors instead of retrying forever", async () => {
    currentRecord();
    const unauthorized = vi.fn(async () => ({ ok: false, status: 401 })) as unknown as FetchLike;

    await flushHaruRagOutbox({ fetchImpl: unauthorized, force: true });
    await flushHaruRagOutbox({ fetchImpl: unauthorized, force: true });

    expect(unauthorized).toHaveBeenCalledTimes(1);
    expect(getHaruRagOutbox()).toEqual([
      expect.objectContaining({ attempts: 1, blockedReason: "http-401" }),
    ]);
  });
});
