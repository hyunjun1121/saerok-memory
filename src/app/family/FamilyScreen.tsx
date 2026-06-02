import { useState } from "react";
import {
  Activity,
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  FileText,
  HeartHandshake,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button3D } from "../../components/Button3D";
import { getCognitiveRoutineResults } from "../../features/cognitive/cognitiveRoutineStorage";
import { getMemoryCards } from "../../features/memory/memoryCardStorage";
import { twMerge } from "tailwind-merge";
import {
  generateCaregiverCounselorReport,
  type ReportCopyItem,
} from "../../features/family/caregiverReport";
import {
  buildDemoCaregiverObservationRecords,
  buildDemoMemoryCards,
  buildDemoRoutineResults,
} from "../../features/family/demoReportData";
import {
  getCaregiverObservationRecords,
  saveCaregiverObservationRecord,
  type CaregiverObservationDomain,
  type CaregiverObservationResponse,
  type CaregiverObservationResponseMap,
} from "../../features/family/caregiverObservationStorage";

const OBSERVATION_DOMAINS: CaregiverObservationDomain[] = [
  "dailyRoutine",
  "conversation",
  "appointments",
  "navigation",
  "medicationMoney",
  "moodSocial",
  "sleepAppetite",
  "homeSafety",
];

const OBSERVATION_RESPONSES: CaregiverObservationResponse[] = [
  "aboutSame",
  "occasionallyDifferent",
  "oftenDifferent",
  "notSure",
];

