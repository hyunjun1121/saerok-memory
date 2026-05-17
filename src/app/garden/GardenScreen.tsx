import { useTranslation } from "react-i18next";
import { Droplets, Leaf, Flower, Award } from "lucide-react";
import { useGamification } from "../../features/gamification/useGamification";

export default function GardenScreen() {
  const { t } = useTranslation();
  const { gardenState } = useGamification();

  return (
    <div className="flex flex-col min-h-full pb-32 pt-8 px-4 w-full max-w-md mx-auto">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-extrabold text-ink">
          {t("navigation.garden")}
        </h1>
        <p className="text-lg text-gray-500 font-medium">
          {t("garden.subtitle")}
        </p>
      </div>

      <div className="relative w-full aspect-square bg-gradient-to-b from-blue-50 to-primary-100 rounded-3xl border-4 border-white shadow-sm overflow-hidden flex flex-col items-center justify-end pb-8 mb-8">
        <div className="absolute inset-0 bg-primary-100/50 mix-blend-multiply" />
        <img
          src="/assets/haru/garden_scene.png"
          alt="Haru Garden Scene"
          className="absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out scale-[1.02]"
        />

        <div className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur px-4 py-2 rounded-2xl border-2 border-primary-200 shadow-sm flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-500" />
          <span className="font-bold text-primary-800">
            {t("garden.level")} {gardenState.treeLevel || 1}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl border-2 border-blue-100 shadow-sm flex items-center gap-4">
          <div className="bg-blue-50 p-3 rounded-xl">
            <Droplets className="w-6 h-6 text-blue-500 fill-blue-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-ink">{gardenState.waterDrops || 0}</span>
            <span className="text-sm font-semibold text-gray-500">{t("garden.waterDrops")}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border-2 border-green-100 shadow-sm flex items-center gap-4">
          <div className="bg-green-50 p-3 rounded-xl">
            <Leaf className="w-6 h-6 text-green-500 fill-green-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-ink">{gardenState.leaves || 0}</span>
            <span className="text-sm font-semibold text-gray-500">{t("garden.leaves")}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border-2 border-pink-100 shadow-sm flex items-center gap-4 col-span-2">
          <div className="bg-pink-50 p-3 rounded-xl">
            <Flower className="w-6 h-6 text-pink-500 fill-pink-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-ink">{gardenState.flowers || 0}</span>
            <span className="text-sm font-semibold text-gray-500">{t("garden.flowers")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
