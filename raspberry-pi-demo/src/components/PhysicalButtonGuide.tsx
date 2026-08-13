import type { ButtonSlot } from "@/features/input/types";

export interface GuideItem {
  slot: ButtonSlot;
  badge: "A" | "B" | "C" | "D";
  tone: "red" | "yellow" | "green" | "blue";
  label: string;
}

export interface PhysicalButtonGuideProps {
  title: string;
  items: readonly [GuideItem, GuideItem, GuideItem, GuideItem];
  activeSlot?: ButtonSlot | null;
}

export function PhysicalButtonGuide({ title, items, activeSlot }: PhysicalButtonGuideProps) {
  return (
    <aside className="button-guide" aria-label={title}>
      <span className="button-guide__title">{title}</span>
      <div className="button-guide__grid">
        {items.map((item) => (
          <div
            key={item.slot}
            className={`guide-key guide-key--${item.tone} ${activeSlot === item.slot ? "is-active" : ""}`}
          >
            <strong>{item.badge}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
