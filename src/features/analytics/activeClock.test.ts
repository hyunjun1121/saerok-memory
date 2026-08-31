import {
  createActiveClock,
  readActiveClock,
  reduceActiveClock,
} from "@/features/analytics/activeClock";

describe("active telemetry clock", () => {
  it("caps active time at the idle threshold", () => {
    const clock = createActiveClock(0, { idleAfterMs: 30_000 });

    expect(readActiveClock(clock, 10_000)).toMatchObject({
      wallDurationMs: 10_000,
      activeDurationMs: 10_000,
      isActive: true,
    });
    expect(readActiveClock(clock, 40_000)).toMatchObject({
      wallDurationMs: 40_000,
      activeDurationMs: 30_000,
      isActive: false,
    });
  });

  it("excludes hidden and unfocused intervals", () => {
    let clock = createActiveClock(0, { idleAfterMs: 30_000 });
    clock = reduceActiveClock(clock, { type: "visibility", visible: false, atMs: 10_000 });
    clock = reduceActiveClock(clock, { type: "visibility", visible: true, atMs: 20_000 });
    clock = reduceActiveClock(clock, { type: "interaction", atMs: 20_000 });
    clock = reduceActiveClock(clock, { type: "focus", focused: false, atMs: 25_000 });

    expect(readActiveClock(clock, 35_000)).toMatchObject({
      wallDurationMs: 35_000,
      activeDurationMs: 15_000,
      isActive: false,
    });
  });

  it("stops permanently and clamps backward timestamps", () => {
    let clock = createActiveClock(1_000);
    clock = reduceActiveClock(clock, { type: "stop", atMs: 6_000 });
    clock = reduceActiveClock(clock, { type: "interaction", atMs: 3_000 });

    expect(readActiveClock(clock, 20_000)).toMatchObject({
      wallDurationMs: 5_000,
      activeDurationMs: 5_000,
      isActive: false,
    });
  });
});
