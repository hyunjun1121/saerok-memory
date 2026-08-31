import { describe, expect, it } from "vitest";
import { isNfcLoginKey } from "@/features/login/nfcLoginInput";

describe("NFC login keyboard input", () => {
  it.each([
    { key: "5", code: "Digit5" },
    { key: "Unidentified", code: "Digit5" },
    { key: "5", code: "" },
  ])("accepts a plain 5 press (%j)", (event) => {
    expect(isNfcLoginKey(event)).toBe(true);
  });

  it.each([
    { key: "4", code: "Digit4" },
    { key: "", code: "Numpad5" },
    { key: "%", code: "Digit5", shiftKey: true },
    { key: "5", code: "Digit5", repeat: true },
    { key: "5", code: "Digit5", defaultPrevented: true },
    { key: "5", code: "Digit5", isComposing: true },
    { key: "5", code: "Digit5", ctrlKey: true },
  ])("rejects non-login input (%j)", (event) => {
    expect(isNfcLoginKey(event)).toBe(false);
  });
});
