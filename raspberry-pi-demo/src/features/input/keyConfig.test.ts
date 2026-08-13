import {
  BUTTON_SLOTS,
  DEFAULT_FOUR_BUTTON_CONFIG,
  mapKeyboardEventToSlot,
  parseFourButtonConfig,
  type FourButtonKeyConfig,
} from "@/features/input/keyConfig";

describe("four-button key configuration", () => {
  it("maps the default Digit1-Digit4 keys in physical row-major order", () => {
    expect(BUTTON_SLOTS).toEqual([
      "topLeft",
      "topRight",
      "bottomLeft",
      "bottomRight",
    ]);
    expect(
      BUTTON_SLOTS.map((slot) => DEFAULT_FOUR_BUTTON_CONFIG.bindings[slot].code),
    ).toEqual(["Digit1", "Digit2", "Digit3", "Digit4"]);

    expect(
      mapKeyboardEventToSlot(DEFAULT_FOUR_BUTTON_CONFIG, {
        key: "1",
        code: "Digit1",
      }),
    ).toBe("topLeft");
    expect(
      mapKeyboardEventToSlot(DEFAULT_FOUR_BUTTON_CONFIG, {
        key: "4",
        code: "Digit4",
      }),
    ).toBe("bottomRight");
  });

  it("parses JSON text and supports key fallback when hardware code is absent", () => {
    const config = parseFourButtonConfig(
      JSON.stringify({
        version: 1,
        debounceMs: 240,
        bindings: {
          topLeft: { key: "q" },
          topRight: { key: "w" },
          bottomLeft: { key: "a" },
          bottomRight: { key: "s" },
        },
      }),
    );

    expect(config.debounceMs).toBe(240);
    expect(mapKeyboardEventToSlot(config, { key: "a", code: "" })).toBe(
      "bottomLeft",
    );
    expect(mapKeyboardEventToSlot(config, { key: "x", code: "KeyX" })).toBeNull();
  });

  it.each([
    [null, "object"],
    [{ version: 2, bindings: {} }, "version 1"],
    [
      {
        version: 1,
        bindings: {
          topLeft: { code: "Digit1" },
          topRight: { code: "Digit2" },
          bottomLeft: { code: "Digit3" },
        },
      },
      "exactly four",
    ],
    [
      {
        version: 1,
        bindings: {
          topLeft: {},
          topRight: { code: "Digit2" },
          bottomLeft: { code: "Digit3" },
          bottomRight: { code: "Digit4" },
        },
      },
      "key or code",
    ],
  ])("rejects malformed raw config %#", (raw, message) => {
    expect(() => parseFourButtonConfig(raw)).toThrow(message);
  });

  it("rejects duplicate keys and duplicate codes", () => {
    expect(() =>
      parseFourButtonConfig({
        version: 1,
        bindings: {
          topLeft: { key: "1", code: "Digit1" },
          topRight: { key: "1", code: "Digit1" },
          bottomLeft: { key: "3", code: "Digit3" },
          bottomRight: { key: "4", code: "Digit4" },
        },
      }),
    ).toThrow("duplicated key");

    expect(() =>
      parseFourButtonConfig({
        version: 1,
        bindings: {
          topLeft: { key: "1", code: "Digit1" },
          topRight: { code: "Digit1" },
          bottomLeft: { key: "3", code: "Digit3" },
          bottomRight: { key: "4", code: "Digit4" },
        },
      }),
    ).toThrow("duplicated code");
  });

  it.each([
    ["x", "KeyX", "KeyX"],
    ["X", "KeyX", "KeyX"],
    ["7", "Digit7", "Digit7"],
    ["Enter", "Enter", "Enter"],
    [" ", "Space", "Space"],
    ["/", "Slash", "Slash"],
    ["!", "Digit1", "Digit1"],
  ])(
    "rejects cross-kind physical collision between key %s and code %s",
    (key, code, physicalKey) => {
      expect(() =>
        parseFourButtonConfig({
          version: 1,
          bindings: {
            topLeft: { key },
            topRight: { code },
            bottomLeft: { key: "a", code: "KeyA" },
            bottomRight: { key: "s", code: "KeyS" },
          },
        }),
      ).toThrow(
        `Four-button config maps physical key "${physicalKey}" to both "topLeft" and "topRight".`,
      );
    },
  );

  it.each([
    [
      {
        debounceMs: 49,
        topLeft: { key: "1", code: "Digit1" },
      },
      "debounceMs",
    ],
    [
      {
        debounceMs: 200.5,
        topLeft: { key: "1", code: "Digit1" },
      },
      "debounceMs",
    ],
    [
      {
        topLeft: { key: "1", code: "Key A" },
      },
      "code is invalid",
    ],
    [
      {
        topLeft: { key: "x".repeat(33), code: "KeyA" },
      },
      "key is invalid",
    ],
  ])("fails closed for runtime-incompatible input config %#", (override, message) => {
    const debounceOverride = "debounceMs" in override
      ? { debounceMs: override.debounceMs }
      : {};
    expect(() =>
      parseFourButtonConfig({
        version: 1,
        ...debounceOverride,
        bindings: {
          topLeft: override.topLeft,
          topRight: { key: "2", code: "Digit2" },
          bottomLeft: { key: "3", code: "Digit3" },
          bottomRight: { key: "4", code: "Digit4" },
        },
      }),
    ).toThrow(message);
  });

  it("returns no slot when an unparsed config matches key and code to different slots", () => {
    const ambiguousConfig: FourButtonKeyConfig = {
      version: 1,
      debounceMs: 200,
      bindings: {
        topLeft: { key: "Enter" },
        topRight: { code: "Enter" },
        bottomLeft: { key: "3", code: "Digit3" },
        bottomRight: { key: "4", code: "Digit4" },
      },
    };

    expect(
      mapKeyboardEventToSlot(ambiguousConfig, { key: "Enter", code: "Enter" }),
    ).toBeNull();
  });

  it("rejects a binding whose known key and code name different physical keys", () => {
    expect(() =>
      parseFourButtonConfig({
        version: 1,
        debounceMs: 200,
        bindings: {
          topLeft: { key: "x", code: "Digit1" },
          topRight: { key: "2", code: "Digit2" },
          bottomLeft: { key: "3", code: "Digit3" },
          bottomRight: { key: "4", code: "Digit4" },
        },
      }),
    ).toThrow(
      'Four-button binding "topLeft" has mismatched physical key "KeyX" and code "Digit1".',
    );
  });
});
