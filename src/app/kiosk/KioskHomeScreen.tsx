import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sprout } from "lucide-react";
import { Button3D } from "@/components/Button3D";
import { getDailyRoutinePlan } from "@/data/dailyRoutinePlan";
import { useKioskControls } from "@/features/kiosk/useKioskControls";

// Welfare-center kiosk / tablet home (SP-10). One screen, one primary action,
// very large text and tap targets. Anonymous/local-demo only: no personal
// account or data accumulation until an explicit login/card flow is added.
export default function KioskHomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const todayPlan = getDailyRoutinePlan();

  const startRoutine = () => {
    navigate("/lesson");
  };

  useKioskControls({ onPrimary: startRoutine });

  return (
    <div
      data-screen="kiosk"
      className="flex min-h-[100dvh] w-full max-w-4xl mx-auto flex-col items-center justify-center gap-10 bg-background-warm px-8 py-10"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <Sprout className="h-16 w-16 text-primary-600" aria-hidden="true" />
        <h1 className="text-[40px] leading-tight font-extrabold text-ink">
          {t("home.unitTitle")}
        </h1>
        <p className="text-2xl font-bold text-primary-700">
          {t("home.todayRoutineName", { name: t(todayPlan.nameKey) })}
        </p>
      </div>

      <p className="max-w-xl text-center text-2xl font-semibold leading-relaxed text-gray-600">
        {t("lesson.start.description")}
      </p>

      <Button3D
        variant="primary"
        size="xl"
        fullWidth
        onClick={startRoutine}
        className="min-h-[96px] text-3xl"
        aria-label={t("routine.startButton")}
      >
        {t("routine.startButton")}
      </Button3D>

      <p className="text-base font-medium text-gray-400">
        {t("family.demoModeNote")}
      </p>
    </div>
  );
}
