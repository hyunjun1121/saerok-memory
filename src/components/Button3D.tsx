import type { ButtonHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

export interface Button3DProps extends ButtonHTMLAttributes<HTMLButtonElement> {
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
    "relative inline-flex items-center justify-center font-extrabold tracking-tight transition-all active:translate-y-1 active:shadow-none min-h-[60px] select-none";

  const sizeClasses = {
    md: "px-5 py-3 text-lg rounded-xl min-h-[60px]",
    lg: "px-6 py-4 text-xl rounded-2xl min-h-[68px]",
    xl: "px-8 py-5 text-2xl rounded-2xl min-h-[80px]",
  };

  const variantClasses = {
    primary:
      "border-2 border-amber-800 bg-amber-700 text-white shadow-[0_5px_0_var(--color-amber-800)] hover:brightness-95",
    secondary:
      "border-2 border-ink bg-[var(--color-surface-warm)] text-ink shadow-[0_5px_0_var(--color-ink)] hover:bg-amber-50",
    danger:
      "border-2 border-[#a8281f] bg-red-600 text-white shadow-[0_5px_0_#a8281f] hover:brightness-95",
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
