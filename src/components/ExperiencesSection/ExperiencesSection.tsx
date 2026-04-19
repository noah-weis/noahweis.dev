import { ExperienceItem } from "../ExperienceItem/ExperienceItem";
import { experiences } from "../../data/experiences";
import styles from "./ExperiencesSection.module.css";

export function ExperiencesSection() {
  return (
    <section className={styles.section}>
      <h1 className={styles.heading}>Work</h1>
      {experiences.map((exp) => (
        <ExperienceItem key={exp.company} experience={exp} />
      ))}
    </section>
  );
}
