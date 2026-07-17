import { describe, expect, it } from "vitest";
import { mockExercises } from "@/data/mockExercises";

/**
 * SP-06 content guardrails: the everyday rewrite must hold. No idiom-knowledge
 * (사자성어) tokens remain, the attention task is concrete give/take (no abstract
 * number sequence), and digit-span is forward repeat (not backward working-memory).
 */
describe("mockExercises SP-06 content", () => {
  const serialized = JSON.stringify(mockExercises);

  it("contains no idiom-knowledge tokens (고진감래/일석이조/동문서답)", () => {
    expect(serialized).not.toContain("고진감래");
    expect(serialized).not.toContain("일석이조");
    expect(serialized).not.toContain("동문서답");
    expect(serialized).not.toContain("苦あれば楽あり");
    expect(serialized).not.toContain("一石二鳥");
  });

  it("ex_attention is concrete give/take with no abstract number sequence", () => {
    const attention = mockExercises.find((e) => e.id === "ex_attention");
    expect(attention).toBeDefined();
    expect(attention!.payload.pattern ?? []).toHaveLength(0);
    // Prompt references the concrete apple-sharing scenario.
    expect(JSON.stringify(attention!.prompt)).toContain("사과");
  });

  it("ex_digit_span is forward repeat, not backward", () => {
    const digit = mockExercises.find((e) => e.id === "ex_digit_span");
    expect(digit).toBeDefined();
    expect(digit!.payload.direction).toBe("forward");
    expect(digit!.correctAnswer).toEqual(["4", "8", "2"]);
  });
});
