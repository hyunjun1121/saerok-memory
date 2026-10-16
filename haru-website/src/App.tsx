import { useEffect } from "react";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Problem } from "@/components/Problem";
import { Solution } from "@/components/Solution";
import { Product } from "@/components/Product";
import { Personalization } from "@/components/Personalization";
import { Validation } from "@/components/Validation";
import { Business } from "@/components/Business";
import { Team } from "@/components/Team";
import { Awards } from "@/components/Awards";
import { Cta } from "@/components/Cta";
import { Footer } from "@/components/Footer";

export default function App() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      for (const element of targets) element.classList.add("is-revealed");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    for (const element of targets) observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Header />
      <main>
        <Hero />
        <Problem />
        <Solution />
        <Product />
        <Personalization />
        <Validation />
        <Business />
        <Team />
        <Awards />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
