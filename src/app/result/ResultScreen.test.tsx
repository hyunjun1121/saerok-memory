import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import i18n from "@/i18n";
import ResultScreen from "@/app/result/ResultScreen";
import {
  HARU_WEEK_PLAN,
  HARU_WEEK_QUESTION_META,
} from "@/data/haru7DayExercises";
import { GamificationProvider } from "@/features/gamification/useGamification";
import {
  completeHaruDemoSession,
  recordHaruDemoResponse,
  startHaruDemoSession,
} from "@/features/lessons/haruDemoSessionStorage";
import { getLocalizedText } from "@/utils/localizedText";
import "@/i18n";

describe("ResultScreen", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the authored message and records a verified demo-day completion", async () => {
    render(
      <GamificationProvider>
        <MemoryRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          initialEntries={[
            {
              pathname: "/result",
              search: "?day=4",
              state: { completed: true },
            },
          ]}
        >
          <Routes>
            <Route path="/result" element={<ResultScreen />} />
          </Routes>
        </MemoryRouter>
      </GamificationProvider>,
    );

    expect(
      screen.getByText(
        getLocalizedText(HARU_WEEK_PLAN[3].completionMessage, i18n.language),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("result.nextDay", { day: 5 }) }),
    ).toBeInTheDocument();
    await waitFor(() => {
      const gardenState = JSON.parse(localStorage.getItem("gardenState") ?? "null") as {
        waterDrops?: number;
      } | null;
      expect(gardenState?.waterDrops).toBe(1);
    });
  });

  it("does not record a direct or abandoned result visit as completed", async () => {
    render(
      <GamificationProvider>
        <MemoryRouter
          initialEntries={["/result?day=4"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/result" element={<ResultScreen />} />
          </Routes>
        </MemoryRouter>
      </GamificationProvider>,
    );

    await waitFor(() => {
      const gardenState = JSON.parse(localStorage.getItem("gardenState") ?? "null") as {
        waterDrops?: number;
      } | null;
      expect(gardenState?.waterDrops).toBe(0);
    });
    expect(screen.getByText(i18n.t("result.encouragement"))).toBeInTheDocument();
    expect(
      screen.queryByText(
        getLocalizedText(HARU_WEEK_PLAN[3].completionMessage, i18n.language),
      ),
    ).not.toBeInTheDocument();
  });

  it("restores a completed day's message and next step after navigation state is lost", async () => {
    startHaruDemoSession(4, HARU_WEEK_PLAN[3].exerciseIds);
    HARU_WEEK_QUESTION_META.filter((question) => question.day === 4).forEach(
      (question) => {
        recordHaruDemoResponse(4, {
          questionId: question.exerciseId,
          responseType: question.responseType,
          responseTimeMs: question.recordedResponse.responseTimeMs,
          isCorrect: question.recordedResponse.isCorrect,
          ...(question.recordedResponse.selectedOptionId
            ? { selectedOptionId: question.recordedResponse.selectedOptionId }
            : {}),
          ...(question.recordedResponse.submittedSequence
            ? { submittedSequence: [...question.recordedResponse.submittedSequence] }
            : {}),
          ...(question.responseType === "voice"
            ? {
                voiceDurationSeconds:
                  question.recordedResponse.voiceDurationSeconds ?? 0,
                sttStatus: question.recordedResponse.sttStatus ?? "failed",
              }
            : {}),
        });
      },
    );
    completeHaruDemoSession(
      4,
      getLocalizedText(HARU_WEEK_PLAN[3].completionMessage, i18n.language),
    );

    render(
      <GamificationProvider>
        <MemoryRouter
          initialEntries={["/result?day=4"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/result" element={<ResultScreen />} />
          </Routes>
        </MemoryRouter>
      </GamificationProvider>,
    );

    expect(
      screen.getByText(
        getLocalizedText(HARU_WEEK_PLAN[3].completionMessage, i18n.language),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("result.nextDay", { day: 5 }) }),
    ).toBeInTheDocument();
    await waitFor(() => {
      const gardenState = JSON.parse(localStorage.getItem("gardenState") ?? "null") as {
        waterDrops?: number;
      } | null;
      expect(gardenState?.waterDrops).toBe(0);
    });
  });
});
