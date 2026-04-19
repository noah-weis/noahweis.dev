import type { Experience } from "../../types";
import styles from "./ExperienceItem.module.css";

interface Props {
  experience: Experience;
}

export function ExperienceItem({ experience }: Props) {
  const { company, date, title, link, role, bullets, skills, image } = experience;

  return (
    <div className={styles.item}>
      <div className={styles.header}>
        <div className={styles.company}>{company}</div>
        <span className={styles.date}>{date}</span>
      </div>
      <div className={styles.header}>
        <h2 className={styles.title}>
          {link ? (
            <a href={link} target="_blank" rel="noreferrer">
              {title}
            </a>
          ) : (
            <span>{title}</span>
          )}
        </h2>
      </div>
      <div className={styles.content}>
        <div className={styles.text}>
          <div className={styles.role}>{role}</div>
          <ul className={styles.bullets}>
            {bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <div className={styles.skills}>
            {typeof skills === "string"
              ? skills
              : skills.map((s) => (
                  <span key={s.label} className={styles.skillEntry}>
                    {s.icon && (
                      <img src={s.icon} alt={s.label} className={styles.skillIcon} />
                    )}
                    {s.label}
                  </span>
                ))}
          </div>
        </div>
        <img src={image.src} alt={image.alt} className={styles.image} />
      </div>
    </div>
  );
}
