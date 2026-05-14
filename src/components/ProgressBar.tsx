import React from "react";
import { twMerge } from "tailwind-merge";

export interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  className?: string;
}

export function ProgressBar({ value, max, label, className }: ProgressBarProps) {
  const clampedValue = Math.min(Math.max(value, 0), max);
  const percentage = max > 0 ? (clampedValue / max) * 100 : 0;

  return (
    <div className={twMerge("w-full flex flex-col gap-2", className)}>
      {label && (
        <span className="text-sm font-bold text-gray-500">{label}</span>
      )}
      <div className="h-4 w-full rounded-full bg-gray-200 overflow-hidden relative">
        <div
          className="h-full rounded-full bg-primary-500 transition-all duration-300 ease-out absolute left-0 top-0"
          style={{ width: `${percentage}%` }}
        />
        <div
          className="h-1.5 rounded-full bg-white/20 absolute top-1 left-2 transition-all duration-300 ease-out"
          style={{ width: `calc(${percentage}% - 16px)` }}
        />
      </div>
    </div>
  );
}
