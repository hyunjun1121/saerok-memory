import { ArrowDown, Building2, HeartHandshake, Stethoscope, User } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { siteCopy } from "@/content/copy";

const AXIS_ICONS = [User, HeartHandshake, Building2, Stethoscope];
const AXIS_MODIFIERS = ["a", "b", "c", "d"];

export function Solution() {
  const solution = siteCopy.solution;
  return (
    <Section id="how" eyebrow={solution.eyebrow} title={solution.title} sub={solution.sub}>
      <div className="hw-axis-grid" data-reveal>
        {solution.axes.map((axis, index) => {
          const Icon = AXIS_ICONS[index] ?? User;
          return (
            <article key={axis.title} className={`hw-axis-card hw-axis-card--${AXIS_MODIFIERS[index]}`}>
              <span className="hw-axis-card__icon">
                <Icon size={21} strokeWidth={2.2} aria-hidden />
              </span>
              <h3>{axis.title}</h3>
              <p>{axis.body}</p>
            </article>
          );
        })}
      </div>

      <div className="hw-loop-wrap">
        <div className="hw-panel" data-reveal>
          <h3 className="hw-panel__title">{solution.loopTitle}</h3>
          <div className="hw-loop">
            {solution.loop.map((node, index) => (
              <div key={node} className="hw-loop__inner">
                <div className="hw-loop__node">
                  <span className="hw-loop__num">{index + 1}</span>
                  {node}
                </div>
                {index < solution.loop.length - 1 ? (
                  <span className="hw-loop__arrow">
                    <ArrowDown size={16} strokeWidth={2.4} aria-hidden />
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="hw-panel" data-reveal>
          <h3 className="hw-panel__title">{solution.rulesTitle}</h3>
          <div className="hw-rules">
            {solution.rules.map((rule, index) => (
              <div key={rule} className="hw-rules__step">
                <span className="hw-rules__num">{index + 1}</span>
                {rule}
              </div>
            ))}
            <p className="hw-rules__note">{solution.rulesNote}</p>
          </div>
        </div>
      </div>
    </Section>
  );
}
