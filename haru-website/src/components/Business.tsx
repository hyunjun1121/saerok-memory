import { HeartHandshake } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { siteCopy } from "@/content/copy";

export function Business() {
  const business = siteCopy.business;
  return (
    <Section id="business" eyebrow={business.eyebrow} title={business.title} sub={business.sub}>
      <h3 className="hw-pill-title">{business.targetsTitle}</h3>
      <div className="hw-pills" data-reveal>
        {business.targets.map((target) => (
          <span key={target} className="hw-pill">
            {target}
          </span>
        ))}
      </div>

      <div className="hw-market" data-reveal>
        {business.market.map((stat) => (
          <div key={stat.value} className="hw-market__stat">
            <div className="hw-market__value">{stat.value}</div>
            <div className="hw-market__label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="hw-mission" data-reveal>
        <HeartHandshake size={24} strokeWidth={2.2} aria-hidden />
        <div>
          <strong>{business.missionTitle}</strong>
          <p>{business.missionBody}</p>
        </div>
      </div>

      <div className="hw-partners" data-reveal>
        <h3>{business.partnersTitle}</h3>
        <div className="hw-partners__logos">
          {business.partners.map((partner) => (
            <img key={partner.src} src={partner.src} alt={partner.alt} loading="lazy" />
          ))}
        </div>
        <p className="hw-partners__caption">{business.partnersCaption}</p>
        <p className="hw-partners__note">{business.partnersNote}</p>
      </div>
    </Section>
  );
}
