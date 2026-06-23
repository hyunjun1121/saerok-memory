import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import FamilyScreen from "./FamilyScreen";
import { getCognitiveRoutineResults } from "../../features/cognitive/cognitiveRoutineStorage";
import { getMemoryCards } from "../../features/memory/memoryCardStorage";

// Mock the storages
vi.mock("../../features/cognitive/cognitiveRoutineStorage", () => ({
  getCognitiveRoutineResults: vi.fn(),
}));

vi.mock("../../features/memory/memoryCardStorage", () => ({
  getMemoryCards: vi.fn(),
}));

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "ko" },
  }),
}));

describe("FamilyScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (getCognitiveRoutineResults as Mock).mockReturnValue([]);
    (getMemoryCards as Mock).mockReturnValue([]);
  });

  it("renders the tabs and defaults to the gentle family view", () => {
    render(<FamilyScreen />);

    // Check tabs
    expect(screen.getByText("family.tabs.family")).toBeInTheDocument();
    expect(screen.getByText("family.tabs.counselor")).toBeInTheDocument();

    // SP-08: default is the family view — encouraging content, no raw report.
    expect(screen.getByText("family.inviteTitle")).toBeInTheDocument();
    expect(screen.getByText("family.summaryTitle")).toBeInTheDocument();
    expect(screen.getByText("family.privacyTitle")).toBeInTheDocument();

    // Counselor-only report content is hidden by default.
    expect(screen.queryByText("family.reportTitle")).not.toBeInTheDocument();
    expect(screen.queryByText("family.trend.title")).not.toBeInTheDocument();
  });

  it("switches to the counselor view when the tab is clicked", () => {
    render(<FamilyScreen />);

    fireEvent.click(screen.getByText("family.tabs.counselor"));

    // Check counselor content
    expect(screen.getByText("family.reportTitle")).toBeInTheDocument();
    expect(screen.getByText("family.report.activityBadge")).toBeInTheDocument();
    expect(screen.getByText("family.trend.title")).toBeInTheDocument();

    // Family-only content is hidden in counselor view.
    expect(screen.queryByText("family.inviteTitle")).not.toBeInTheDocument();
  });

  it("displays fallback cues when there are no shareable memory cards in counselor view", () => {
    (getMemoryCards as Mock).mockReturnValue([{ shareWithFamily: false }]);

    render(<FamilyScreen />);

    // Counselor content is on the counselor tab (family is the gentle default).
    fireEvent.click(screen.getByText("family.tabs.counselor"));

    // Should display fallback cues
    expect(screen.getByText("family.cues.fallbackEasiest")).toBeInTheDocument();
    expect(screen.getByText("family.cues.fallbackTomorrow")).toBeInTheDocument();
  });

  it("displays correct summary counts based on data in counselor view", () => {
    (getCognitiveRoutineResults as Mock).mockReturnValue([
      { completed: true },
      { completed: true },
      { completed: false },
    ]);

    (getMemoryCards as Mock).mockReturnValue([
      { shareWithFamily: true },
      { shareWithFamily: false },
    ]);

    render(<FamilyScreen />);

    fireEvent.click(screen.getByText("family.tabs.counselor"));

    // 2 completed routines
    expect(screen.getByText("2")).toBeInTheDocument();
    // 1 shared card
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("SP-09: family view shows familySummary metrics and no due-review tile", () => {
    // A shareable card makes hasData true so the metric grid renders.
    (getMemoryCards as Mock).mockReturnValue([{ shareWithFamily: true }]);

    render(<FamilyScreen />);

    // Family view (default) uses familySummary; the attempted-this-week tile is present...
    expect(screen.getByText("family.metrics.attemptedThisWeek")).toBeInTheDocument();
    // ...and the counselor-only due-review tile is not.
    expect(screen.queryByText("family.metrics.dueReviewCount")).not.toBeInTheDocument();
  });

  it("saves caregiver observation notes and shows them in the counselor view", () => {
    render(<FamilyScreen />);

    fireEvent.click(screen.getByText("family.tabs.family"));
    fireEvent.click(
      screen.getByLabelText(
        "family.observation.domains.appointments: family.observation.responses.oftenDifferent",
      ),
    );
    fireEvent.change(screen.getByLabelText("family.observation.noteLabel"), {
      target: { value: "약속 시간을 여러 번 다시 확인했습니다." },
    });
    fireEvent.click(screen.getByText("family.observation.save"));

    expect(screen.getByText("약속 시간을 여러 번 다시 확인했습니다.")).toBeInTheDocument();
    expect(screen.getByText("family.observation.latestResponse")).toBeInTheDocument();

    fireEvent.click(screen.getByText("family.tabs.counselor"));

    expect(screen.getByText("family.observation.counselorTitle")).toBeInTheDocument();
    expect(screen.getByText("약속 시간을 여러 번 다시 확인했습니다.")).toBeInTheDocument();
  });
});
