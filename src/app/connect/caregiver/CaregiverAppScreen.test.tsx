import { beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/i18n";
import CaregiverAppScreen from "@/app/connect/caregiver/CaregiverAppScreen";
import { seedCompletedHaruDemoDay } from "@/test/haruDemoSessionFixtures";

describe("CaregiverAppScreen", () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage("ko");
  });

  it("shows the sanitized actual local participation summary", () => {
    seedCompletedHaruDemoDay(1);

    render(
      <MemoryRouter>
        <CaregiverAppScreen />
      </MemoryRouter>,
    );

    expect(screen.getByText(/박영자/)).toBeInTheDocument();
    expect(screen.getByText(/전체 7일 중 1일/)).toBeInTheDocument();
    expect(screen.getByText(/6개 활동/)).toBeInTheDocument();
    expect(screen.getByText(/가족 공유 동의가 없어/)).toBeInTheDocument();
  });

  it("does not invent a completed week when no session exists", () => {
    render(
      <MemoryRouter>
        <CaregiverAppScreen />
      </MemoryRouter>,
    );

    expect(screen.getByText(/전체 7일 중 0일/)).toBeInTheDocument();
    expect(screen.getByText(/연결된 활동 기록이 없어요/)).toBeInTheDocument();
    expect(screen.queryByText(/42개 활동/)).not.toBeInTheDocument();
  });

  it("does not expose private transcript or health details without sharing consent", () => {
    render(
      <MemoryRouter>
        <CaregiverAppScreen />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/김치전/)).not.toBeInTheDocument();
    expect(screen.queryByText(/보건소/)).not.toBeInTheDocument();
    expect(screen.queryByText(/복약/)).not.toBeInTheDocument();
    expect(screen.queryByText(/오늘은 집에서 화분에 물을 주고/)).not.toBeInTheDocument();
  });

  it("updates from a newly persisted session without reloading the screen", () => {
    render(
      <MemoryRouter>
        <CaregiverAppScreen />
      </MemoryRouter>,
    );
    expect(screen.getByText(/전체 7일 중 0일/)).toBeInTheDocument();

    act(() => {
      seedCompletedHaruDemoDay(1);
    });

    expect(screen.getByText(/전체 7일 중 1일/)).toBeInTheDocument();
    expect(screen.getByText(/6개 활동/)).toBeInTheDocument();
  });
});
