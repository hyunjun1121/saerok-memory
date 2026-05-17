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
  }),
}));

describe("FamilyScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCognitiveRoutineResults as Mock).mockReturnValue([]);
    (getMemoryCards as Mock).mockReturnValue([]);
  });

  it("renders the tabs and defaults to family view", () => {
    render(<FamilyScreen />);

    // Check tabs
    expect(screen.getByText("family.tabs.family")).toBeInTheDocument();
    expect(screen.getByText("family.tabs.counselor")).toBeInTheDocument();

    // Check family content
    expect(screen.getByText("family.inviteTitle")).toBeInTheDocument();
    expect(screen.getByText("family.summaryTitle")).toBeInTheDocument();
    expect(screen.getByText("family.privacyTitle")).toBeInTheDocument();
  });

  it("switches to counselor view when tab is clicked", () => {
    render(<FamilyScreen />);

    fireEvent.click(screen.getByText("family.tabs.counselor"));

    // Check counselor content
    expect(screen.getByText("family.reportTitle")).toBeInTheDocument();
    expect(screen.getByText("family.report.nonDiagnosticBadge")).toBeInTheDocument();
    expect(screen.getByText("family.trend.title")).toBeInTheDocument();
    expect(screen.getByText("family.counselorCuesLabel")).toBeInTheDocument();
    expect(screen.getByText("family.counselorDisclaimer")).toBeInTheDocument();

    // Check that family content is hidden
    expect(screen.queryByText("family.inviteTitle")).not.toBeInTheDocument();
  });

  it("displays fallback cues when there are no shareable memory cards in counselor view", () => {
    render(<FamilyScreen />);

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
});
