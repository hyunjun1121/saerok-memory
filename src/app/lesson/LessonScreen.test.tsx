import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import i18n from "../../i18n";
import { mockExercises } from "../../data/mockExercises";
import LessonScreen from "./LessonScreen";
import { getLocalizedText } from "../../utils/localizedText";
import "../../i18n";

describe("LessonScreen", () => {
  const renderWithRoute = (path: string) => {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/lesson" element={<LessonScreen />} />
          <Route path="/" element={<div>Home</div>} />
          <Route path="/result" element={<div>Result</div>} />
        </Routes>
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the lesson intro before start", () => {
    renderWithRoute("/lesson");

    const firstExercisePrompt = getLocalizedText(mockExercises[0].prompt, i18n.language);

    expect(screen.getByRole("button", { name: i18n.t("lesson.start.startButton") })).toBeInTheDocument();
    expect(screen.queryByText(firstExercisePrompt)).not.toBeInTheDocument();
    expect(screen.getByTestId("lesson-start-screen")).toBeInTheDocument();
  });

  it("starts the lesson when start button is clicked", async () => {
    renderWithRoute("/lesson");
    const firstExercisePrompt = getLocalizedText(mockExercises[0].prompt, i18n.language);

    fireEvent.click(screen.getByRole("button", { name: i18n.t("lesson.start.startButton") }));

    expect(screen.queryByRole("button", { name: i18n.t("lesson.start.startButton") })).not.toBeInTheDocument();
    expect(await screen.findByText(firstExercisePrompt)).toBeInTheDocument();
  });

  it("skips intro when captureExerciseId is present", () => {
    const firstExercisePrompt = getLocalizedText(mockExercises[0].prompt, i18n.language);
    renderWithRoute("/lesson?captureExerciseId=ex_1");

    expect(
      screen.queryByRole("button", { name: i18n.t("lesson.start.startButton") }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(firstExercisePrompt)).toBeInTheDocument();
  });
});
