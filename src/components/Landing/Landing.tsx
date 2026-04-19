import styles from "./Landing.module.css";

export function Landing() {
  return (
    <div className={styles.landing}>
      <img
        src="/assets/img/qhw25_edit.jpg"
        alt="Noah Weis"
        className={styles.image}
      />
      <h1 className={styles.name}>Noah Weis</h1>
      <p className={styles.description}>
        Software engineer with proven teamwork and leadership experience.
      </p>
      <div className={styles.socials}>
        <a
          href="https://www.linkedin.com/in/noahweis/"
          target="_blank"
          rel="noreferrer"
          title="LinkedIn"
        >
          <img src="/assets/img/linkedin.png" alt="LinkedIn" className={styles.icon} />
        </a>
        <a
          href="https://github.com/noahweis"
          target="_blank"
          rel="noreferrer"
          title="GitHub"
        >
          <img src="/assets/img/github.png" alt="GitHub" className={styles.icon} />
        </a>
        <a
          href="/assets/img/resume.pdf"
          target="_blank"
          rel="noreferrer"
        >
          <button className={styles.resumeButton}>Resume</button>
        </a>
      </div>
    </div>
  );
}
