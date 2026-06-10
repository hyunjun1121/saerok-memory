import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Button3D } from "../../components/Button3D";
import { ProgressBar } from "../../components/ProgressBar";
import { FeedbackTray } from "../../components/FeedbackTray";
import { MascotBubble } from "../../components/MascotBubble";
import { ExerciseRenderer } from "../../features/lessons/ExerciseRenderer";
import { mockExercises, type Exercise } from "../../data/mockExercises";
import type { ExerciseState } from "../../features/lessons/exerciseTypes/types";
import type { MemoryCard } from "../../features/memory/types";
import { generateMemoryReviewExercise } from "../../features/memory/memoryReviewGenerator";
import { getLocalizedText } from "../../utils/localizedText";

function buildSessionExercises(initialExerciseId?: string | null) {
  const savedCards = JSON.parse(localStorage.getItem("memoryCards") || "[]") as MemoryCard[];
  const sessionExercises = [...mockExercises];

  if (savedCards.length > 0) {
    const randomCard = savedCards[Math.floor(Math.random() * savedCards.length)];
    const reviewEx = generateMemoryReviewExercise(randomCard, "lesson_1");

    if (reviewEx) {
      sessionExercises.splice(2, 0, reviewEx);
    }
  }

  if (initialExerciseId) {
    const initialExerciseIndex = sessionExercises.findIndex(
      (exercise) => exercise.id === initialExerciseId,
    );

    if (initialExerciseIndex >= 0) {
      return sessionExercises.slice(initialExerciseIndex);
    }
  }

  return sessionExercises;
}

export default function LessonScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const initialExerciseId = new URLSearchParams(location.search).get("captureExerciseId");

  const [exercises] = useState<Exercise[]>(() => buildSessionExercises(initialExerciseId));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [globalState, setGlobalState] = useState<ExerciseState>("awaiting_answer");
  const [hasStarted, setHasStarted] = useState(!!initialExerciseId);

  const currentExercise = exercises[currentIndex];
  const currentExplanation = getLocalizedText(currentExercise?.explanation, i18n.language);

  const handleClose = () => {
    navigate("/");
  };

  const handleContinue = () => {
    if (currentIndex + 1 < exercises.length) {
      setCurrentIndex(currentIndex + 1);
      setGlobalState("awaiting_answer");
    } else {
      navigate("/result");
    }
  };

  const handleRetry = () => {
    setGlobalState("awaiting_answer");
  };

  const handleStartLesson = () => {
    setHasStarted(true);
  };

  if (!hasStarted) {
    return (
      <div
        data-screen="lesson-start"
        data-testid="lesson-start-screen"
        className="flex min-h-[100dvh] flex-col bg-background"
      >
        <header className="flex items-center justify-between px-4 py-6 w-full max-w-md mx-auto">
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 transition-colors p-2 -ml-2 rounded-full hover:bg-gray-100 min-w-[48px] min-h-[48px] flex items-center justify-center"
            aria-label={t("lesson.close")}
          >
            <X size={28} strokeWidth={2.5} />
          </button>
        </header>
        <main className="flex flex-1 flex-col justify-center px-6 py-10 w-full max-w-md mx-auto gap-6">
          <p className="text-xs font-semibold text-primary uppercase tracking-[0.02em]">
            {t("lesson.start.overline")}
          </p>
          <h1 className="text-[34px] leading-tight font-extrabold text-foreground">
            {t("lesson.start.title")}
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            {t("lesson.start.description")}
          </p>
          <section className="rounded-2xl border border-border bg-white px-4 py-5 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground">{t("lesson.start.todayLabel")}</p>
            <p className="mt-2 text-base font-semibold text-foreground">{t("lesson.start.todayPhrase")}</p>
          </section>
          <section className="rounded-2xl border border-border bg-white px-4 py-5 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.02em]">
              {t("lesson.start.estimatedTimeLabel")}
            </p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {t("lesson.start.estimatedTime")}
            </p>
          </section>
          <MascotBubble mood="calm" message={t("lesson.start.mascotMessage")} />
          <p className="text-sm text-muted-foreground">{t("lesson.start.hint")}</p>
          <Button3D
            onClick={handleStartLesson}
            fullWidth
            size="lg"
            className="mt-auto pb-[env(safe-area-inset-bottom)]"
            aria-label={t("lesson.start.startButton")}
          >
            {t("lesson.start.startButton")}
          </Button3D>
        </main>
      </div>
    );
  }

  if (!currentExercise) return null;

  return (
    <div data-screen="lesson" data-exercise-id={currentExercise.id} className="flex flex-col min-h-[100dvh] bg-background pb-32">
      <header className="flex items-center gap-4 px-4 py-6 w-full max-w-md mx-auto">
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600 transition-colors p-2 -ml-2 rounded-full hover:bg-gray-100 min-w-[48px] min-h-[48px] flex items-center justify-center"
          aria-label={t("lesson.close")}
        >
          <X size={28} strokeWidth={2.5} />
        </button>
        <ProgressBar
          value={currentIndex + 1}
          max={exercises.length}
          className="flex-1"
        />
      </header>

      <main className="flex flex-col flex-1 w-full max-w-md mx-auto px-4 mt-2">
        <ExerciseRenderer
          exercise={currentExercise}
          globalState={globalState}
          setGlobalState={setGlobalState}
          onComplete={handleContinue}
        />
      </main>

      {globalState === "correct_feedback" && (
        <FeedbackTray
          variant="correct"
          title={t("feedback.correct.title")}
          body={currentExplanation}
          primaryActionLabel={t("feedback.continue")}
          onPrimaryAction={handleContinue}
        />
      )}

      {globalState === "incorrect_feedback" && (
        <FeedbackTray
          variant="incorrect"
          title={t("feedback.incorrect.title")}
          body={currentExplanation}
          primaryActionLabel={t("feedback.continue")}
          onPrimaryAction={handleContinue}
        />
      )}

      {globalState === "hint_feedback" && (
        <FeedbackTray
          variant="hint"
          title={t("feedback.incorrect.title")}
          body={t("feedback.incorrect.retry")}
          primaryActionLabel={t("feedback.incorrect.retry")}
          onPrimaryAction={handleRetry}
        />
      )}
    </div>
  );
}
