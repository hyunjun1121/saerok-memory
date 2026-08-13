import { loadRuntimeInputConfig } from "@/config/runtimeConfig";

const validInput = {
  version: 1,
  debounceMs: 200,
  bindings: {
    topLeft: { key: "1", code: "Digit1" },
    topRight: { key: "2", code: "Digit2" },
    bottomLeft: { key: "3", code: "Digit3" },
    bottomRight: { key: "4", code: "Digit4" },
  },
};

function response(ok: boolean, payload: unknown): Response {
  return { ok, json: async () => payload } as Response;
}

describe("runtime input config loader", () => {
  it("accepts a complete externally loaded four-button mapping", async () => {
    const result = await loadRuntimeInputConfig(async () => response(true, { input: validInput }) as never);
    expect(result).toEqual({ status: "ready", config: validInput });
  });

  it("fails closed when the runtime file is missing", async () => {
    const result = await loadRuntimeInputConfig(async () => response(false, {}) as never);
    expect(result).toEqual({ status: "error", reason: "missing" });
  });

  it("fails closed when the mapping is malformed", async () => {
    const result = await loadRuntimeInputConfig(async () => response(true, {
      input: { ...validInput, bindings: { ...validInput.bindings, topRight: validInput.bindings.topLeft } },
    }) as never);
    expect(result).toEqual({ status: "error", reason: "invalid" });
  });
});
