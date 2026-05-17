import { useState } from "react";
import { HeartHandshake, ShieldCheck, UserPlus, Activity, BookOpen, MessageCircle, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button3D } from "../../components/Button3D";
import { getCognitiveRoutineResults } from "../../features/cognitive/cognitiveRoutineStorage";
import { getMemoryCards } from "../../features/memory/memoryCardStorage";
import { generateConversationCues } from "../../features/family/conversationCues";
import { twMerge } from "tailwind-merge";

export default function FamilyScreen() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"family" | "counselor">("family");

  const routineResults = getCognitiveRoutineResults();
  const memoryCards = getMemoryCards();
  const conversationCues = generateConversationCues(memoryCards, t);

  const completedRoutines = routineResults?.filter(r => r.completed).length || 0;

  const now = new Date().getTime();
  const dueCards = memoryCards?.filter(c => c.reviewState?.dueAt && new Date(c.reviewState.dueAt).getTime() <= now).length || 0;

  const sharedCards = memoryCards?.filter(c => c.shareWithFamily).length || 0;

  const hasData = completedRoutines > 0 || dueCards > 0 || sharedCards > 0;

  return (
    <div className="flex min-h-full w-full max-w-md flex-col gap-6 px-4 pb-32 pt-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold text-ink">
          {activeTab === "family" ? t("family.title") : t("family.counselorTitle")}
        </h1>
        <p className="text-lg font-medium text-gray-500">
          {activeTab === "family" ? t("family.subtitle") : t("family.counselorSubtitle")}
        </p>
      </header>

      <div className="flex w-full rounded-xl bg-gray-100 p-1">
        <button
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
                   <ul className="text-base font-medium leading-relaxed text-gray-600 space-y-2 mt-2">
                     {completedRoutines > 0 && (
                       <li>{t("family.routinesCompleted", { count: completedRoutines })}</li>
                     )}
                     {dueCards > 0 && (
                       <li>{t("family.dueMemoryCards", { count: dueCards })}</li>
                     )}
                     {sharedCards > 0 && (
                       <li>{t("family.sharedMemoryCards", { count: sharedCards })}</li>
                     )}
                   </ul>
                )}
              </div>
            </div>
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
                <BookOpen className="h-7 w-7" />
              </div>
              <div className="flex flex-col gap-1 w-full">
                <h2 className="text-xl font-bold text-ink">
                  {t("family.counselorActivityLabel")}
                </h2>

                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                    <span className="text-gray-600 font-medium">{t("family.counselorPracticeLabel")}</span>
                    <span className="font-bold text-ink">{completedRoutines}</span>
                  </div>
                  <div className="flex justify-between items-center pb-1">
                    <span className="text-gray-600 font-medium">{t("family.counselorMemoriesLabel")}</span>
                    <span className="font-bold text-ink">{sharedCards}</span>
                  </div>
                </div>
              </div>
            </div>
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
                  {conversationCues.map((cue) => (
                    <li key={cue.id}>{cue.text}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="flex items-start gap-4 rounded-2xl border-2 border-orange-100 bg-orange-50 p-5">
            <AlertCircle className="mt-1 h-6 w-6 shrink-0 text-orange-600" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium leading-relaxed text-orange-800">
                {t("family.counselorDisclaimer")}
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
