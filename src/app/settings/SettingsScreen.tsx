import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Globe,
  ArrowLeft,
  Link2,
  Download,
  Trash2,
  Shield,
  Settings2,
  Volume2,
  Zap,
} from "lucide-react";
import { Button3D } from "@/components/Button3D";
import {
  captureHaruTelemetry,
  flushHaruTelemetry,
} from "@/features/analytics/client";
import { getOrCreateInstallationId } from "@/features/analytics/identity";
import { clearCognitiveRoutineResults } from "@/features/cognitive/cognitiveRoutineStorage";
import { clearHaruAdminUsageRecords } from "@/features/lessons/haruAdminUsageRecordStorage";
import { clearHaruDemoSessions } from "@/features/lessons/haruDemoSessionStorage";
import { clearMemoryCards } from "@/features/memory/memoryCardStorage";
import { clearSttJobsByTargetKind } from "@/features/speech/sttJobQueue";
import { applyHaruConsentChange } from "@/features/profile/haruPrivacyControls";
import {
  getHaruConsent,
  getHaruConsentRevision,
  type HaruConsentPermissions,
} from "@/features/profile/haruConsentStorage";
import {
  clearHaruEnrollment,
  getHaruEnrollment,
  redeemHaruParticipantCode,
  type HaruEnrollment,
} from "@/features/profile/haruEnrollment";
import {
  fetchHaruRemoteExport,
  getHaruRemoteDeletionStatus,
  requestHaruRemoteDeletion,
  submitHaruConsentReceipt,
} from "@/features/profile/haruDataApi";
import {
  downloadHaruLocalDataExport,
  downloadHaruRemoteDataExport,
} from "@/features/profile/haruDataExport";
import { clearHaruLocalParticipantData } from "@/features/profile/haruDataDeletion";
import {
  clearPendingHaruRemoteDeletion,
  getPendingHaruRemoteDeletion,
  savePendingHaruRemoteDeletion,
} from "@/features/profile/haruRemoteDeletionTracker";
import {
  getLearnerProfile,
  saveLearnerProfile,
  setSoundFeedbackEnabled,
} from "@/features/profile/learnerProfileStorage";
import {
  playInteractionCue,
  stopInteractionCue,
} from "@/hooks/interactionFeedback";
import {
  getRuntimeMarketConfig,
  isDeploymentLanguageLocked,
} from "@/config/market";

