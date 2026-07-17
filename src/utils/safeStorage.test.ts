import { beforeEach, describe, expect, it, vi } from "vitest";
import { readJson, readJsonArray, removeKey, writeJson } from "@/utils/safeStorage";

describe("safeStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns the fallback when the key is missing", () => {
    expect(readJson("missing", { a: 1 })).toEqual({ a: 1 });
  });

  it("returns the fallback when JSON is corrupt (never throws)", () => {
    localStorage.setItem("corrupt", "{not valid json");
    expect(readJson("corrupt", "fallback")).toBe("fallback");
    expect(readJsonArray("corrupt")).toEqual([]);
  });

  it("round-trips a value through write/read", () => {
    expect(writeJson("ok", { list: [1, 2, 3] })).toBe(true);
    expect(readJson("ok", null)).toEqual({ list: [1, 2, 3] });
  });

  it("readJsonArray returns [] for non-array stored values", () => {
    localStorage.setItem("notArray", JSON.stringify({ x: 1 }));
    expect(readJsonArray("notArray")).toEqual([]);
  });

  it("removeKey clears a value without throwing", () => {
    writeJson("temp", 42);
    expect(removeKey("temp")).toBe(true);
    expect(readJson("temp", "gone")).toBe("gone");
  });

  it("reports a removal failure instead of silently claiming success", () => {
    writeJson("temp", 42);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(removeKey("temp")).toBe(false);
    expect(localStorage.getItem("temp")).not.toBeNull();
  });
});
