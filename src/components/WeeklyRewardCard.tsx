import { useTranslation } from "react-i18next";
import { Award } from "lucide-react";

export interface WeeklyRewardCardProps {
  completedDays: number;
  className?: string;
}

// Non-competitive weekly participation card (SP-07). Celebrates "keeping it
// going" rather than any score. Never ranks the learner against others.
export function WeeklyRewardCard({ completedDays, className }: WeeklyRewardCardProps) {
  const { t } = useTranslation();

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
      <p className="text-base font-medium leading-relaxed text-amber-800">
        {t("weekly.catalogNote")}
      </p>
    </section>
  );
}