const CONSENT_TELEMETRY_CATEGORY = {
  usageAnalytics: "usage_analytics",
  voiceRecording: "voice_capture",
  sttProcessing: "stt_processing",
  transcriptStorage: "transcript_storage",
  audioStorage: "audio_storage",
  longitudinalUsageStorage: "longitudinal_activity",
  personalizedQuestionUse: "personalization",
  familySharing: "family_sharing",
} as const;

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const languageLocked = isDeploymentLanguageLocked();
  const marketConfig = getRuntimeMarketConfig();
  const [autoStart, setAutoStart] = useState(
    () => getLearnerProfile().autoStartTodayRoutine,
  );
  const [soundFeedback, setSoundFeedback] = useState(
    () => getLearnerProfile().soundFeedbackEnabled,
  );
  const [isDeletingCognitiveData, setIsDeletingCognitiveData] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState<"success" | "error" | null>(null);
  const [isDeletingMemoryCards, setIsDeletingMemoryCards] = useState(false);
  const [memoryDeletionStatus, setMemoryDeletionStatus] = useState<
    "success" | "error" | null
  >(null);
  const [consent, setConsent] = useState(getHaruConsent);
  const [updatingConsent, setUpdatingConsent] = useState<
    keyof HaruConsentPermissions | null
  >(null);
  const [privacyStatus, setPrivacyStatus] = useState<"success" | "error" | null>(null);
  const [participantCode, setParticipantCode] = useState("");
  const [enrollment, setEnrollment] = useState<HaruEnrollment | null>(() =>
    getHaruEnrollment(marketConfig.market),
  );
  const [enrollmentStatus, setEnrollmentStatus] = useState<
    "connecting" | "invalid" | "error" | null
  >(null);
  const [exportStatus, setExportStatus] = useState<
    "running" | "success" | "partial" | "error" | null
  >(null);
  const [deleteAllArmed, setDeleteAllArmed] = useState(false);
  const [deleteAllStatus, setDeleteAllStatus] = useState<
    "running" | "success" | "completed" | "local" | "partial" | "error" | null
  >(null);

  useEffect(() => {
    if (!enrollment) return;
    let disposed = false;
    let retryTimer: number | undefined;
    const checkDeletionStatus = async () => {
      const pending = getPendingHaruRemoteDeletion(marketConfig.market);
      if (!pending) return;
      const remote = await getHaruRemoteDeletionStatus(pending.requestId, {
        market: marketConfig.market,
      });
      if (disposed) return;
      if (!remote) {
        retryTimer = window.setTimeout(checkDeletionStatus, 5_000);
        return;
      }
      if (remote.status === "completed") {
        const trackingCleared = clearPendingHaruRemoteDeletion(marketConfig.market);
        const enrollmentCleared = clearHaruEnrollment(marketConfig.market);
        if (trackingCleared && enrollmentCleared) {
          setEnrollment(null);
          setDeleteAllStatus("completed");
        } else {
          setDeleteAllStatus("partial");
        }
        return;
      }
      if (remote.status === "failed") {
        setDeleteAllStatus("partial");
        return;
      }
      setDeleteAllStatus("success");
      retryTimer = window.setTimeout(checkDeletionStatus, 5_000);
    };
    void checkDeletionStatus();
    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [enrollment, marketConfig.market]);

  const toggleAutoStart = (next: boolean) => {
    if (!saveLearnerProfile({ autoStartTodayRoutine: next })) return;
    setAutoStart(next);
    void captureHaruTelemetry("setting_changed", {
      settingId: "auto_start",
      valueCode: next ? "enabled" : "disabled",
    });
  };

  const toggleSoundFeedback = (next: boolean) => {
    if (!setSoundFeedbackEnabled(next)) {
      return;
    }
    setSoundFeedback(next);
    void captureHaruTelemetry("setting_changed", {
      settingId: "sound_feedback",
      valueCode: next ? "enabled" : "disabled",
    });
    if (next) {
      void playInteractionCue("select");
    } else {
      stopInteractionCue();
    }
  };

  const handleLanguageChange = (lng: string) => {
    if (languageLocked) return;
    i18n.changeLanguage(lng);
    localStorage.setItem("memoryGardenLang", lng);
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleClearCognitiveData = async () => {
    if (isDeletingCognitiveData) return;
    setIsDeletingCognitiveData(true);
    setDeletionStatus(null);
    let deletionFailed = false;
    try {
      await clearHaruAdminUsageRecords();
    } catch (error) {
      console.error("Failed to delete Haru activity data", error);
      deletionFailed = true;
    }
    try {
      if (!clearHaruDemoSessions()) deletionFailed = true;
    } catch {
      deletionFailed = true;
    }
    try {
      if (!clearCognitiveRoutineResults()) deletionFailed = true;
    } catch {
      deletionFailed = true;
    }
    setDeletionStatus(deletionFailed ? "error" : "success");
    setIsDeletingCognitiveData(false);
  };

  const handleClearMemoryCards = async () => {
    if (isDeletingMemoryCards) return;
    setIsDeletingMemoryCards(true);
    setMemoryDeletionStatus(null);
    try {
      const queueCleared = await clearSttJobsByTargetKind("memory-story");
      const cardsCleared = clearMemoryCards();
      setMemoryDeletionStatus(queueCleared && cardsCleared ? "success" : "error");
    } catch (error) {
      console.error("Failed to delete Haru memory cards", error);
      setMemoryDeletionStatus("error");
    } finally {
      setIsDeletingMemoryCards(false);
    }
  };

  const handleConsentChange = async (key: keyof HaruConsentPermissions) => {
    if (updatingConsent) return;
    setUpdatingConsent(key);
    setPrivacyStatus(null);
    try {
      const next = await applyHaruConsentChange({ [key]: !consent[key] });
      setConsent(next);
      setPrivacyStatus("success");
      void captureHaruTelemetry("consent_changed", {
        category: CONSENT_TELEMETRY_CATEGORY[key],
        granted: next[key],
        source: "settings",
      });
      if (key === "familySharing") {
        void captureHaruTelemetry("share_changed", {
          scope: "report",
          granted: next.familySharing,
        });
      }
    } catch (error) {
      console.error("Failed to update Haru privacy choices", error);
      setConsent(getHaruConsent());
      setPrivacyStatus("error");
    } finally {
      setUpdatingConsent(null);
    }
  };

  const handleParticipantCodeChange = (value: string) => {
    setParticipantCode(
      value
        .toUpperCase()
        .replace(/[^A-Z2-9]/gu, "")
        .slice(0, 8),
    );
    setEnrollmentStatus(null);
  };

  const handleEnrollment = async () => {
    if (enrollmentStatus === "connecting" || enrollment) return;
    setEnrollmentStatus("connecting");
    try {
      const result = await redeemHaruParticipantCode(participantCode, {
        market: marketConfig.market,
        installationId: getOrCreateInstallationId(marketConfig.market),
        consentRevision: getHaruConsentRevision(consent),
      });
      if (result.status === "enrolled") {
        setEnrollment(result);
        setEnrollmentStatus(null);
        await submitHaruConsentReceipt(consent, { market: marketConfig.market });
        return;
      }
      setEnrollmentStatus(result.status === "invalid_code" ? "invalid" : "error");
    } catch {
      setEnrollmentStatus("error");
    }
  };

  const handleExportData = async () => {
    if (exportStatus === "running") return;
    setExportStatus("running");
    await captureHaruTelemetry("export_requested", { scope: "all" });
    await flushHaruTelemetry();
    const localSaved = await downloadHaruLocalDataExport(
      new Date(),
      marketConfig.market,
    );
    let remoteSaved = !enrollment;
    if (enrollment) {
      const remotePayload = await fetchHaruRemoteExport(
        ["profile", "consents", "sessions", "attempts", "memory", "caregiver", "telemetry"],
        { market: marketConfig.market },
      );
      remoteSaved = Boolean(
        remotePayload && downloadHaruRemoteDataExport(remotePayload),
      );
    }
    setExportStatus(
      !localSaved ? "error" : remoteSaved ? "success" : "partial",
    );
  };

  const handleDeleteAllData = async () => {
    if (deleteAllStatus === "running") return;
    if (!deleteAllArmed) {
      setDeleteAllArmed(true);
      setDeleteAllStatus(null);
      return;
    }
    setDeleteAllStatus("running");
    await captureHaruTelemetry("deletion_requested", { scope: "all" });
    await flushHaruTelemetry();

    let remoteQueued = !enrollment;
    if (enrollment) {
      try {
        const requestId = globalThis.crypto?.randomUUID?.();
        if (requestId) {
          const requestedAt = new Date().toISOString();
          const accepted = await requestHaruRemoteDeletion(requestId, ["all"], {
            market: marketConfig.market,
          });
          remoteQueued =
            accepted &&
            savePendingHaruRemoteDeletion({
              requestId,
              market: marketConfig.market,
              requestedAt,
            });
        }
      } catch {
        remoteQueued = false;
      }
    }

    const localResult = await clearHaruLocalParticipantData({
      market: marketConfig.market,
    });
    setDeleteAllArmed(false);
    setDeleteAllStatus(
      !localResult.complete
        ? "error"
        : enrollment
          ? remoteQueued
            ? "success"
            : "partial"
          : "local",
    );
  };

  return (
    <div data-screen="settings" className="flex flex-col min-h-full pb-32 pt-8 px-4 w-full max-w-md mx-auto">
      <header className="flex items-center gap-4 mb-8">
        <button
          onClick={handleBack}
          className="p-3 bg-white rounded-full border-2 border-gray-200 hover:bg-gray-50 active:scale-95 transition-all min-w-[48px] min-h-[48px] flex items-center justify-center"
          aria-label={t("common.back")}
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-3xl font-extrabold text-ink flex items-center gap-3">
          <Settings2 className="w-8 h-8 text-primary-500" />
          {t("navigation.settings")}
        </h1>
      </header>

      {!languageLocked && <section className="bg-white p-6 rounded-3xl border-2 border-gray-200 shadow-sm flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-4">
          <div className="p-2 bg-blue-50 rounded-xl">
            <Globe className="w-6 h-6 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold text-ink">{t("settings.language.title")}</h2>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleLanguageChange("ko")}
            className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all min-h-[56px] ${
              i18n.language === "ko"
                ? "border-primary-500 bg-primary-50"
                : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span className={`text-lg font-bold ${i18n.language === "ko" ? "text-primary-700" : "text-ink"}`}>
              한국어
            </span>
            {i18n.language === "ko" && <div className="w-3 h-3 rounded-full bg-primary-500" />}
          </button>

          <button
            onClick={() => handleLanguageChange("en")}
            className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all min-h-[56px] ${
              i18n.language === "en"
                ? "border-primary-500 bg-primary-50"
                : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span className={`text-lg font-bold ${i18n.language === "en" ? "text-primary-700" : "text-ink"}`}>
              English
            </span>
            {i18n.language === "en" && <div className="w-3 h-3 rounded-full bg-primary-500" />}
          </button>

          <button
            onClick={() => handleLanguageChange("ja")}
            className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all min-h-[56px] ${
              i18n.language === "ja"
                ? "border-primary-500 bg-primary-50"
                : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span className={`text-lg font-bold ${i18n.language === "ja" ? "text-primary-700" : "text-ink"}`}>
              日本語
            </span>
            {i18n.language === "ja" && <div className="w-3 h-3 rounded-full bg-primary-500" />}
          </button>
        </div>
      </section>}

      <section className="bg-white p-6 rounded-3xl border-2 border-gray-200 shadow-sm flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-4">
          <div className="p-2 bg-cyan-50 rounded-xl">
            <Link2 className="w-6 h-6 text-cyan-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">{t("settings.enrollmentTitle")}</h2>
            <p className="mt-1 text-base font-semibold leading-relaxed text-gray-600">
              {t("settings.enrollmentDescription")}
            </p>
          </div>
        </div>
        {enrollment ? (
          <p className="rounded-2xl bg-emerald-50 p-4 text-lg font-bold text-emerald-900" role="status">
            {t("settings.enrollmentConnected")}
          </p>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleEnrollment();
            }}
          >
            <label className="text-lg font-bold text-ink" htmlFor="haru-participant-code">
              {t("settings.enrollmentCodeLabel")}
            </label>
            <input
              id="haru-participant-code"
              value={participantCode}
              onChange={(event) => handleParticipantCodeChange(event.target.value)}
              placeholder={t("settings.enrollmentCodePlaceholder")}
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={8}
              className="min-h-[64px] rounded-2xl border-2 border-gray-300 px-5 text-2xl font-extrabold uppercase tracking-[0.18em] text-ink focus:border-primary-600 focus:outline-none"
            />
            <Button3D
              type="submit"
              disabled={enrollmentStatus === "connecting" || participantCode.length !== 8}
            >
              {t(
                enrollmentStatus === "connecting"
                  ? "settings.enrollmentConnecting"
                  : "settings.enrollmentConnect",
              )}
            </Button3D>
            {(enrollmentStatus === "invalid" || enrollmentStatus === "error") && (
              <p className="text-base font-semibold text-red-700" role="alert">
                {t(
                  enrollmentStatus === "invalid"
                    ? "settings.enrollmentInvalid"
                    : "settings.enrollmentError",
                )}
              </p>
            )}
          </form>
        )}
      </section>

      <section className="bg-white p-6 rounded-3xl border-2 border-gray-200 shadow-sm flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-4">
          <div className="p-2 bg-amber-50 rounded-xl">
            <Zap className="w-6 h-6 text-amber-700" />
          </div>
          <h2 className="text-xl font-bold text-ink">{t("settings.autoStartTitle")}</h2>
        </div>
        <div className="flex gap-3">
          <Button3D
            variant={autoStart ? "primary" : "neutral"}
            className="flex-1"
            onClick={() => toggleAutoStart(true)}
          >
            {t("settings.autoStartOn")}
          </Button3D>
          <Button3D
            variant={!autoStart ? "primary" : "neutral"}
            className="flex-1"
            onClick={() => toggleAutoStart(false)}
          >
            {t("settings.autoStartOff")}
          </Button3D>
        </div>
      </section>

      <section className="bg-white p-6 rounded-3xl border-2 border-gray-200 shadow-sm flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-4">
          <div className="p-2 bg-violet-50 rounded-xl">
            <Volume2 className="w-6 h-6 text-violet-700" />
          </div>
          <h2 className="text-xl font-bold text-ink">
            {t("settings.accessibilityTitle")}
          </h2>
        </div>
        <div className="flex items-center justify-between gap-4 py-2">
          <span className="text-lg font-bold leading-snug text-ink">
            {t("settings.soundFeedback")}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={soundFeedback}
            aria-label={t("settings.soundFeedback")}
            onClick={() => toggleSoundFeedback(!soundFeedback)}
            className={`min-h-[56px] min-w-[112px] rounded-2xl border-2 px-4 text-base font-extrabold transition active:scale-95 ${
              soundFeedback
                ? "border-violet-700 bg-violet-100 text-violet-950"
                : "border-gray-400 bg-gray-100 text-gray-800"
            }`}
          >
            {t(
              soundFeedback
                ? "settings.soundFeedbackOn"
                : "settings.soundFeedbackOff",
            )}
          </button>
        </div>
      </section>

      <section className="bg-white p-6 rounded-3xl border-2 border-gray-200 shadow-sm flex flex-col gap-4 mb-6">
        <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-4">
          <div className="p-2 bg-emerald-50 rounded-xl">
            <Shield className="w-6 h-6 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">{t("settings.privacyTitle")}</h2>
            <p className="mt-1 text-base font-semibold leading-relaxed text-gray-600">
              {t("settings.privacyDescription")}
            </p>
          </div>
        </div>

        {(
          [
            ["usageAnalytics", "settings.usageAnalyticsConsent"],
            ["voiceRecording", "settings.voiceRecordingConsent"],
            ["sttProcessing", "settings.sttProcessingConsent"],
            ["transcriptStorage", "settings.transcriptStorageConsent"],
            ["audioStorage", "settings.audioStorageConsent"],
            ["longitudinalUsageStorage", "settings.longitudinalConsent"],
            ["personalizedQuestionUse", "settings.personalizationConsent"],
            ["familySharing", "settings.familySharingConsent"],
          ] as const
        ).map(([key, labelKey]) => (
          <div key={key} className="flex items-center justify-between gap-4 py-2">
            <span className="text-lg font-bold leading-snug text-ink">{t(labelKey)}</span>
            <button
              type="button"
              role="switch"
              aria-checked={consent[key]}
              aria-label={t(labelKey)}
              disabled={updatingConsent !== null}
              onClick={() => handleConsentChange(key)}
              className={`min-h-[56px] min-w-[112px] rounded-2xl border-2 px-4 text-base font-extrabold transition active:scale-95 disabled:cursor-wait disabled:opacity-60 ${
                consent[key]
                  ? "border-emerald-700 bg-emerald-100 text-emerald-950"
                  : "border-gray-400 bg-gray-100 text-gray-800"
              }`}
            >
              {updatingConsent === key
                ? t("settings.privacySaving")
                : t(consent[key] ? "settings.privacyOn" : "settings.privacyOff")}
            </button>
          </div>
        ))}
        <p className="rounded-2xl bg-amber-50 p-4 text-base font-semibold leading-relaxed text-amber-950">
          {t("settings.longitudinalConsentWarning")}
        </p>
        {privacyStatus && (
          <p
            className={`text-base font-semibold ${privacyStatus === "success" ? "text-green-700" : "text-red-600"}`}
            role={privacyStatus === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {t(
              privacyStatus === "success"
                ? "settings.privacyUpdateSuccess"
                : "settings.privacyUpdateError",
            )}
          </p>
        )}
      </section>

      <section className="bg-white p-6 rounded-3xl border-2 border-gray-200 shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-4">
          <div className="p-2 bg-red-50 rounded-xl">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-ink">{t("settings.dataManagement")}</h2>
        </div>

        <Button3D
          variant="neutral"
          className="flex justify-between items-center"
          disabled={exportStatus === "running"}
          onClick={() => void handleExportData()}
        >
          {t(
            exportStatus === "running"
              ? "settings.exportingData"
              : "settings.exportData",
          )}{" "}
          <Download size={20} />
        </Button3D>
        {exportStatus && exportStatus !== "running" && (
          <p
            className={`text-base font-semibold ${exportStatus === "error" ? "text-red-600" : exportStatus === "partial" ? "text-amber-800" : "text-green-700"}`}
            role={exportStatus === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {t(
              exportStatus === "success"
                ? "settings.exportDataSuccess"
                : exportStatus === "partial"
                  ? "settings.exportDataPartial"
                  : "settings.exportDataError",
            )}
          </p>
        )}

        <Button3D
          variant="neutral"
          className="flex justify-between items-center text-red-500"
          disabled={isDeletingMemoryCards}
          onClick={handleClearMemoryCards}
        >
          {t(
            isDeletingMemoryCards
              ? "settings.deletingMemoryCards"
              : "settings.deleteMemoryCards",
          )}{" "}
          <Trash2 size={20} />
        </Button3D>
        {memoryDeletionStatus && (
          <p
            className={`text-base font-semibold ${memoryDeletionStatus === "success" ? "text-green-700" : "text-red-600"}`}
            role={memoryDeletionStatus === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {t(
              memoryDeletionStatus === "success"
                ? "settings.deleteMemoryCardsSuccess"
                : "settings.deleteMemoryCardsError",
            )}
          </p>
        )}

        <Button3D
          variant="neutral"
          className="flex justify-between items-center text-red-500 mt-2"
          disabled={isDeletingCognitiveData}
          onClick={handleClearCognitiveData}
        >
          {t(
            isDeletingCognitiveData
              ? "settings.deletingCognitiveData"
              : "settings.deleteCognitiveData",
          )}{" "}
          <Trash2 size={20} />
        </Button3D>
        {deletionStatus && (
          <p
            className={`text-base font-semibold ${deletionStatus === "success" ? "text-green-700" : "text-red-600"}`}
            role={deletionStatus === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {t(
              deletionStatus === "success"
                ? "settings.deleteCognitiveDataSuccess"
                : "settings.deleteCognitiveDataError",
            )}
          </p>
        )}

        <div className="mt-3 rounded-2xl border-2 border-red-200 bg-red-50 p-4">
          <p className="mb-3 text-base font-semibold leading-relaxed text-red-950">
            {t("settings.deleteAllDataWarning")}
          </p>
          <Button3D
            variant="neutral"
            className="flex w-full justify-between items-center text-red-700"
            disabled={deleteAllStatus === "running"}
            onClick={() => void handleDeleteAllData()}
          >
            {t(
              deleteAllStatus === "running"
                ? "settings.deletingAllData"
                : deleteAllArmed
                  ? "settings.deleteAllDataConfirm"
                  : "settings.deleteAllData",
            )}{" "}
            <Trash2 size={20} />
          </Button3D>
        </div>
        {deleteAllStatus && deleteAllStatus !== "running" && (
          <p
            className={`text-base font-semibold ${deleteAllStatus === "error" ? "text-red-600" : deleteAllStatus === "partial" ? "text-amber-800" : "text-green-700"}`}
            role={deleteAllStatus === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {t(
              deleteAllStatus === "success"
                ? "settings.deleteAllDataSuccess"
                : deleteAllStatus === "completed"
                  ? "settings.deleteAllDataCompleted"
                : deleteAllStatus === "local"
                  ? "settings.deleteAllDataLocalSuccess"
                  : deleteAllStatus === "partial"
                    ? "settings.deleteAllDataPartial"
                    : "settings.deleteAllDataError",
            )}
          </p>
        )}
      </section>
    </div>
  );
}
