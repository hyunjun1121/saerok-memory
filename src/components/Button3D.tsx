import React from "react";
import { twMerge } from "tailwind-merge";

export interface Button3DProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "neutral" | "disabled";
  size?: "md" | "lg" | "xl";
  pressed?: boolean;
  fullWidth?: boolean;
}

export function Button3D({
  variant = "primary",
  size = "lg",
  pressed = false,
  fullWidth = false,
  disabled = false,
  children,
  className,
  ...props
}: Button3DProps) {
  const isActuallyDisabled = disabled || variant === "disabled";

  const baseClasses =
    "relative inline-flex items-center justify-center font-bold transition-all active:translate-y-1 active:shadow-none min-h-[56px] select-none";

  const sizeClasses = {
    md: "px-4 py-2 text-md rounded-xl",
    lg: "px-6 py-4 text-lg rounded-2xl",
    xl: "px-8 py-5 text-xl rounded-2xl",
  };

  const variantClasses = {
    primary:
      "border-2 border-primary-700 bg-primary-500 text-white shadow-[0_5px_0_var(--color-primary-700)] hover:bg-primary-400",
    secondary:
      "border-2 border-blue-600 bg-blue-500 text-white shadow-[0_5px_0_var(--color-blue-600)] hover:bg-blue-400",
    danger:
      "border-2 border-red-600 bg-red-500 text-white shadow-[0_5px_0_var(--color-red-600)] hover:bg-red-400",
    neutral:
      "border-2 border-gray-300 bg-white text-ink shadow-[0_5px_0_var(--color-border)] hover:bg-gray-50",
    disabled:
      "border-2 border-gray-300 bg-gray-200 text-gray-500 shadow-none translate-y-1 pointer-events-none cursor-not-allowed",
  };

  return (
    <button
      disabled={isActuallyDisabled}
      className={twMerge(
        baseClasses,
        sizeClasses[size],
        variantClasses[isActuallyDisabled ? "disabled" : variant],
        fullWidth ? "w-full" : "",
        pressed && !isActuallyDisabled ? "translate-y-1 shadow-none" : "",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