export default function FamilyScreen() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<"family" | "counselor">("counselor");
  const [observationResponses, setObservationResponses] =
    useState<CaregiverObservationResponseMap>({});
  const [observationNote, setObservationNote] = useState("");
  const [observationRecords, setObservationRecords] = useState(() => {
    const storedRecords = getCaregiverObservationRecords();
    return storedRecords.length > 0
      ? storedRecords
      : buildDemoCaregiverObservationRecords(i18n.language);
  });

  const storedRoutineResults = getCognitiveRoutineResults();
  const storedMemoryCards = getMemoryCards();
  const routineResults = storedRoutineResults.length > 0 ? storedRoutineResults : buildDemoRoutineResults();
  const memoryCards = storedMemoryCards.length > 0 ? storedMemoryCards : buildDemoMemoryCards(i18n.language);
  const report = generateCaregiverCounselorReport(
    memoryCards,
    routineResults,
    new Date(),
    observationRecords,
  );

  const hasData =
    report.overview.completedRoutines > 0 ||
    report.overview.dueMemoryCount > 0 ||
    report.overview.shareableMemoryCount > 0;
  const latestObservation = observationRecords[0];
  const selectedObservationDomains = OBSERVATION_DOMAINS.filter(
    (domain) => observationResponses[domain] && observationResponses[domain] !== "aboutSame",
  );
  const canSaveObservation =
    selectedObservationDomains.length > 0 || observationNote.trim().length > 0;

  const renderCopy = (item: ReportCopyItem) => {
    const values = Object.fromEntries(
      Object.entries(item.values ?? {}).map(([key, value]) => {
        if (key === "topic") {
          return [
            key,
            t(`family.memoryTopics.${value}`, {
              defaultValue: String(value),
            }),
          ];
        }

        if (typeof value === "string" && value.startsWith("family.")) {
          return [key, t(value)];
        }

        return [key, value];
      }),
    );

    return t(item.key, values);
  };

  const advisoryLevelClass = {
    steady: "border-green-200 bg-green-50 text-green-800",
    watch: "border-yellow-200 bg-yellow-50 text-yellow-800",
    needsConversation: "border-orange-200 bg-orange-50 text-orange-800",
  }[report.advisory.level];

  const advisorySignals = report.advisory.signals.slice(0, 5);
  const advisoryDomainSummaries = report.advisory.domainSummaries
    .filter((summary) => summary.signalCount > 0)
    .slice(0, 4);

  const formatDate = (isoDate?: string) => {
    if (!isoDate) return t("family.report.noPracticeDate");
    return new Intl.DateTimeFormat(i18n.language === "ja" ? "ja-JP" : i18n.language === "en" ? "en-US" : "ko-KR", {
      month: "short",
      day: "numeric",
    }).format(new Date(isoDate));
  };

  const renderObservationDomain = (domain: CaregiverObservationDomain) =>
    t(`family.observation.domains.${domain}`);

  const renderObservationResponse = (response: CaregiverObservationResponse) =>
    t(`family.observation.responses.${response}`);

  const setObservationResponse = (
    domain: CaregiverObservationDomain,
    response: CaregiverObservationResponse,
  ) => {
    setObservationResponses((current) => ({
      ...current,
      [domain]: response,
    }));
  };

  const handleSaveObservation = () => {
    if (!canSaveObservation) {
      return;
    }

    const savedRecord = saveCaregiverObservationRecord({
      domainResponses: observationResponses,
      note: observationNote,
    });

    setObservationRecords((current) => [savedRecord, ...current].slice(0, 20));
    setObservationResponses({});
    setObservationNote("");
  };

  return (
    <div data-screen="family" className="flex min-h-full w-full max-w-md flex-col gap-6 px-4 pb-48 pt-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold text-ink">
          {activeTab === "family" ? t("family.title") : t("family.counselorTitle")}
        </h1>
        <p className="text-lg font-medium text-gray-500">
          {activeTab === "family" ? t("family.subtitle") : t("family.counselorSubtitle")}
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border-2 border-primary-100 bg-white shadow-sm">
        <div className="flex items-center gap-4 p-4">
          <img
            src="/assets/haru/family_connection.png"
            alt=""
            className="h-20 w-20 shrink-0 rounded-2xl object-cover"
          />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-extrabold text-primary-700">
              {t("family.loggedInModeLabel")}
            </span>
            <p className="text-sm font-medium leading-relaxed text-gray-600">
              {t("family.demoModeNote")}
            </p>
          </div>
        </div>
      </section>

      <div className="flex w-full rounded-xl bg-gray-100 p-1" role="tablist" aria-label={t("family.viewTabsLabel")}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "family"}
          onClick={() => setActiveTab("family")}
          className={twMerge(
            "flex-1 rounded-lg py-2 text-center text-sm font-bold transition-colors",
            activeTab === "family"
              ? "bg-white text-primary-600 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          {t("family.tabs.family")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "counselor"}
          onClick={() => setActiveTab("counselor")}
          className={twMerge(
            "flex-1 rounded-lg py-2 text-center text-sm font-bold transition-colors",
            activeTab === "counselor"
              ? "bg-white text-primary-600 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          {t("family.tabs.counselor")}
        </button>
      </div>

      {activeTab === "family" && (
        <>
          <section className="flex flex-col gap-4 rounded-2xl border-2 border-primary-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-primary-50 p-3 text-primary-600">
                <HeartHandshake className="h-7 w-7" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-ink">
                  {t("family.inviteTitle")}
                </h2>
                <p className="text-base font-medium leading-relaxed text-gray-600">
                  {t("family.inviteBody")}
                </p>
              </div>
            </div>

            <Button3D variant="primary" fullWidth>
              <UserPlus className="mr-2 h-5 w-5" />
              {t("family.inviteButton")}
            </Button3D>
          </section>

          <section className="flex flex-col gap-4 rounded-2xl border-2 border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-purple-50 p-3 text-purple-600">
                <Activity className="h-7 w-7" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-ink">
                  {t("family.summaryTitle")}
                </h2>
                {!hasData ? (
                   <p className="text-base font-medium leading-relaxed text-gray-600">
                     {t("family.summaryEmpty")}
                   </p>
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-primary-50 p-3">
                      <CheckCircle2 className="mb-2 h-5 w-5 text-primary-600" />
                      <p className="text-2xl font-extrabold text-ink">{report.routineTrend.completedThisWindow}</p>
                      <p className="text-xs font-bold text-gray-500">{t("family.metrics.thisWeek")}</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-3">
                      <CalendarDays className="mb-2 h-5 w-5 text-blue-600" />
                      <p className="text-base font-extrabold text-ink">{formatDate(report.overview.lastPracticeDate)}</p>
                      <p className="text-xs font-bold text-gray-500">{t("family.metrics.lastPracticeDate")}</p>
                    </div>
                    <div className="rounded-xl bg-yellow-50 p-3">
                      <BookOpen className="mb-2 h-5 w-5 text-yellow-600" />
                      <p className="text-2xl font-extrabold text-ink">{report.dueMemoryCount}</p>
                      <p className="text-xs font-bold text-gray-500">{t("family.metrics.dueReviewCount")}</p>
                    </div>
                    <div className="rounded-xl bg-green-50 p-3">
                      <MessageCircle className="mb-2 h-5 w-5 text-green-600" />
                      <p className="text-2xl font-extrabold text-ink">{report.shareableMemoryCount}</p>
                      <p className="text-xs font-bold text-gray-500">{t("family.metrics.sharedMemoryCount")}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className={twMerge("flex flex-col gap-3 rounded-2xl border-2 p-5 shadow-sm", advisoryLevelClass)}>
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-white/70 p-3">
                <Sparkles className="h-7 w-7" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-ink">
                    {t("family.advisory.title")}
                  </h2>
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-extrabold">
                    {t(`family.advisory.levels.${report.advisory.level}`)}
                  </span>
                </div>
                <p className="text-base font-medium leading-relaxed">
                  {renderCopy(report.advisory.summary)}
                </p>
                <p className="text-sm font-bold">
                  {t(`family.advisory.dataCompleteness.${report.advisory.dataCompleteness}`)}
                </p>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-2xl border-2 border-green-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-green-50 p-3 text-green-600">
                <FileText className="h-7 w-7" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-ink">
                  {t("family.observation.title")}
                </h2>
                <p className="text-base font-medium leading-relaxed text-gray-600">
                  {t("family.observation.body")}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3" aria-label={t("family.observation.domainLabel")}>
              {OBSERVATION_DOMAINS.map((domain) => (
                <div key={domain} className="rounded-2xl border-2 border-gray-100 bg-gray-50 p-3">
                  <p className="mb-2 text-sm font-extrabold text-ink">
                    {renderObservationDomain(domain)}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {OBSERVATION_RESPONSES.map((response) => {
                      const selected = (observationResponses[domain] ?? "aboutSame") === response;

                      return (
                        <button
                          key={response}
                          type="button"
                          aria-pressed={selected}
                          aria-label={`${renderObservationDomain(domain)}: ${renderObservationResponse(response)}`}
                          onClick={() => setObservationResponse(domain, response)}
                          className={twMerge(
                            "min-h-[44px] rounded-xl border-2 px-3 py-2 text-left text-xs font-extrabold transition",
                            selected
                              ? "border-green-500 bg-white text-green-800 shadow-sm"
                              : "border-transparent bg-white/70 text-gray-600 hover:border-green-200",
                          )}
                        >
                          {renderObservationResponse(response)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-medium leading-relaxed text-green-800">
              {t("family.observation.supportNote")}
            </p>

            <label className="flex flex-col gap-2 text-sm font-bold text-gray-700">
              {t("family.observation.noteLabel")}
              <textarea
                value={observationNote}
                onChange={(event) => setObservationNote(event.target.value)}
                rows={3}
                className="min-h-[88px] rounded-2xl border-2 border-gray-200 bg-white p-4 text-base font-bold leading-relaxed text-ink outline-none transition focus:border-green-400"
                placeholder={t("family.observation.notePlaceholder")}
              />
            </label>

            {latestObservation && (
              <div className="rounded-2xl bg-green-50 p-4 text-sm font-medium leading-relaxed text-green-900">
                <p className="font-extrabold">
                  {t("family.observation.latestTitle", {
                    date: formatDate(latestObservation.createdAt),
                  })}
                </p>
                {latestObservation.selectedDomains.length > 0 && (
                  <p className="mt-1">
                    {latestObservation.selectedDomains
                      .map((domain) => {
                        const response = latestObservation.domainResponses[domain];
                        return response
                          ? t("family.observation.latestResponse", {
                              domain: renderObservationDomain(domain),
                              response: renderObservationResponse(response),
                            })
                          : renderObservationDomain(domain);
                      })
                      .join(", ")}
                  </p>
                )}
                {latestObservation.note && <p>{latestObservation.note}</p>}
              </div>
            )}

            <Button3D
              variant={canSaveObservation ? "primary" : "disabled"}
              fullWidth
              onClick={handleSaveObservation}
            >
              {t("family.observation.save")}
            </Button3D>
          </section>

          <section className="flex items-start gap-4 rounded-2xl border-2 border-blue-100 bg-blue-50 p-5">
            <ShieldCheck className="mt-1 h-7 w-7 shrink-0 text-blue-600" />
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold text-blue-900">
                {t("family.privacyTitle")}
              </h2>
              <p className="text-base font-medium leading-relaxed text-blue-800">
                {t("family.privacyBody")}
              </p>
            </div>
          </section>
        </>
      )}

      {activeTab === "counselor" && (
        <>
          <section className="flex flex-col gap-4 rounded-2xl border-2 border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                <FileText className="h-7 w-7" />
              </div>
              <div className="flex flex-col gap-1 w-full">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-ink">
                    {t("family.reportTitle")}
                  </h2>
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-extrabold text-orange-700">
                    {t("family.report.activityBadge")}
                  </span>
                </div>

                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                    <span className="text-gray-600 font-medium">{t("family.counselorPracticeLabel")}</span>
                    <span className="font-bold text-ink">{report.overview.completedRoutines}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                    <span className="text-gray-600 font-medium">{t("family.counselorMemoriesLabel")}</span>
                    <span className="font-bold text-ink">{report.shareableMemoryCount}</span>
                  </div>
                  <div className="flex justify-between items-center pb-1">
                    <span className="text-gray-600 font-medium">{t("family.metrics.participationRate")}</span>
                    <span className="font-bold text-ink">{report.routineTrend.participationRateThisWindow}%</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {latestObservation && (
            <section className="flex flex-col gap-3 rounded-2xl border-2 border-green-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-green-50 p-3 text-green-600">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-ink">
                    {t("family.observation.counselorTitle")}
                  </h2>
                  <p className="text-sm font-medium text-gray-500">
                    {t("family.observation.latestTitle", {
                      date: formatDate(latestObservation.createdAt),
                    })}
                  </p>
                </div>
              </div>
              {latestObservation.selectedDomains.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {latestObservation.selectedDomains.map((domain) => {
                    const response = latestObservation.domainResponses[domain];

                    return (
                      <span
                        key={domain}
                        className="rounded-full bg-green-50 px-3 py-1 text-sm font-extrabold text-green-800"
                      >
                        {response
                          ? t("family.observation.latestResponse", {
                              domain: renderObservationDomain(domain),
                              response: renderObservationResponse(response),
                            })
                          : renderObservationDomain(domain)}
                      </span>
                    );
                  })}
                </div>
              )}
              {latestObservation.note && (
                <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm font-medium leading-relaxed text-gray-700">
                  {latestObservation.note}
                </p>
              )}
            </section>
          )}

          <section className="flex flex-col gap-4 rounded-2xl border-2 border-orange-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-orange-50 p-3 text-orange-600">
                <Sparkles className="h-7 w-7" />
              </div>
              <div className="flex w-full flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-ink">
                    {t("family.advisory.title")}
                  </h2>
                  <span className={twMerge("rounded-full border px-3 py-1 text-xs font-extrabold", advisoryLevelClass)}>
                    {t(`family.advisory.levels.${report.advisory.level}`)}
                  </span>
                </div>
                <p className="text-base font-medium leading-relaxed text-gray-600">
                  {renderCopy(report.advisory.summary)}
                </p>
                <p className="text-sm font-bold text-gray-500">
                  {t(`family.advisory.dataCompleteness.${report.advisory.dataCompleteness}`)}
                </p>
              </div>
            </div>

            {advisoryDomainSummaries.length > 0 && (
              <div className="grid grid-cols-1 gap-2">
                {advisoryDomainSummaries.map((summary) => (
                  <div key={summary.domain} className="rounded-xl bg-orange-50/60 px-3 py-2 text-sm font-medium leading-relaxed text-orange-900">
                    {renderCopy(summary)}
                  </div>
                ))}
              </div>
            )}

            {advisorySignals.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-extrabold text-gray-700">
                  {t("family.advisory.signalTitle")}
                </h3>
                <ul className="space-y-2 text-sm font-medium leading-relaxed text-gray-600">
                  {advisorySignals.map((signal, index) => (
                    <li key={`${signal.key}-${signal.domain}-${index}`} className="rounded-xl bg-gray-50 px-3 py-2">
                      {renderCopy(signal)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-extrabold text-gray-700">
                {t("family.advisory.nextStepsTitle")}
              </h3>
              <ul className="space-y-2 text-sm font-medium leading-relaxed text-gray-600">
                {report.advisory.nextSteps.map((item) => (
                  <li key={item.key} className="rounded-xl bg-blue-50 px-3 py-2">
                    {renderCopy(item)}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border-2 border-primary-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary-50 p-3 text-primary-600">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink">{t("family.trend.title")}</h2>
                <p className="text-sm font-medium leading-relaxed text-gray-600">
                  {renderCopy(report.routineTrend.trendSummaryCopy)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-2xl font-extrabold text-ink">{report.routineTrend.attemptedThisWindow}</p>
                <p className="text-xs font-bold text-gray-500">{t("family.metrics.attemptedThisWeek")}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-2xl font-extrabold text-ink">{report.routineTrend.completedPreviousWindow}</p>
                <p className="text-xs font-bold text-gray-500">{t("family.metrics.completedPreviousWeek")}</p>
              </div>
            </div>
          </section>

          {report.activityHighlights.length > 0 && (
            <section className="flex flex-col gap-3 rounded-2xl border-2 border-teal-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-teal-50 p-3 text-teal-600">
                  <FileText className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-bold text-ink">
                  {t("family.report.activityHighlightsTitle")}
                </h2>
              </div>
              <ul className="space-y-2 text-sm font-medium leading-relaxed text-gray-600">
                {report.activityHighlights.map((item) => (
                  <li key={item.key} className="rounded-xl bg-teal-50/60 px-3 py-2">
                    {renderCopy(item)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-3 rounded-2xl border-2 border-purple-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-purple-50 p-3 text-purple-600">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-ink">{t("family.report.strengthsTitle")}</h2>
            </div>
            <ul className="space-y-2 text-sm font-medium leading-relaxed text-gray-600">
              {report.strengths.map((item) => (
                <li key={item.key} className="rounded-xl bg-purple-50/60 px-3 py-2">
                  {renderCopy(item)}
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-4 rounded-2xl border-2 border-green-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-green-50 p-3 text-green-600">
                <MessageCircle className="h-7 w-7" />
              </div>
              <div className="flex flex-col gap-1 w-full">
                <h2 className="text-xl font-bold text-ink">
                  {t("family.counselorCuesLabel")}
                </h2>

                <ul className="text-base font-medium leading-relaxed text-gray-600 space-y-3 mt-2 list-disc pl-5">
                  {report.conversationCues.map((cue, index) => (
                    <li key={`${cue.key}-${index}`}>{renderCopy(cue)}</li>
                  ))}
                </ul>
                <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm font-medium leading-relaxed text-green-800">
                  {t("family.conversation.noPrivateDetailsNote")}
                </p>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border-2 border-blue-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-ink">{t("family.notesTitle")}</h2>
            <ul className="space-y-2 text-sm font-medium leading-relaxed text-gray-600">
              {report.suggestedNextConversationTopics.map((item, index) => (
                <li key={`${item.key}-${index}`} className="rounded-xl bg-blue-50 px-3 py-2">
                  {renderCopy(item)}
                </li>
              ))}
            </ul>
          </section>

          <section className="flex items-start gap-4 rounded-2xl border-2 border-orange-100 bg-orange-50 p-5">
            <AlertCircle className="mt-1 h-6 w-6 shrink-0 text-orange-600" />
            <div className="flex flex-col gap-1">
              <ul className="space-y-2 text-sm font-medium leading-relaxed text-orange-800">
                {report.safetyDisclaimerCopyKeys.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
