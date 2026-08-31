import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button3D } from "@/components/Button3D";
import {
  buildHaruParticipant,
  type Status,
} from "@/app/connect/counselor/counselorData";
import { useHaruDemoSessions } from "@/features/lessons/useHaruDemoSessions";
import { getLocalizedText } from "@/utils/localizedText";
import { captureHaruTelemetry } from "@/features/analytics/client";

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
      <h2 className="mb-4 text-base font-extrabold tracking-tight text-slate-700">{title}</h2>
      {children}
    </section>
  );
}

function statusChip(status: Status, labels: Record<Status, string>) {
  const map: Record<Status, string> = {
    done: "bg-teal-100 text-teal-800",
    partial: "bg-amber-100 text-amber-800",
    none: "bg-gray-100 text-gray-600",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-sm font-extrabold ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function CounselorAppScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const sessions = useHaruDemoSessions();
  const participant = buildHaruParticipant(sessions);
  const participantName = getLocalizedText(participant.name, i18n.language);

  useEffect(() => {
    void captureHaruTelemetry("report_viewed", {
      reportId: "counselor-roster",
      role: "counselor",
      sectionId: "week-summary",
    });
  }, []);

  const statusLabels: Record<Status, string> = {
    done: t("counselor.statusDone"),
    partial: t("counselor.statusPartial"),
    none: t("counselor.statusNone"),
  };

  return (
    <div data-screen="counselor-app" className="min-h-[100dvh] bg-slate-50 px-5 py-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <span className="text-sm font-extrabold uppercase tracking-wide text-teal-700">
            {t("counselor.appBadge")}
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900">{t("counselor.title")}</h1>
          <p className="text-base font-bold text-slate-600">{t("counselor.subtitle")}</p>
        </header>

        <Panel title={t("counselor.sectionWeekSummary")}>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-teal-50 px-3 py-4 text-center">
              <p className="font-mono text-3xl font-extrabold tabular-nums text-teal-800">
                {participant.completedSessions}/{participant.expectedSessions}
              </p>
              <p className="mt-1 text-sm font-bold text-teal-800/80">
                {t("counselor.metricSessions")}
              </p>
            </div>
            <div className="rounded-2xl bg-blue-50 px-3 py-4 text-center">
              <p className="font-mono text-3xl font-extrabold tabular-nums text-blue-800">
                {participant.activityCount}
              </p>
              <p className="mt-1 text-sm font-bold text-blue-800/80">
                {t("counselor.metricActivities")}
              </p>
            </div>
            <div className="rounded-2xl bg-violet-50 px-3 py-4 text-center">
              <p className="font-mono text-3xl font-extrabold tabular-nums text-violet-800">
                {participant.voiceRecords}
              </p>
              <p className="mt-1 text-sm font-bold text-violet-800/80">
                {t("counselor.metricVoice")}
              </p>
            </div>
          </div>
        </Panel>

        <Panel title={t("counselor.sectionPersonalization")}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-amber-50 px-4 py-4 text-center">
              <p className="font-mono text-3xl font-extrabold tabular-nums text-amber-900">
                {participant.profileBasedQuestions}
              </p>
              <p className="mt-1 text-sm font-bold text-amber-800">
                {t("counselor.profileBased")}
              </p>
            </div>
            <div className="rounded-2xl bg-indigo-50 px-4 py-4 text-center">
              <p className="font-mono text-3xl font-extrabold tabular-nums text-indigo-900">
                {participant.priorResponseQuestions}
              </p>
              <p className="mt-1 text-sm font-bold text-indigo-800">
                {t("counselor.priorBased")}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm font-bold leading-relaxed text-slate-500">
            {t("counselor.personalizationNote")}
          </p>
        </Panel>

        <Panel title={t("counselor.sectionRoster")}>
          <button
            type="button"
            onClick={() => navigate(`/connect/counselor/participant/${participant.id}`)}
            className="flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-4 text-left transition-colors hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <span>
              <span className="block text-xl font-extrabold text-slate-900">{participantName}</span>
              <span className="mt-1 block text-sm font-bold text-slate-500">
                {t("counselor.personaMeta", {
                  age: participant.age,
                  location: getLocalizedText(participant.residence, i18n.language),
                })}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              {statusChip(participant.status, statusLabels)}
              <span className="text-2xl font-extrabold leading-none text-slate-400" aria-hidden>
                ›
              </span>
            </span>
          </button>
        </Panel>

        <Panel title={t("counselor.sectionWeekly")}>
          <div className="grid grid-cols-7 gap-2">
            {participant.dailyRecords.map((record) => (
              <div key={record.day} className="flex min-w-0 flex-col items-center gap-2">
                <div className="flex h-24 w-full items-end overflow-hidden rounded-xl bg-slate-100">
                  <div
                    className="w-full rounded-xl bg-teal-500"
                    style={{
                      height: `${(record.activitiesCompleted / record.activitiesExpected) * 100}%`,
                    }}
                    title={t("counselor.dayActivityTitle", {
                      completed: record.activitiesCompleted,
                      expected: record.activitiesExpected,
                    })}
                  />
                </div>
                <span className="text-sm font-extrabold text-slate-600">
                  {t(`counselor.${record.weekdayKey}`)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold leading-relaxed text-amber-900">
            {participant.hasLiveRecords
              ? t("counselor.weekObservation", {
                  completed: participant.completedSessions,
                  activities: participant.activityCount,
                  differences:
                    participant.evaluatedActivities - participant.expectedMatches,
                })
              : t("counselor.weekObservationEmpty")}
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
          {t("counselor.back")}
        </Button3D>
      </div>
    </div>
  );
}
