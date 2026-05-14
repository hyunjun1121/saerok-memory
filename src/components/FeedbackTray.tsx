import React from "react";
import { twMerge } from "tailwind-merge";
import { Button3D } from "./Button3D";
import { CheckCircle2, XCircle, Info } from "lucide-react";

export interface FeedbackTrayProps {
  variant: "correct" | "incorrect" | "hint" | "memory" | "neutral";
  title: string;
  body?: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export function FeedbackTray({
  variant,
  title,
  body,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
}: FeedbackTrayProps) {
  const config = {
    correct: {
      bg: "bg-primary-50",
      text: "text-primary-800",
      icon: <CheckCircle2 className="text-primary-500 w-8 h-8" strokeWidth={2.5} />,
      buttonVariant: "primary" as const,
    },
    incorrect: {
      bg: "bg-red-50",
      text: "text-red-800",
      icon: <XCircle className="text-red-500 w-8 h-8" strokeWidth={2.5} />,
      buttonVariant: "danger" as const,
    },
    hint: {
      bg: "bg-yellow-50",
      text: "text-yellow-800",
      icon: <Info className="text-yellow-500 w-8 h-8" strokeWidth={2.5} />,
      buttonVariant: "secondary" as const,
    },
    memory: {
      bg: "bg-blue-50",
      text: "text-blue-800",
      icon: <CheckCircle2 className="text-blue-500 w-8 h-8" strokeWidth={2.5} />,
      buttonVariant: "secondary" as const,
    },
    neutral: {
      bg: "bg-white border-t border-gray-200",
      text: "text-ink",
      icon: null,
      buttonVariant: "primary" as const,
    },
  }[variant];

  return (
    <div
      className={twMerge(
        "fixed bottom-0 left-0 right-0 w-full animate-slideUpFade px-4 pb-8 pt-6 sm:px-6 z-50",
        config.bg,
        className
      )}
    >
      <div className="max-w-md mx-auto flex flex-col gap-4">
        <div className="flex items-start gap-3">
          {config.icon && <div className="mt-0.5 shrink-0">{config.icon}</div>}
          <div className="flex flex-col gap-1">
            <h3 className={twMerge("text-2xl font-extrabold tracking-tight", config.text)}>
              {title}
            </h3>
            {body && <p className={twMerge("text-lg font-medium", config.text)}>{body}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-2 sm:flex-row">
          <Button3D
            variant={config.buttonVariant}
            onClick={onPrimaryAction}
            fullWidth
          >
            {primaryActionLabel}
          </Button3D>

          {secondaryActionLabel && onSecondaryAction && (
            <Button3D
              variant="neutral"
              onClick={onSecondaryAction}
              fullWidth
            >
              {secondaryActionLabel}
            </Button3D>
          )}
        </div>
      </div>
    </div>
  );
}
