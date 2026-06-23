import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { MascotBubble } from "../../components/MascotBubble";
import { Button3D } from "../../components/Button3D";
import { getDailyRoutinePlan } from "../../data/dailyRoutinePlan";

export default function HomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const todayPlan = getDailyRoutinePlan();

  const handleContinue = () => {
    navigate("/lesson");
  };

  return (
    <div data-screen="home" className="flex flex-col items-center justify-center min-h-full py-8 px-4 w-full max-w-md mx-auto">
      <div className="w-full bg-primary-700 rounded-2xl p-6 shadow-card border-2 border-amber-800 mb-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-col gap-2">
          <span className="text-primary-100 font-bold text-sm tracking-wide uppercase">
            {t("home.unitLabel")}
          </span>
          <h1 className="text-2xl font-extrabold text-white">
            {t("home.unitTitle")}
          </h1>
          <p className="text-base font-semibold text-primary-100">
            {t("home.todayRoutineName", { name: t(todayPlan.nameKey) })}
          </p>
        </div>
        <div className="absolute right-[-20px] bottom-[-20px] w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      <div className="mb-8 w-full">
        <MascotBubble
          mood="encouraging"
          message={t("home.mascotGreeting")}
        />
      </div>

      <div className="fixed bottom-[96px] left-0 right-0 px-4 w-full max-w-md mx-auto z-30 pointer-events-none">
        <div className="pointer-events-auto">
          <Button3D variant="primary" size="xl" fullWidth onClick={handleContinue}>
            {t("home.continueButton")}
          </Button3D>
        </div>
      </div>
    </div>
  );
}
