import { ClipboardList, Phone, Smartphone } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { siteCopy } from "@/content/copy";

const ACTOR_ICONS = [Phone, Smartphone, ClipboardList];

export function Problem() {
  const problem = siteCopy.problem;
  return (
    <Section id="problem" tone="soft" eyebrow={problem.eyebrow} title={problem.title} sub={problem.sub}>
      <div className="hw-actor-grid" data-reveal>
        {problem.actors.map((actor, index) => {
          const Icon = ACTOR_ICONS[index] ?? Phone;
          return (
            <article key={actor.title} className="hw-actor-card">
              <span className="hw-actor-card__icon">
                <Icon size={22} strokeWidth={2.2} aria-hidden />
              </span>
              <h3>{actor.title}</h3>
              <p>{actor.body}</p>
            </article>
          );
        })}
      </div>

      <div className="hw-stat-band" data-reveal>
        {problem.stats.map((stat) => (
          <div key={stat.value} className="hw-stat">
            <div className="hw-stat__value">{stat.value}</div>
            <div className="hw-stat__label">{stat.label}</div>
            <div className="hw-stat__source">{stat.source}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}
