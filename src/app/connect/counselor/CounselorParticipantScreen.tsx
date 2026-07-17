import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button3D } from "@/components/Button3D";
import { getParticipant } from "@/app/connect/counselor/counselorData";
import { useHaruDemoSessions } from "@/features/lessons/useHaruDemoSessions";
import { getLocalizedText } from "@/utils/localizedText";

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
      <h2 className="mb-4 text-base font-extrabold tracking-tight text-slate-700">{title}</h2>
      {children}
    </section>
  );
}

export default function CounselorParticipantScreen() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const sessions = useHaruDemoSessions();
  const participant = getParticipant(Number(id), sessions);

  if (!participant) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center">
        <p className="text-lg font-extrabold text-slate-700">{t("counselor.participantNotFound")}</p>
        <Button3D variant="neutral" size="lg" onClick={() => navigate("/connect/counselor")}>
          {t("counselor.backToList")}
        </Button3D>
      </div>
    );
  }

  const participantName = getLocalizedText(participant.name, i18n.language);
  const statusLabelKey =
    participant.status === "done"
      ? "statusDone"
      : participant.status === "partial"
        ? "statusPartial"
        : "statusNone";
  const supportTitleKey =
    participant.status === "done"
      ? "supportSignalSteady"
      : participant.status === "partial"
        ? "supportSignalCollecting"
        : "supportSignalEmpty";
  const supportBodyKey =
    participant.status === "done"
      ? "supportSignalBody"
      : participant.status === "partial"
        ? "supportSignalCollectingBody"
        : "supportSignalEmptyBody";

  return (
    <div
      data-screen="counselor-participant"
      className="min-h-[100dvh] bg-slate-50 px-5 py-8"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="min-h-12 self-start rounded-xl px-2 text-sm font-extrabold text-teal-700 underline-offset-4 hover:underline"
          >
            ‹ {t("counselor.backToList")}
          </button>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900">{participantName}</h1>
              <p className="mt-1 text-base font-bold text-slate-500">
                {t("counselor.personaMeta", {
                  age: participant.age,
                  location: getLocalizedText(participant.residence, i18n.language),
                })}
              </p>
            </div>
            <span
              className={`rounded-full px-4 py-2 text-sm font-extrabold ${
                participant.status === "done"
                  ? "bg-teal-100 text-teal-800"
                  : participant.status === "partial"
                    ? "bg-amber-100 text-amber-900"
                    : "bg-slate-200 text-slate-600"
              }`}
            >
              {t(`counselor.${statusLabelKey}`)}
            </span>
          </div>
        </header>

        <Panel title={t("counselor.sectionProfileContext")}>
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ["profileResidence", participant.residence],
              ["profileLiving", participant.livingArrangement],
              ["profileHometown", participant.hometown],
              ["profileWork", participant.formerOccupation],
              ["profileSpeech", participant.speechProfileNote],
            ].map(([labelKey, value]) => (
              <div key={labelKey as string} className="rounded-2xl bg-slate-50 px-4 py-3">
                <dt className="text-sm font-bold text-slate-500">
                  {t(`counselor.${labelKey as string}`)}
                </dt>
                <dd className="mt-1 text-base font-extrabold leading-relaxed text-slate-800">
                  {getLocalizedText(value, i18n.language)}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>

        <section
          className={`rounded-3xl border px-5 py-5 ${
            participant.status === "done"
              ? "border-teal-200 bg-teal-50"
              : participant.status === "partial"
                ? "border-amber-200 bg-amber-50"
                : "border-slate-200 bg-slate-100"
          }`}
        >
          <p className="text-sm font-extrabold uppercase tracking-wide text-slate-700">
            {t("counselor.supportSignalTitle")}
          </p>
          <h2 className="mt-2 text-2xl font-extrabold text-slate-950">
            {t(`counselor.${supportTitleKey}`)}
          </h2>
          <p className="mt-2 text-base font-bold leading-relaxed text-slate-800">
            {t(`counselor.${supportBodyKey}`, {
              completed: participant.completedSessions,
              activities: participant.activityCount,
            })}
          </p>
        </section>

        <Panel title={t("counselor.sectionWeekSummary")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 px-3 py-4 text-center">
              <p className="font-mono text-3xl font-extrabold tabular-nums text-slate-900">
                {participant.completedSessions}/{participant.expectedSessions}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                {t("counselor.metricSessions")}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-3 py-4 text-center">
              <p className="font-mono text-3xl font-extrabold tabular-nums text-slate-900">
                {participant.activityCount}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                {t("counselor.metricActivities")}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-3 py-4 text-center">
              <p className="font-mono text-3xl font-extrabold tabular-nums text-slate-900">
                {participant.expectedMatches}/{participant.evaluatedActivities}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                {t("counselor.metricExpectedFlow")}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-3 py-4 text-center">
              <p className="whitespace-nowrap font-mono text-2xl font-extrabold tabular-nums text-slate-900">
                {participant.completedSessions > 0
                  ? t("counselor.durationSeconds", {
                      seconds: participant.averageSessionSeconds.toFixed(1),
                    })
                  : t("counselor.noData")}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                {t("counselor.metricAverageSession")}
              </p>
            </div>
          </div>
        </Panel>

        <Panel title={t("counselor.sectionPersonalization")}>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-amber-50 px-4 py-3">
              <dt className="text-sm font-bold text-amber-800">
                {t("counselor.profileBased")}
              </dt>
              <dd className="mt-1 font-mono text-2xl font-extrabold text-amber-950">
                {participant.profileBasedQuestions}
              </dd>
            </div>
            <div className="rounded-2xl bg-indigo-50 px-4 py-3">
              <dt className="text-sm font-bold text-indigo-800">
                {t("counselor.priorBased")}
              </dt>
              <dd className="mt-1 font-mono text-2xl font-extrabold text-indigo-950">
                {participant.priorResponseQuestions}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-sm font-bold leading-relaxed text-slate-500">
            {t("counselor.personalizationNote")}
          </p>
        </Panel>

        <Panel title={t("counselor.sectionDailyRecords")}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {participant.dailyRecords.map((record) => {
              const hasEvaluation = record.evaluatedActivities > 0;
              const allMatched =
                hasEvaluation && record.expectedMatches === record.evaluatedActivities;
              return (
                <li
                  key={record.day}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <span>
                    <span className="block text-base font-extrabold text-slate-800">
                      {t(`counselor.${record.weekdayKey}`)}
                    </span>
                    <span className="mt-0.5 block text-sm font-bold text-slate-500">
                      {record.sessionSeconds > 0
                        ? t("counselor.dayCompletion", {
                            completed: record.activitiesCompleted,
                            seconds: record.sessionSeconds,
                          })
                        : t("counselor.dayCompletionNoDuration", {
                            completed: record.activitiesCompleted,
                          })}
                    </span>
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-extrabold ${
                      !hasEvaluation
                        ? "bg-slate-200 text-slate-600"
                        : allMatched
                        ? "bg-teal-100 text-teal-800"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {hasEvaluation
                      ? `${t("counselor.expectedMatchShort")} ${record.expectedMatches}/${record.evaluatedActivities}`
                      : t("counselor.noData")}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-sm font-bold leading-relaxed text-slate-500">
            {participant.sequenceEvaluated === 0
              ? t("counselor.insufficientDifferenceNote")
              : participant.sequenceDifferences > 0
                ? t("counselor.singleDifferenceNote", {
                    count: participant.sequenceDifferences,
                  })
                : t("counselor.noDifferenceNote")}
          </p>
        </Panel>

        <Panel title={t("counselor.sectionPracticeAreas")}>
          <ul className="flex flex-col gap-3">
            {participant.practiceAreas.map((area) => {
              const hasEvaluation = area.evaluatedActivities > 0;
              const allMatched =
                hasEvaluation && area.expectedMatches === area.evaluatedActivities;
              return (
                <li key={area.key} className="flex items-center justify-between gap-4">
                  <span className="text-base font-extrabold text-slate-700">
                    {t(`counselor.${area.key}`)}
                  </span>
                  <span
                    className={`font-mono text-base font-extrabold tabular-nums ${
                      !hasEvaluation
                        ? "text-slate-400"
                        : allMatched
                          ? "text-teal-700"
                          : "text-amber-800"
                    }`}
                  >
                    {hasEvaluation
                      ? `${area.expectedMatches}/${area.evaluatedActivities}`
                      : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title={t("counselor.sectionVoiceQuality")}>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-violet-50 px-4 py-3">
              <dt className="text-sm font-bold text-violet-700">{t("counselor.voiceCaptured")}</dt>
              <dd className="mt-1 font-mono text-2xl font-extrabold text-violet-900">
                {participant.voiceRecords}/{participant.expectedSessions}
              </dd>
            </div>
            <div className="rounded-2xl bg-violet-50 px-4 py-3">
              <dt className="text-sm font-bold text-violet-700">{t("counselor.voiceAverage")}</dt>
              <dd className="mt-1 whitespace-nowrap font-mono text-2xl font-extrabold text-violet-900">
                {t("counselor.durationSeconds", {
                  seconds: participant.averageVoiceDurationSeconds.toFixed(1),
                })}
              </dd>
            </div>
            <div className="rounded-2xl bg-violet-50 px-4 py-3">
              <dt className="text-sm font-bold text-violet-700">{t("counselor.sttCompleted")}</dt>
              <dd className="mt-1 font-mono text-2xl font-extrabold text-violet-900">
                {participant.sttCompleted}/{participant.voiceRecords}
              </dd>
            </div>
            <div className="rounded-2xl bg-violet-50 px-4 py-3">
              <dt className="text-sm font-bold text-violet-700">{t("counselor.sttConfidence")}</dt>
              <dd className="mt-1 font-mono text-2xl font-extrabold text-violet-900">
                {participant.sttAverageConfidence === null
                  ? t("counselor.sttUnavailable")
                  : participant.sttAverageConfidence.toFixed(2)}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-sm font-bold leading-relaxed text-slate-500">
            {t("counselor.voiceBaselineNote")}
          </p>
          <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">
            {t("counselor.sttLimitation")}
          </p>
        </Panel>

        <Panel title={t("counselor.sectionPrivacy")}>
          <p className="text-base font-bold leading-relaxed text-slate-700">
            {t("counselor.privacyNoSharing")}
          </p>
        </Panel>

        <p className="rounded-2xl bg-white px-4 py-3 text-sm font-bold leading-relaxed text-slate-500">
          {t("counselor.syntheticDisclaimer")}
        </p>

        <Button3D variant="neutral" size="lg" fullWidth onClick={() => navigate(-1)}>
          {t("counselor.backToList")}
        </Button3D>
      </div>
    </div>
  );
}
