import { useState } from "react";
import styles from "./ContactSection.module.css";

export function ContactSection() {
  const [copied, setCopied] = useState(false);

  const copyEmail = async () => {
    await navigator.clipboard.writeText("njdweis@gmail.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className={styles.section}>
      <h1 className={styles.heading}>Contact</h1>
      <h2
        className={`${styles.entry} ${styles.copyable}`}
        onClick={copyEmail}
        data-testid="copy-email"
      >
        <a>Click to copy email</a>
        {copied && <span className={styles.toast}>Copied!</span>}
      </h2>
      <h2 className={styles.entry}>
        <a
          href="https://www.linkedin.com/in/noahweis/"
          target="_blank"
          rel="noreferrer"
        >
          Connect on LinkedIn
        </a>
      </h2>
      <h2 className={styles.entry}>
        <a href="https://quackhacks.org/" target="_blank" rel="noreferrer">
          QuackHacks Sponsor?
        </a>
      </h2>
    </section>
  );
}
