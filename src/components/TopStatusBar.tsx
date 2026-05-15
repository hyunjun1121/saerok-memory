import { twMerge } from "tailwind-merge";
import { Flame, Droplets, Settings } from "lucide-react";
import { Link } from "react-router-dom";

export interface TopStatusBarProps {
  streak: number;
  gardenPoints: number;
  className?: string;
}

export function TopStatusBar({ streak, gardenPoints, className }: TopStatusBarProps) {
  return (
    <header
      className={twMerge(
        "sticky top-0 z-40 flex items-center justify-between w-full h-16 px-4 bg-white/80 backdrop-blur-md border-b border-gray-200",
        className
      )}
    >
      <div className="flex gap-4 sm:gap-6 items-center">
        <div className="flex items-center gap-2">
          <Flame className="w-6 h-6 text-orange-500 fill-orange-500" strokeWidth={2} />
          <span className="text-lg font-bold text-orange-600">{streak}</span>
        </div>
        <div className="flex items-center gap-2">
          <Droplets className="w-6 h-6 text-blue-500 fill-blue-500" strokeWidth={2} />
          <span className="text-lg font-bold text-blue-600">{gardenPoints}</span>
        </div>
      </div>

      <Link
        to="/settings"
        className="p-2 -mr-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center min-w-[48px] min-h-[48px]"
        aria-label="Settings"
      >
        <Settings className="w-6 h-6" strokeWidth={2} />
      </Link>
    </header>
  );
}
