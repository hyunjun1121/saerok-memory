import { Check } from "lucide-react";
import type { ButtonSlot } from "@/features/input/types";

export type ChoiceTone = "red" | "yellow" | "green" | "blue";

export interface ChoiceCardProps {
  slot: ButtonSlot;
  badge: "A" | "B" | "C" | "D";
  label: string;
  tone: ChoiceTone;
  selected: boolean;
  confirmed?: boolean;
  disabled?: boolean;
  order?: number;
}

export function ChoiceCard({
  slot,
  badge,
  label,
  tone,
  selected,
  confirmed = false,
  disabled = false,
  order,
}: ChoiceCardProps) {
  return (
    <div
      className={`choice-card choice-card--${tone} ${selected ? "is-selected" : ""} ${confirmed ? "is-confirmed" : ""} ${disabled ? "is-disabled" : ""}`}
      role="button"
      aria-pressed={selected || confirmed}
      aria-disabled={disabled}
      data-slot={slot}
    >
      <span className="choice-card__badge">{badge}</span>
      {order ? <span className="choice-card__order">{order}</span> : null}
      <span className="choice-card__label">{label}</span>
      {(selected || confirmed) && !order ? <Check className="choice-card__check" aria-hidden="true" /> : null}
    </div>
  );
}
