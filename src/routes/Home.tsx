import { Landing } from "../components/Landing/Landing";
import { ExperiencesSection } from "../components/ExperiencesSection/ExperiencesSection";
import { ContactSection } from "../components/ContactSection/ContactSection";
import { ScrollArrow } from "../components/ScrollArrow/ScrollArrow";
import styles from "./Home.module.css";

export function Home() {
  return (
    <>
      <main className={`${styles.page} fade-in-text`}>
        <div className={styles.container}>
          <Landing />
        </div>
        <div className={styles.container}>
          <ExperiencesSection />
          <ContactSection />
        </div>
      </main>
      <ScrollArrow />
    </>
  );
}
