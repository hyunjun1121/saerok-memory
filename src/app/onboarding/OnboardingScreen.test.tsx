import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import OnboardingScreen from "@/app/onboarding/OnboardingScreen";
import i18n from "@/i18n";

const analyticsMocks = vi.hoisted(() => ({
  capture: vi.fn(async () => true),
}));

vi.mock("@/features/analytics/client", () => ({
  captureHaruTelemetry: analyticsMocks.capture,
}));

describe("OnboardingScreen telemetry", () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    await i18n.changeLanguage("ko");
  });

  it("records shown, completed, and abandoned steps without visible copy", async () => {
    const view = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <OnboardingScreen />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(analyticsMocks.capture).toHaveBeenCalledWith("onboarding_step", {
        stepId: "language",
        state: "shown",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: i18n.t("onboarding.next") }));
    await waitFor(() => {
      expect(analyticsMocks.capture).toHaveBeenCalledWith("onboarding_step", {
        stepId: "language",
        state: "completed",
      });
      expect(analyticsMocks.capture).toHaveBeenCalledWith("onboarding_step", {
        stepId: "large_text",
        state: "shown",
      });
    });

    view.unmount();
    expect(analyticsMocks.capture).toHaveBeenCalledWith("onboarding_step", {
      stepId: "large_text",
      state: "abandoned",
    });
  });
});
