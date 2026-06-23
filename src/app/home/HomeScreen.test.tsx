import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomeScreen from "./HomeScreen";
import "../../i18n";

function renderHome() {
  return render(
    <MemoryRouter>
      <HomeScreen />
    </MemoryRouter>,
  );
}

describe("HomeScreen SP-07 single CTA", () => {
  it("shows exactly one CTA button (오늘 루틴 시작하기)", () => {
    renderHome();
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "오늘 루틴 시작하기" }),
    ).toBeInTheDocument();
  });

  it("does not render the legacy advisory card", () => {
    renderHome();
    expect(screen.queryByText("매일 뇌를 가볍게 깨워요")).not.toBeInTheDocument();
  });

  it("keeps the today-routine label", () => {
    renderHome();
    // todayRoutineName renders "오늘은 {{name}} 날이에요." — assert the suffix is present.
    expect(screen.getByText(/날이에요\.$/)).toBeInTheDocument();
  });
});
