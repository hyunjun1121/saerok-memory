import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button3D } from "../../components/Button3D";
import { TreePine, Flame, Droplets } from "lucide-react";
import { useGamification } from "../../features/gamification/useGamification";

export default function ResultScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { streakState, gardenState, completeSession } = useGamification();
  const hasCompleted = useRef(false);

  useEffect(() => {
    if (!hasCompleted.current) {
      completeSession();
      hasCompleted.current = true;
    }
  }, [completeSession]);

  const handleFinish = () => {
    navigate("/");
  };

  return (
    <div data-screen="result" className="flex flex-col items-center justify-between min-h-[100dvh] pt-12 pb-8 px-6 bg-primary-50">
      <div className="flex flex-col items-center gap-6 w-full max-w-md mt-8">
        <h1 className="text-4xl font-extrabold text-primary-800 text-center drop-shadow-sm">
          {t("result.title")}
        </h1>

        <div className="relative w-48 h-48 flex items-center justify-center bg-white rounded-full border-4 border-primary-200 shadow-xl my-6">
          <div className="absolute inset-0 rounded-full animate-pulseSlow bg-primary-100 opacity-50" />
          <TreePine className="w-24 h-24 text-primary-500 z-10" strokeWidth={2} />
        </div>
      </div>

      <div className="flex w-full max-w-md gap-4 mt-4">
        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-white rounded-2xl border-2 border-orange-200 shadow-sm">
          <Flame className="w-10 h-10 text-orange-500 fill-orange-500 mb-2" />
          <span className="text-xl font-bold text-ink">
            {t("result.streak", { streak: streakState.currentStreak || 1 })}
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-white rounded-2xl border-2 border-blue-200 shadow-sm">
          <Droplets className="w-10 h-10 text-blue-500 fill-blue-500 mb-2" />
          <span className="text-xl font-bold text-ink text-center">
            {t("result.points", { points: gardenState.waterDrops || 1 })}
          </span>
        </div>
      </div>

      <div className="w-full max-w-md mt-auto pt-8">
        <Button3D variant="primary" fullWidth size="xl" onClick={handleFinish}>
          {t("result.done")}
        </Button3D>
      </div>
    </div>
  );
}
