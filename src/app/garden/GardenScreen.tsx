import { useTranslation } from "react-i18next";
import { TreePine, Droplets, Leaf, Flower, Award } from "lucide-react";
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
        <div className="absolute top-10 right-10 w-16 h-16 bg-white/40 rounded-full blur-xl" />
        <div className="absolute bottom-20 left-10 w-24 h-24 bg-primary-200/50 rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col items-center">
          <TreePine
            className="text-primary-600 transition-all duration-700 ease-out"
            size={120 + ((gardenState.treeLevel || 1) * 20)}
            strokeWidth={1.5}
            fill="currentColor"
          />
          <div className="w-32 h-4 bg-black/10 rounded-[100%] mt-2 blur-sm" />
        </div>

        <div className="absolute top-4 left-4 bg-white/80 backdrop-blur px-4 py-2 rounded-2xl border-2 border-primary-200 shadow-sm flex items-center gap-2">
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
