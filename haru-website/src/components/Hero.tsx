import { ArrowUpRight } from "lucide-react";
import { siteCopy } from "@/content/copy";

export function Hero() {
  const hero = siteCopy.hero;
  return (
    <section id="hero" className="hw-hero hw-section">
      <div className="hw-container hw-hero__inner">
        <div className="hw-hero__copy" data-reveal>
          <span className="hw-hero__eyebrow">{hero.eyebrow}</span>
          <h1 className="hw-hero__title">
            <em>{hero.titleLine1}</em>
            <br />
            {hero.titleLine2}
          </h1>
          <p className="hw-hero__sub">{hero.sub}</p>
          <p className="hw-hero__note">{hero.nameNote}</p>
          <div className="hw-hero__badges">
            {hero.badges.map((badge) => (
              <span key={badge} className="hw-badge">
                {badge}
              </span>
            ))}
          </div>
          <div className="hw-hero__cta">
            <a
              className="hw-btn hw-btn--primary hw-btn--lg"
              href={siteCopy.meta.demoUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {hero.primaryCta}
              <ArrowUpRight size={18} strokeWidth={2.5} aria-hidden />
            </a>
            <a className="hw-btn hw-btn--ghost hw-btn--lg" href="#contact">
              {hero.secondaryCta}
            </a>
          </div>
          <p className="hw-hero__trust">{hero.trust}</p>
        </div>

        <div className="hw-hero__visual" data-reveal>
          <img className="hw-hero__photo" src={hero.visualSrc} alt={hero.visualAlt} />
          <div className="hw-hero__screen-card">
            <img src={hero.screenCardSrc} alt={hero.screenCardAlt} />
          </div>
          <p className="hw-hero__visual-caption">{hero.visualCaption}</p>
        </div>
      </div>
    </section>
  );
}
