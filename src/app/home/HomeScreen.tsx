import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { LessonNode, type LessonNodeState } from "../../components/LessonNode";
import { MascotBubble } from "../../components/MascotBubble";
import { Button3D } from "../../components/Button3D";
import { getDailyRoutinePlan } from "../../data/dailyRoutinePlan";

const mockPathNodes = [
  { id: "node_5", state: "locked" as LessonNodeState, position: "center" as const },
  { id: "node_4", state: "family_memory" as LessonNodeState, position: "left" as const },
  { id: "node_3", state: "current" as LessonNodeState, position: "right" as const },
  { id: "node_2", state: "completed" as LessonNodeState, position: "left" as const },
  { id: "node_1", state: "completed" as LessonNodeState, position: "center" as const },
];

export default function HomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const todayPlan = getDailyRoutinePlan();

  const handleNodePress = () => {
    navigate("/lesson");
  };

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

      <section className="mb-8 flex w-full items-start gap-4 rounded-2xl border-2 border-orange-100 bg-white p-5 shadow-sm">
        <div className="rounded-xl bg-orange-50 p-3 text-orange-600">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-extrabold text-ink">
            {t("home.advisoryTitle")}
          </h2>
          <p className="text-sm font-medium leading-relaxed text-gray-600">
            {t("home.advisoryBody")}
          </p>
        </div>
      </section>

      <div className="flex flex-col w-full relative pb-32">
        <div className="absolute top-10 bottom-10 left-1/2 -translate-x-1/2 w-4 bg-gray-200 rounded-full -z-10" />

        {mockPathNodes.map((node) => (
          <LessonNode
            key={node.id}
            id={node.id}
            state={node.state}
            position={node.position}
            onPress={handleNodePress}
          />
        ))}

        <div className="mt-8 mb-4">
          <MascotBubble
            mood="encouraging"
            message={t("home.mascotGreeting")}
          />
        </div>
      </div>

      <div className="fixed bottom-[96px] left-0 right-0 px-4 w-full max-w-md mx-auto z-30 pointer-events-none">
        <div className="pointer-events-auto">
          <Button3D variant="primary" fullWidth onClick={handleContinue}>
            {t("home.continueButton")}
          </Button3D>
        </div>
      </div>
    </div>
  );
}
