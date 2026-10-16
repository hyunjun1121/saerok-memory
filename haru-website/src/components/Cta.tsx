import { ArrowUpRight, Globe, Mail, Phone, User } from "lucide-react";
import { siteCopy } from "@/content/copy";

export function Cta() {
  const cta = siteCopy.cta;
  return (
    <section id="contact" className="hw-section">
      <div className="hw-container">
        <div className="hw-cta-panel" data-reveal>
          <span className="hw-eyebrow">{cta.eyebrow}</span>
          <h2>{cta.title}</h2>
          <p className="hw-sub">{cta.sub}</p>
          <div className="hw-cta__actions">
            <a
              className="hw-btn hw-btn--primary hw-btn--lg"
              href={siteCopy.meta.demoUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {cta.primaryCta}
              <ArrowUpRight size={18} strokeWidth={2.5} aria-hidden />
            </a>
            <a className="hw-btn hw-btn--ghost hw-btn--lg" href={`mailto:${cta.contactEmail}`}>
              {cta.secondaryCta}
            </a>
          </div>
          <div className="hw-contact">
            <span>
              <User size={15} aria-hidden />
              {cta.contactRep}
            </span>
            <span>
              <Mail size={15} aria-hidden />
              <a href={`mailto:${cta.contactEmail}`}>{cta.contactEmail}</a>
            </span>
            <span>
              <Phone size={15} aria-hidden />
              {cta.contactPhone}
            </span>
            <span>
              <Globe size={15} aria-hidden />
              <a href={cta.contactLinkedinUrl} target="_blank" rel="noopener noreferrer">
                {cta.contactLinkedin}
              </a>
            </span>
          </div>
          <img className="hw-cta__mascot" src={cta.mascotSrc} alt={cta.mascotAlt} aria-hidden />
        </div>
      </div>
    </section>
  );
}
