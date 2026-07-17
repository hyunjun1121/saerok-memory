import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import i18n from "@/i18n";
import CounselorParticipantScreen from "@/app/connect/counselor/CounselorParticipantScreen";
import { seedCompletedHaruDemoDay } from "@/test/haruDemoSessionFixtures";

describe("CounselorParticipantScreen", () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage("ko");
  });

  it("frames an actual sequence difference as practice support, not decline", () => {
    seedCompletedHaruDemoDay(4, {
      responseOverrides: {
        D4_Q6: {
          submittedSequence: ["A", "B", "D"],
          responseTimeMs: 8_200,
          isCorrect: false,
        },
      },
    });

    render(
      <MemoryRouter
        initialEntries={["/connect/counselor/participant/1"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/connect/counselor/participant/:id"
            element={<CounselorParticipantScreen />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("박영자")).toBeInTheDocument();
    expect(screen.getByText("기록을 모으는 중")).toBeInTheDocument();
    expect(screen.getAllByText("1/7")).toHaveLength(2);
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("0/1")).toBeInTheDocument();
    expect(screen.getByText("단어 순서")).toBeInTheDocument();
    expect(screen.getByText(/1개의 다른 선택/)).toBeInTheDocument();
    expect(screen.getByText("평소 말하기 특성")).toBeInTheDocument();
  });

  it("keeps raw personal stories hidden", () => {
    render(
      <MemoryRouter
        initialEntries={["/connect/counselor/participant/1"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/connect/counselor/participant/:id"
            element={<CounselorParticipantScreen />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText(/김치전/)).not.toBeInTheDocument();
    expect(screen.queryByText(/보건소/)).not.toBeInTheDocument();
    expect(screen.queryByText(/화분에 물을 주고/)).not.toBeInTheDocument();
  });
});
