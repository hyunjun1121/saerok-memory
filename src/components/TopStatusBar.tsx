import { twMerge } from "tailwind-merge";
import { Flame, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export interface TopStatusBarProps {
  streak: number;
  gardenPoints: number;
  className?: string;
}

export function TopStatusBar({ streak, gardenPoints, className }: TopStatusBarProps) {
  const { t, i18n } = useTranslation();

  const getLogo = () => {
    switch (i18n.language) {
      case "ja":
        return <img src="/assets/haru/logo_ja_hiragana.png" alt={t("appTitle")} className="h-9 max-w-[150px] object-contain" />;
      case "ko":
        return <img src="/assets/haru/logo_ko.png" alt={t("appTitle")} className="h-9 max-w-[150px] object-contain" />;
      default:
        return (
          <div className="flex items-center gap-2">
            <img src="/assets/haru/app_icon.png" alt={t("appTitle")} className="h-8 w-auto" />
            <span className="text-xl font-bold text-primary-800">{t("appTitle")}</span>
          </div>
        );
    }
  };

  return (
    <header
      className={twMerge(
        "sticky top-0 z-40 mx-auto flex h-16 w-full max-w-md items-center justify-between border-x border-b border-gray-200 bg-white/80 px-4 backdrop-blur-md",
        className
      )}
    >
      <div className="flex items-center">
        {getLogo()}
      </div>

      <div className="flex gap-4 sm:gap-6 items-center">
        <div
          className="flex items-center gap-1.5"
          aria-label={t("topbar.streakAria", { streak, defaultValue: "연속 참여 {{streak}}일" })}
        >
          <Flame className="w-5 h-5 text-orange-500 fill-orange-500" strokeWidth={2} aria-hidden="true" />
          <span className="text-xl font-extrabold text-orange-600">{streak}</span>
        </div>
        <div
          className="flex items-center gap-1.5"
          aria-label={t("topbar.gardenAria", { points: gardenPoints, defaultValue: "모은 물방울 {{points}}개" })}
        >
          <img src="/assets/haru/water_drop.png" alt="" aria-hidden="true" className="w-5 h-5 object-contain" />
          <span className="text-xl font-extrabold text-blue-600">{gardenPoints}</span>
        </div>
      </div>

      <Link
        to="/settings"
        className="p-2 -mr-2 rounded-full text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors flex items-center justify-center min-w-[48px] min-h-[48px]"
        aria-label={t("navigation.settings")}
      >
        <Settings className="w-6 h-6" strokeWidth={2} />
      </Link>
    </header>
  );
}
