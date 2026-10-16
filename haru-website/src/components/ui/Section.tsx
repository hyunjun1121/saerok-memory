import type { ReactNode } from "react";

interface SectionProps {
  id: string;
  tone?: "white" | "soft";
  center?: boolean;
  eyebrow: string;
  title: ReactNode;
  sub?: string;
  children: ReactNode;
}

export function Section({ id, tone = "white", center, eyebrow, title, sub, children }: SectionProps) {
  return (
    <section id={id} className={`hw-section${tone === "soft" ? " hw-section--soft" : ""}`}>
      <div className="hw-container">
        <div className={`hw-section-head${center ? " hw-section-head--center" : ""}`} data-reveal>
          <span className="hw-eyebrow">{eyebrow}</span>
          <h2 className="hw-h2">{title}</h2>
          {sub ? <p className="hw-sub">{sub}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}
