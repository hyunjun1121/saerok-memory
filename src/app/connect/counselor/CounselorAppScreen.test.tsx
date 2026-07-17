import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/i18n";
import CounselorAppScreen from "@/app/connect/counselor/CounselorAppScreen";
import { seedCompletedHaruDemoDay } from "@/test/haruDemoSessionFixtures";

describe("CounselorAppScreen", () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage("ko");
  });

  it("shows one participant with actual local totals instead of fixed canonical totals", () => {
    seedCompletedHaruDemoDay(1);

    render(
      <MemoryRouter>
        <CounselorAppScreen />
      </MemoryRouter>,
    );

    expect(screen.getByText("박영자")).toBeInTheDocument();
    expect(screen.getByText("1/7")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText(/이 기기에 저장된 실제 활동 기록/)).toBeInTheDocument();
    expect(screen.queryByText("42")).not.toBeInTheDocument();
    expect(screen.queryByText("김영숙")).not.toBeInTheDocument();
    expect(screen.queryByText("박철수")).not.toBeInTheDocument();
  });

  it("renders an empty local record as zero instead of seven completed days", () => {
    render(
      <MemoryRouter>
        <CounselorAppScreen />
      </MemoryRouter>,
    );

    expect(screen.getByText("0/7")).toBeInTheDocument();
    expect(screen.getByText(/연결된 활동 기록이 없습니다/)).toBeInTheDocument();
  });
});
