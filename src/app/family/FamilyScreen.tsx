import { HeartHandshake, ShieldCheck, UserPlus, Activity } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button3D } from "../../components/Button3D";
import { getCognitiveRoutineResults } from "../../features/cognitive/cognitiveRoutineStorage";
import { getMemoryCards } from "../../features/memory/memoryCardStorage";

export default function FamilyScreen() {
  const { t } = useTranslation();

  const routineResults = getCognitiveRoutineResults();
  const memoryCards = getMemoryCards();

  const completedRoutines = routineResults.filter(r => r.completed).length;

  const now = new Date().getTime();
  const dueCards = memoryCards.filter(c => new Date(c.reviewState.dueAt).getTime() <= now).length;

  const sharedCards = memoryCards.filter(c => c.shareWithFamily).length;

  const hasData = completedRoutines > 0 || dueCards > 0 || sharedCards > 0;

  return (
    <div data-screen="family" className="flex min-h-full w-full max-w-md flex-col gap-6 px-4 pb-32 pt-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold text-ink">
          {t("family.title")}
        </h1>
        <p className="text-lg font-medium text-gray-500">
          {t("family.subtitle")}
        </p>
      </header>

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
    </div>
  );
}
