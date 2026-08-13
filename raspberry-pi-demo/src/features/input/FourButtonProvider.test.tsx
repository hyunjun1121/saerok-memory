import { useCallback, useLayoutEffect } from "react";
import { act, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import {
  FourButtonContext,
  type FourButtonHandler,
  useFourButtonHandler,
  useFourButtonStatus,
} from "@/features/input/fourButtonContext";
import { FourButtonProvider } from "@/features/input/FourButtonProvider";
import type { ButtonSlot } from "@/features/input/keyConfig";

function Harness({ onPress }: { onPress: (slot: ButtonSlot) => void }) {
  const stableHandler = useCallback((slot: ButtonSlot) => onPress(slot), [onPress]);
  useFourButtonHandler(stableHandler);
  const { activeSlot, configReady, error } = useFourButtonStatus();

  return (
    <output data-testid="status">
      {String(configReady)}|{activeSlot ?? "idle"}|{error ?? "ok"}
    </output>
  );
}

function LayoutInvocationHarness({
  invoke,
  onPress,
  registered,
}: {
  invoke: boolean;
  onPress: FourButtonHandler;
  registered: { current: FourButtonHandler | null };
}) {
  useFourButtonHandler(onPress);
  useLayoutEffect(() => {
    if (invoke) registered.current?.("topLeft");
  }, [invoke, registered]);
  return null;
}

function fireKey(type: "keydown" | "keyup", code: string, repeat = false) {
  window.dispatchEvent(
    new KeyboardEvent(type, {
      key: code.replace("Digit", ""),
      code,
      repeat,
      bubbles: true,
    }),
  );
}

describe("FourButtonProvider", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("owns one central keydown and keyup subscription", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const documentAddSpy = vi.spyOn(document, "addEventListener");
    const documentRemoveSpy = vi.spyOn(document, "removeEventListener");
    const { rerender, unmount } = render(
      <FourButtonProvider>
        <Harness onPress={() => undefined} />
      </FourButtonProvider>,
    );

    rerender(
      <FourButtonProvider>
        <Harness onPress={() => undefined} />
      </FourButtonProvider>,
    );

    expect(addSpy.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(1);
    expect(addSpy.mock.calls.filter(([type]) => type === "keyup")).toHaveLength(1);
    expect(addSpy.mock.calls.filter(([type]) => type === "blur")).toHaveLength(1);
    expect(
      documentAddSpy.mock.calls.filter(([type]) => type === "visibilitychange"),
    ).toHaveLength(1);

    unmount();
    expect(removeSpy.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(1);
    expect(removeSpy.mock.calls.filter(([type]) => type === "keyup")).toHaveLength(1);
    expect(removeSpy.mock.calls.filter(([type]) => type === "blur")).toHaveLength(1);
    expect(
      documentRemoveSpy.mock.calls.filter(([type]) => type === "visibilitychange"),
    ).toHaveLength(1);
  });

  it("ignores repeats, requires release, and rejects contact bounce for 200ms", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T00:00:00.000Z"));
    const onPress = vi.fn();
    render(
      <FourButtonProvider>
        <Harness onPress={onPress} />
      </FourButtonProvider>,
    );

    act(() => fireKey("keydown", "Digit1"));
    expect(onPress).toHaveBeenLastCalledWith("topLeft");
    expect(screen.getByTestId("status")).toHaveTextContent("true|topLeft|ok");

    act(() => fireKey("keydown", "Digit1", true));
    act(() => fireKey("keydown", "Digit1"));
    expect(onPress).toHaveBeenCalledTimes(1);

    act(() => fireKey("keyup", "Digit1"));
    expect(screen.getByTestId("status")).toHaveTextContent("true|idle|ok");
    act(() => {
      vi.advanceTimersByTime(199);
      fireKey("keydown", "Digit1");
    });
    expect(onPress).toHaveBeenCalledTimes(1);

    act(() => fireKey("keyup", "Digit1"));
    act(() => {
      vi.advanceTimersByTime(1);
      fireKey("keydown", "Digit1");
    });
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it("uses monotonic debounce time when the wall clock moves backward", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T00:00:01.000Z"));
    const onPress = vi.fn();
    render(
      <FourButtonProvider>
        <Harness onPress={onPress} />
      </FourButtonProvider>,
    );

    act(() => {
      fireKey("keydown", "Digit1");
      fireKey("keyup", "Digit1");
      vi.setSystemTime(new Date("2026-08-10T00:00:00.500Z"));
      vi.advanceTimersByTime(200);
      fireKey("keydown", "Digit1");
    });

    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it("blocks a second physical button until the first button is released", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T00:00:00.000Z"));
    const onPress = vi.fn();
    render(
      <FourButtonProvider>
        <Harness onPress={onPress} />
      </FourButtonProvider>,
    );

    act(() => fireKey("keydown", "Digit1"));
    act(() => fireKey("keydown", "Digit2"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("status")).toHaveTextContent("true|topLeft|ok");

    act(() => fireKey("keyup", "Digit2"));
    act(() => fireKey("keyup", "Digit1"));
    act(() => fireKey("keydown", "Digit2"));
    expect(onPress).toHaveBeenCalledTimes(2);
    expect(onPress).toHaveBeenLastCalledWith("topRight");
  });

  it("releases a key-only binding by physical code when modifier state changes its key", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T00:00:00.000Z"));
    const onPress = vi.fn();
    const keyOnlyConfig = {
      version: 1,
      debounceMs: 200,
      bindings: {
        topLeft: { key: "x" },
        topRight: { key: "w" },
        bottomLeft: { key: "a" },
        bottomRight: { key: "s" },
      },
    };
    render(
      <FourButtonProvider config={keyOnlyConfig}>
        <Harness onPress={onPress} />
      </FourButtonProvider>,
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "x", code: "KeyX" }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "X", code: "KeyX" }));
    });
    expect(screen.getByTestId("status")).toHaveTextContent("true|idle|ok");

    act(() => {
      vi.advanceTimersByTime(200);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "x", code: "KeyX" }));
    });
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it("releases a key-only binding without code when letter case changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T00:00:00.000Z"));
    const onPress = vi.fn();
    const keyOnlyConfig = {
      version: 1,
      debounceMs: 200,
      bindings: {
        topLeft: { key: "x" },
        topRight: { key: "w" },
        bottomLeft: { key: "a" },
        bottomRight: { key: "s" },
      },
    };
    render(
      <FourButtonProvider config={keyOnlyConfig}>
        <Harness onPress={onPress} />
      </FourButtonProvider>,
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "x", code: "" }));
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "X", code: "" }));
    });
    expect(screen.getByTestId("status")).toHaveTextContent("true|idle|ok");

    act(() => {
      vi.advanceTimersByTime(200);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "x", code: "" }));
    });
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it("releases a code-less digit binding when Shift changes the key value", () => {
    const onPress = vi.fn();
    render(
      <FourButtonProvider>
        <Harness onPress={onPress} />
      </FourButtonProvider>,
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "1", code: "" }));
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "!", code: "" }));
    });

    expect(screen.getByTestId("status")).toHaveTextContent("true|idle|ok");
  });

  it("does not release a held key from an unrelated keyup with the same key value", () => {
    const onPress = vi.fn();
    render(
      <FourButtonProvider>
        <Harness onPress={onPress} />
      </FourButtonProvider>,
    );

    act(() => fireKey("keydown", "Digit1"));
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keyup", { key: "1", code: "Numpad1" }),
      );
    });
    expect(screen.getByTestId("status")).toHaveTextContent("true|topLeft|ok");

    act(() => fireKey("keyup", "Digit1"));
    expect(screen.getByTestId("status")).toHaveTextContent("true|idle|ok");
  });

  it("reports invalid config and disables input rather than silently remapping", () => {
    const onPress = vi.fn();
    render(
      <FourButtonProvider config={{ version: 1, bindings: {} }}>
        <Harness onPress={onPress} />
      </FourButtonProvider>,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("false|idle|");
    act(() => fireKey("keydown", "Digit1"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it.each([
    ["window blur", () => window.dispatchEvent(new Event("blur"))],
    [
      "document visibility change",
      () => document.dispatchEvent(new Event("visibilitychange")),
    ],
  ])("clears a missed keyup latch on %s", (_label, releaseFocus) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T00:00:00.000Z"));
    const onPress = vi.fn();
    render(
      <FourButtonProvider>
        <Harness onPress={onPress} />
      </FourButtonProvider>,
    );

    act(() => fireKey("keydown", "Digit1"));
    expect(screen.getByTestId("status")).toHaveTextContent("true|topLeft|ok");

    act(releaseFocus);
    expect(screen.getByTestId("status")).toHaveTextContent("true|idle|ok");

    act(() => fireKey("keydown", "Digit1"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("status")).toHaveTextContent("true|idle|ok");

    act(() => fireKey("keyup", "Digit1"));
    act(() => {
      vi.advanceTimersByTime(200);
      fireKey("keydown", "Digit1");
    });
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it("registers once while always invoking the latest callback", () => {
    const firstHandler = vi.fn();
    const latestHandler = vi.fn();
    const registered = { current: null as FourButtonHandler | null };
    const unregister = vi.fn();
    const registerHandler = vi.fn((handler: FourButtonHandler) => {
      registered.current = handler;
      return unregister;
    });
    const contextValue = {
      activeSlot: null,
      configReady: true,
      error: null,
      registerHandler,
    };

    const { rerender, unmount } = render(
      <FourButtonContext.Provider value={contextValue}>
        <Harness onPress={firstHandler} />
      </FourButtonContext.Provider>,
    );
    rerender(
      <FourButtonContext.Provider value={contextValue}>
        <Harness onPress={latestHandler} />
      </FourButtonContext.Provider>,
    );

    expect(registerHandler).toHaveBeenCalledTimes(1);
    act(() => registered.current?.("bottomRight"));
    expect(firstHandler).not.toHaveBeenCalled();
    expect(latestHandler).toHaveBeenCalledWith("bottomRight");

    unmount();
    expect(unregister).toHaveBeenCalledTimes(1);
  });

  it("updates the callback before descendant layout effects can deliver input", () => {
    const firstHandler = vi.fn();
    const latestHandler = vi.fn();
    const registered = { current: null as FourButtonHandler | null };
    const registerHandler = vi.fn((handler: FourButtonHandler) => {
      registered.current = handler;
      return () => {
        registered.current = null;
      };
    });
    const contextValue = {
      activeSlot: null,
      configReady: true,
      error: null,
      registerHandler,
    };

    const { rerender } = render(
      <FourButtonContext.Provider value={contextValue}>
        <LayoutInvocationHarness
          invoke={false}
          onPress={firstHandler}
          registered={registered}
        />
      </FourButtonContext.Provider>,
    );
    rerender(
      <FourButtonContext.Provider value={contextValue}>
        <LayoutInvocationHarness
          invoke
          onPress={latestHandler}
          registered={registered}
        />
      </FourButtonContext.Provider>,
    );

    expect(firstHandler).not.toHaveBeenCalled();
    expect(latestHandler).toHaveBeenCalledWith("topLeft");
  });
});
