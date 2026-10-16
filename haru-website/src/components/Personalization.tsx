import { Lock, Mic } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { siteCopy } from "@/content/copy";

export function Personalization() {
  const tech = siteCopy.personalization;
  return (
    <Section id="tech" eyebrow={tech.eyebrow} title={tech.title} sub={tech.sub}>
      <div className="hw-personal-grid">
        <div className="hw-chat" data-reveal>
          <h3 className="hw-chat__title">{tech.chatTitle}</h3>
          <div className="hw-chat__row">
            <div className="hw-bubble hw-bubble--user">
              <span className="hw-bubble__label">{tech.chatDayLabel}</span>
              {tech.chatUser}
            </div>
          </div>
          <div className="hw-chat__row hw-chat__row--next">
            <img src={tech.chatMascotSrc} alt={tech.chatMascotAlt} />
            <div className="hw-bubble hw-bubble--haru">
              <span className="hw-bubble__label">{tech.chatNextLabel}</span>
              {tech.chatHaru}
            </div>
          </div>
          <p className="hw-chat__note">{tech.chatNote}</p>
        </div>

        <div className="hw-tech-cards">
          <article className="hw-tech-card" data-reveal>
            <span className="hw-tech-card__icon">
              <Mic size={22} strokeWidth={2.2} aria-hidden />
            </span>
            <div>
              <h3>{tech.voiceTitle}</h3>
              <p>{tech.voiceBody}</p>
            </div>
          </article>
          <article className="hw-tech-card hw-tech-card--green" data-reveal>
            <span className="hw-tech-card__icon">
              <Lock size={22} strokeWidth={2.2} aria-hidden />
            </span>
            <div>
              <h3>{tech.privacyTitle}</h3>
              <p>{tech.privacyBody}</p>
            </div>
          </article>
        </div>
      </div>
    </Section>
  );
}
