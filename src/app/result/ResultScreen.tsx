import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Button3D } from "@/components/Button3D";
import { getHaruWeekPlan } from "@/data/haru7DayExercises";
import { useGamification } from "@/features/gamification/useGamification";
import { getHaruDemoSessions } from "@/features/lessons/haruDemoSessionStorage";
import { parseHaruWeekDay } from "@/features/lessons/sessionBuilder";
import { getLocalizedText } from "@/utils/localizedText";

type ConnectRole = "caregiver" | "counselor";
type ResultLocationState = { completed?: boolean };

// Demo post-lesson screen. The whole "routine summary / garden points /
// reward / report" block is gone — one screen, two big buttons. Tapping either
// reveals a {4}-{4} pairing code the learner reads out. Gamification still
// ticks over silently (completeSession) so Home/Garden reflect progress.
function makePairCode(): string {
  const block = () =>
    Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join("");
  return `${block()}-${block()}`;
}

export default function ResultScreen() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { completeSession } = useGamification();
  const hasCompleted = useRef(false);

  const isFreshCompletion =
    (location.state as ResultLocationState | null)?.completed === true;
  const requestedDay = parseHaruWeekDay(
    new URLSearchParams(location.search).get("day"),
  );
  const hasStoredCompletion = requestedDay
    ? getHaruDemoSessions().some(
        (session) => session.day === requestedDay && session.status === "completed",
      )
    : false;
  const completedDay = requestedDay && (isFreshCompletion || hasStoredCompletion)
    ? requestedDay
    : undefined;
  const completionMessage = completedDay
    ? getLocalizedText(getHaruWeekPlan(completedDay).completionMessage, i18n.language)
    : t("result.encouragement");
  const nextDay = completedDay && completedDay < 7 ? completedDay + 1 : undefined;

  const [revealed, setRevealed] = useState<ConnectRole | null>(null);
  const [codes, setCodes] = useState<Partial<Record<ConnectRole, string>>>({});

  useEffect(() => {
    if (isFreshCompletion && !hasCompleted.current) {
      completeSession();
      hasCompleted.current = true;
    }
  }, [completeSession, isFreshCompletion]);

  const handleReveal = (role: ConnectRole) => {
    setCodes((current) => (current[role] ? current : { ...current, [role]: makePairCode() }));
    setRevealed(role);
  };

  const roleLabel =
    revealed === "caregiver" ? t("result.connect.caregiver") : t("result.connect.counselor");

  return (
    <div
      data-screen="result"
      className="flex min-h-[100dvh] flex-col items-center justify-center px-6 py-10 bg-[var(--color-surface-warm)]"
    >
      {!revealed ? (
        <div className="flex w-full max-w-md flex-col items-center gap-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="text-4xl font-extrabold text-primary-800">
              {t("result.connect.heading")}
            </h1>
            <p className="text-lg font-bold text-ink">{completionMessage}</p>
          </div>

          <div className="flex w-full flex-col gap-5">
            {nextDay && (
              <Button3D
                variant="primary"
                size="xl"
                fullWidth
                onClick={() => navigate(`/lesson?day=${nextDay}`)}
              >
                {t("result.nextDay", { day: nextDay })}
              </Button3D>
            )}
            <Button3D variant="primary" size="xl" fullWidth onClick={() => handleReveal("caregiver")}>
              {t("result.connect.caregiver")}
            </Button3D>
            <Button3D variant="secondary" size="xl" fullWidth onClick={() => handleReveal("counselor")}>
              {t("result.connect.counselor")}
            </Button3D>
          </div>
        </div>
      ) : (
        <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
          <div className="flex flex-col items-center gap-2">
            <span className="text-base font-extrabold uppercase tracking-wide text-primary-600">
              {roleLabel}
            </span>
            <h2 className="text-2xl font-extrabold text-ink">{t("result.connect.codeLabel")}</h2>
          </div>

          <div className="w-full rounded-3xl border-4 border-primary-200 bg-white px-6 py-10 shadow-xl">
            <p
              className="font-mono text-6xl font-extrabold tracking-[0.12em] tabular-nums text-primary-800"
              aria-label={codes[revealed]}
            >
              {codes[revealed]}
            </p>
          </div>

          <p className="text-lg font-bold leading-relaxed text-ink">
            {t("result.connect.codeHint")}
          </p>

          <div className="flex w-full flex-col gap-3">
            <Button3D
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => navigate(`/connect/${revealed}`)}
            >
              {t("result.connect.preview")}
            </Button3D>
            <Button3D variant="primary" size="xl" fullWidth onClick={() => setRevealed(null)}>
              {t("result.done")}
            </Button3D>
          </div>
        </div>
      )}
    </div>
  );
}
