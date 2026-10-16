import { Section } from "@/components/ui/Section";
import { siteCopy } from "@/content/copy";

export function Awards() {
  const awards = siteCopy.awards;
  return (
    <Section id="awards" tone="white" eyebrow={awards.eyebrow} title={awards.title} sub={awards.sub}>
      <div className="hw-awards-grid" data-reveal>
        {awards.items.map((item) => (
          <article key={item.title} className="hw-award">
            <div className="hw-award__photo">
              <img src={item.src} alt={item.alt} loading="lazy" />
            </div>
            <div className="hw-award__body">
              <span className="hw-award__result">{item.result}</span>
              <h3 className="hw-award__title">{item.title}</h3>
              <p className="hw-award__text">{item.body}</p>
            </div>
          </article>
        ))}
      </div>
      <p className="hw-awards__now" data-reveal>
        {awards.now}
      </p>
    </Section>
  );
}
