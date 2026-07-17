import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button3D } from "@/components/Button3D";
import { buildHaruParticipant } from "@/app/connect/counselor/counselorData";
import { useHaruDemoSessions } from "@/features/lessons/useHaruDemoSessions";
import { getLocalizedText } from "@/utils/localizedText";

function Section({
  title,
  children,
  tone = "plain",
}: {
  title: string;
  children: ReactNode;
  tone?: "plain" | "warm" | "accent";
}) {
  const surface =
    tone === "accent"
      ? "border-amber-200 bg-amber-100"
      : tone === "warm"
        ? "border-amber-100 bg-amber-50"
        : "border-stone-200 bg-white";

  return (
    <section className={`rounded-3xl border ${surface} px-5 py-5 shadow-sm`}>
      <h2 className="mb-3 text-base font-extrabold tracking-tight text-primary-800">{title}</h2>
      {children}
    </section>
  );
}

export default function CaregiverAppScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const sessions = useHaruDemoSessions();
  const participant = buildHaruParticipant(sessions);
  const participantName = getLocalizedText(participant.name, i18n.language);

  return (
    <div
      data-screen="caregiver-app"
      className="min-h-[100dvh] bg-[var(--color-surface-warm)] px-5 py-8"
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <header className="flex flex-col gap-1">
          <span className="text-sm font-extrabold uppercase tracking-wide text-primary-700">
            {t("caregiver.appBadge")}
          </span>
          <h1 className="text-3xl font-extrabold text-primary-900">{t("caregiver.title")}</h1>
          <p className="text-base font-bold text-ink/80">
            {t("caregiver.personaSubtitle", { name: participantName })}
          </p>
        </header>

        <Section title={t("caregiver.sectionParticipation")}>
          <div className="grid grid-cols-7 gap-2">
            {participant.dailyRecords.map((record) => (
              <div key={record.day} className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-base font-extrabold ${
                    record.status === "done"
                      ? "bg-amber-500 text-white"
                      : record.status === "partial"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-stone-200 text-stone-500"
                  }`}
                  aria-label={t(
                    record.status === "done"
                      ? "caregiver.dayCompleted"
                      : record.status === "partial"
                        ? "caregiver.dayPartial"
                        : "caregiver.dayNone",
                    { day: t(`counselor.${record.weekdayKey}`) },
                  )}
                >
                  {record.status === "done" ? "✓" : record.status === "partial" ? "•" : "–"}
                </span>
                <span className="text-xs font-extrabold text-ink/60">
                  {t(`counselor.${record.weekdayKey}`)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xl font-extrabold leading-snug text-ink">
            {t("caregiver.participationComplete", {
              completed: participant.completedSessions,
              expected: participant.expectedSessions,
            })}
          </p>
          <p className="mt-1 text-base font-bold text-ink/70">
            {t("caregiver.activityCount", { count: participant.activityCount })}
          </p>
          {!participant.hasLiveRecords && (
            <p className="mt-3 rounded-2xl bg-stone-50 px-4 py-3 text-base font-bold text-ink/65">
              {t("caregiver.emptyRecord")}
            </p>
          )}
        </Section>

        <Section title={t("caregiver.sectionWeeklyFlow")} tone="warm">
          <ul className="flex flex-col gap-3 text-base font-bold leading-relaxed text-ink">
            <li className="flex gap-2">
              <span aria-hidden>✓</span>
              <span>{t("caregiver.flowMoodCount", { count: participant.moodResponses })}</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden>✓</span>
              <span>
                {t("caregiver.flowRecallCount", { count: participant.priorRecallResponses })}
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden>✓</span>
              <span>
                {t("caregiver.flowPersonalized", {
                  profileCount: participant.profileBasedQuestions,
                  priorCount: participant.priorResponseQuestions,
                })}
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden>○</span>
              <span>
                {t("caregiver.flowSequenceCount", {
                  evaluated: participant.sequenceEvaluated,
                  differences: participant.sequenceDifferences,
                })}
              </span>
            </li>
          </ul>
        </Section>

        <Section title={t("caregiver.sectionSharing")}>
          <div className="flex items-center justify-between rounded-2xl bg-stone-50 px-4 py-3">
            <span className="text-base font-bold text-ink/70">{t("caregiver.sharedStories")}</span>
            <span className="font-mono text-2xl font-extrabold tabular-nums text-primary-800">
              {participant.shareableMemoryCount}
            </span>
          </div>
          <p className="mt-3 text-base font-bold leading-relaxed text-ink/70">
            {t("caregiver.noSharingConsent")}
          </p>
        </Section>

        <Section title={t("caregiver.sectionConversation")} tone="accent">
          <p className="text-lg font-extrabold leading-relaxed text-ink">
            {t("caregiver.conversationPrompt")}
          </p>
        </Section>

        <Section title={t("caregiver.sectionPrivacy")}>
          <p className="text-base font-bold leading-relaxed text-ink/75">
            {t("caregiver.privacyBody")}
          </p>
        </Section>

        <p className="rounded-2xl bg-white/80 px-4 py-3 text-sm font-bold leading-relaxed text-gray-600">
          {t("caregiver.disclaimer")}
        </p>

        <Button3D variant="neutral" size="lg" fullWidth onClick={() => navigate(-1)}>
          {t("caregiver.back")}
        </Button3D>
      </div>
    </div>
  );
}
