import { useTranslation } from "react-i18next";
import { Award, Check } from "lucide-react";
import {
  REWARD_CATALOG,
  getWeeklyRewardState,
} from "../features/gamification/weeklyRewards";

export interface WeeklyRewardCardProps {
  completedDays: number;
  className?: string;
}

// Non-competitive weekly participation card (SP-07/SP-08). Celebrates "keeping it
// going" rather than any score. Never ranks the learner against others. The
// catalog surfaces structure only; physical fulfillment is up to the operator.
export function WeeklyRewardCard({ completedDays, className }: WeeklyRewardCardProps) {
  const { t } = useTranslation();
  const claimedIds = getWeeklyRewardState().claimedRewardIds;

  const shareBragCard = () => {
    const text = t("weekly.bragCard", { count: completedDays });
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text).catch(() => {});
    }
  };

  return (
    <section
      className={`flex flex-col gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 ${className ?? ""}`}
      aria-label={t("weekly.title")}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-white p-2.5 text-amber-600 shadow-sm">
          <Award className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-ink">{t("weekly.title")}</h2>
          <p className="text-base font-semibold leading-relaxed text-amber-900">
            {t("weekly.completedDays", { count: completedDays })}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-amber-300 bg-amber-100 p-3">
        <span className="text-base font-bold text-amber-900">
          {t("weekly.bragCard", { count: completedDays })}
        </span>
        <button
          type="button"
          className="min-h-[48px] rounded-xl border-2 border-amber-400 bg-white px-4 text-sm font-bold text-amber-900 active:scale-[0.97]"
          onClick={shareBragCard}
        >
          {t("weekly.bragCardShare")}
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {REWARD_CATALOG.map((item) => {
          const claimed = claimedIds.includes(item.id);
          return (
            <li
              key={item.id}
              className="flex items-start gap-2 rounded-xl border-2 border-amber-200 bg-white p-3"
            >
              <div className="mt-0.5 shrink-0 text-amber-600">
                {claimed ? (
                  <Check className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Award className="h-5 w-5" aria-hidden="true" />
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-base font-bold text-ink">{t(item.titleKey)}</span>
                <span className="text-sm font-medium leading-relaxed text-amber-900">
                  {t(item.descriptionKey)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-base font-medium leading-relaxed text-amber-800">
        {t("weekly.catalogNote")}
      </p>
    </section>
  );
}
