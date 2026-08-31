import {
  createEventId,
  createVisitId,
  getOrCreateInstallationId,
  type IdentityStorage,
  type RandomIdentitySource,
} from "@/features/analytics/identity";

function createStorage(): IdentityStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

function createRandomSource(): RandomIdentitySource {
  let next = 0;
  return {
    randomUUID: () => `${String(next++).padStart(8, "0")}-1111-4222-8333-444444444444`,
  };
}

describe("pseudonymous telemetry identity", () => {
  it("persists one installation id per market", () => {
    const storage = createStorage();
    const randomSource = createRandomSource();

    const first = getOrCreateInstallationId("kr", { storage, randomSource });
    const again = getOrCreateInstallationId("kr", { storage, randomSource });
    const japan = getOrCreateInstallationId("jp", { storage, randomSource });

    expect(again).toBe(first);
    expect(japan).not.toBe(first);
    expect(first).toMatch(/^inst_kr_[a-f0-9]{32}$/);
    expect(japan).toMatch(/^inst_jp_[a-f0-9]{32}$/);
  });

  it("replaces malformed saved values without fingerprinting", () => {
    const storage = createStorage();
    storage.setItem("haru:analytics:kr:installation-id", "010-1234-5678");

    const id = getOrCreateInstallationId("kr", {
      storage,
      randomSource: createRandomSource(),
    });

    expect(id).toMatch(/^inst_kr_[a-f0-9]{32}$/);
    expect(id).not.toContain("010");
  });

  it("creates distinct visit and event ids", () => {
    const randomSource = createRandomSource();
    expect(createVisitId(randomSource)).toMatch(/^visit_[a-f0-9]{32}$/);
    expect(createEventId("jp", randomSource)).toMatch(/^evt_jp_[a-f0-9]{32}$/);
  });
});
