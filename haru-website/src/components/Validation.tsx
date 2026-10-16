import { ArrowRight, FileCheck2 } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { siteCopy } from "@/content/copy";

/** 로드맵에서 '현재' 마일스톤으로 강조할 항목 (2026-09 기준). */
const CURRENT_ROADMAP_INDEX = 1;

export function Validation() {
  const validation = siteCopy.validation;
  return (
    <Section
      id="validation"
      tone="soft"
      eyebrow={validation.eyebrow}
      title={validation.title}
      sub={validation.sub}
    >
      <div className="hw-validation-grid">
        <div className="hw-panel hw-panel--soft" data-reveal>
          <h3 className="hw-panel__title">{validation.beforeAfterTitle}</h3>
          <div className="hw-ba">
            {validation.beforeAfter.map((row) => (
              <div key={row.before} className="hw-ba__row">
                <span className="hw-ba__before">{row.before}</span>
                <span className="hw-ba__arrow">
                  <ArrowRight size={17} strokeWidth={2.5} aria-hidden />
                </span>
                <span className="hw-ba__after">{row.after}</span>
              </div>
            ))}
          </div>
          <p className="hw-ba__note">{validation.beforeAfterNote}</p>
        </div>

        <div className="hw-readiness" data-reveal>
          {validation.readiness.map((chip) => (
            <div key={chip.label} className="hw-ready-chip">
              <FileCheck2 size={20} strokeWidth={2.2} aria-hidden />
              <div>
                <strong>{chip.label}</strong>
                <span>{chip.note}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="hw-roadmap-wrap" data-reveal>
        <h3>{validation.roadmapTitle}</h3>
        <div className="hw-roadmap">
          {validation.roadmap.map((item, index) => (
            <div
              key={item.date}
              className={`hw-roadmap__item${index === CURRENT_ROADMAP_INDEX ? " hw-roadmap__item--current" : ""}`}
            >
              <div className="hw-roadmap__date">{item.date}</div>
              <div className="hw-roadmap__title">{item.title}</div>
              <p className="hw-roadmap__body">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
