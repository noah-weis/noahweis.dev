import { useEffect, useRef, useState } from "react";
import { Landing } from "../components/Landing/Landing";
import { ExperiencesSection } from "../components/ExperiencesSection/ExperiencesSection";
import { ContactSection } from "../components/ContactSection/ContactSection";
import { ScrollArrow } from "../components/ScrollArrow/ScrollArrow";
import styles from "./Home.module.css";

function readTopSpacingPx(): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--top-spacing")
    .trim();
  if (raw.endsWith("rem")) {
    const rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return parseFloat(raw) * rootFont;
  }
  if (raw.endsWith("px")) return parseFloat(raw);
  return 0;
}

export function Home() {
  const landingRef = useRef<HTMLDivElement>(null);
  const [experiencesMarginTop, setExperiencesMarginTop] = useState<number | undefined>(undefined);

  useEffect(() => {
    const recompute = () => {
      if (!landingRef.current) return;
      const landingHeight = landingRef.current.offsetHeight;
      const topSpacing = readTopSpacingPx();
      const margin = window.innerHeight - topSpacing - landingHeight - 140;
      setExperiencesMarginTop(margin);
    };
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, []);

  return (
    <>
      <main className={`${styles.page} fade-in-text`}>
        <div className={styles.container} ref={landingRef}>
          <Landing />
        </div>
        <div
          className={styles.container}
          style={experiencesMarginTop !== undefined ? { marginTop: `${experiencesMarginTop}px` } : undefined}
        >
          <ExperiencesSection />
          <ContactSection />
        </div>
      </main>
      <ScrollArrow />
    </>
  );
}
