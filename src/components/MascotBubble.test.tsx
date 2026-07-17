import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MascotBubble } from "@/components/MascotBubble";

describe("MascotBubble SP-03", () => {
  it("praising mood is announced via role=status + aria-live", () => {
    const { container } = render(
      <MascotBubble mood="praising" message="참 잘하셨어요!" />,
    );
    const bubble = container.querySelector('[role="status"]');
    expect(bubble).not.toBeNull();
    expect(bubble).toHaveAttribute("aria-live", "polite");
  });

  it("encouraging mood no longer uses a red tint", () => {
    const { container } = render(
      <MascotBubble mood="encouraging" message="천천히 해볼까요?" />,
    );
    const bubble = container.querySelector('[role="status"]');
    expect(bubble?.className).not.toContain("border-red-200");
    expect(bubble?.className).not.toContain("bg-red-50");
    expect(bubble?.className).toContain("bg-amber-50");
  });
});
