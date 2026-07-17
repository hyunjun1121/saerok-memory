import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Globe, ArrowLeft, Trash2, Shield, Settings2, Zap } from "lucide-react";
import { Button3D } from "@/components/Button3D";
import { clearCognitiveRoutineResults } from "@/features/cognitive/cognitiveRoutineStorage";
import { clearHaruAdminUsageRecords } from "@/features/lessons/haruAdminUsageRecordStorage";
import { clearHaruDemoSessions } from "@/features/lessons/haruDemoSessionStorage";
import { getLearnerProfile, saveLearnerProfile } from "@/features/profile/learnerProfileStorage";

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [autoStart, setAutoStart] = useState(
    () => getLearnerProfile().autoStartTodayRoutine,
  );
  const [isDeletingCognitiveData, setIsDeletingCognitiveData] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState<"success" | "error" | null>(null);

  const toggleAutoStart = (next: boolean) => {
    saveLearnerProfile({ autoStartTodayRoutine: next });
    setAutoStart(next);
  };

  const handleLanguageChange = (lng: string) => {
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
    try {
      await clearHaruAdminUsageRecords();
      clearHaruDemoSessions();
      clearCognitiveRoutineResults();
      setDeletionStatus("success");
    } catch (error) {
      console.error("Failed to delete Haru activity data", error);
      setDeletionStatus("error");
    } finally {
      setIsDeletingCognitiveData(false);
    }
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

      <section className="bg-white p-6 rounded-3xl border-2 border-gray-200 shadow-sm flex flex-col gap-4 mb-6">
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

      <section className="bg-white p-6 rounded-3xl border-2 border-gray-200 shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-4">
          <div className="p-2 bg-red-50 rounded-xl">
            <Shield className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-ink">{t("settings.dataManagement")}</h2>
        </div>

        <Button3D variant="neutral" className="flex justify-between items-center text-red-500" onClick={() => localStorage.removeItem("memoryCards")}>
          {t("settings.deleteMemoryCards")} <Trash2 size={20} />
        </Button3D>

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
      </section>
    </div>
  );
}
