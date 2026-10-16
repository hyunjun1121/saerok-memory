import { Check } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { siteCopy } from "@/content/copy";

export function Product() {
  const product = siteCopy.product;
  return (
    <Section id="product" tone="soft" eyebrow={product.eyebrow} title={product.title} sub={product.sub}>
      <div className="hw-product-grid">
        <div className="hw-hardware" data-reveal>
          <h3>{product.hardwareTitle}</h3>
          <div className="hw-hardware__photos">
            <img
              className="hw-hardware__main"
              src={product.hardwarePhotos.main.src}
              alt={product.hardwarePhotos.main.alt}
            />
            <div className="hw-hardware__thumbs">
              {product.hardwarePhotos.thumbs.map((thumb) => (
                <img key={thumb.src} src={thumb.src} alt={thumb.alt} />
              ))}
            </div>
          </div>
          <p className="hw-hardware__caption">{product.hardwareCaption}</p>
        </div>

        <div className="hw-domains" data-reveal>
          <h3>{product.domainsTitle}</h3>
          <div className="hw-chips">
            {product.domains.map((domain) => (
              <span key={domain} className="hw-chip">
                {domain}
              </span>
            ))}
          </div>
          <p className="hw-domains__note">{product.domainsNote}</p>
          <ul className="hw-feature-list">
            {product.hardwareBullets.map((bullet) => (
              <li key={bullet}>
                <Check size={18} strokeWidth={2.6} aria-hidden />
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="hw-screens-wrap" data-reveal>
        <h3>{product.screensTitle}</h3>
        <div className="hw-screens">
          {product.screens.map((screen) => (
            <figure key={screen.src} className="hw-screen-card">
              <img src={screen.src} alt={screen.alt} loading="lazy" />
              <figcaption>{screen.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div className="hw-elder" data-reveal>
        <img src={product.elder.src} alt={product.elder.alt} loading="lazy" />
        <p>{product.elderCaption}</p>
      </div>
    </Section>
  );
}
