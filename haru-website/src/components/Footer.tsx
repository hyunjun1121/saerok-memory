import { siteCopy } from "@/content/copy";

export function Footer() {
  const footer = siteCopy.footer;
  return (
    <footer className="hw-footer">
      <div className="hw-container">
        <p className="hw-footer__disclaimer">{footer.disclaimer}</p>
        <p className="hw-footer__disclaimer hw-footer__disclaimer--secondary">
          {footer.disclaimerSecondary}
        </p>

        <div className="hw-footer__bar">
          <span>
            {footer.company} · {footer.copyright}
          </span>
          <nav className="hw-footer__links" aria-label="푸터 링크">
            <a href={siteCopy.meta.demoUrl} target="_blank" rel="noopener noreferrer">
              {footer.demoLabel} ↗
            </a>
            <a href="#hero">{footer.backToTop}</a>
          </nav>
        </div>

        <p className="hw-footer__sources">{footer.sourcesNote}</p>
      </div>
    </footer>
  );
}
