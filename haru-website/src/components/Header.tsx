import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { siteCopy } from "@/content/copy";

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`hw-header${scrolled ? " hw-header--scrolled" : ""}`}>
      <div className="hw-container hw-header__inner">
        <a className="hw-brand" href="#hero" onClick={() => setOpen(false)}>
          <img
            className="hw-brand__logo"
            src="/assets/logo/haru-logo-256.png"
            alt="Haru"
          />
          <small className="hw-brand__team">{siteCopy.meta.company}</small>
        </a>

        <nav className="hw-nav" aria-label="섹션 바로가기">
          {siteCopy.header.nav.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hw-header__actions">
          <a
            className="hw-btn hw-btn--ghost"
            href={siteCopy.meta.demoUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {siteCopy.header.demoCta}
            <ArrowUpRight size={16} strokeWidth={2.5} aria-hidden />
          </a>
          <a className="hw-btn hw-btn--primary" href="#contact">
            {siteCopy.header.contactCta}
          </a>
          <button
            type="button"
            className="hw-nav-toggle"
            aria-expanded={open}
            aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          </button>
        </div>
      </div>

      {open ? (
        <nav className="hw-mobile-menu hw-mobile-menu--open" aria-label="모바일 메뉴">
          {siteCopy.header.nav.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
