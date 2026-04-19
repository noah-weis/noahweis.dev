import { useEffect } from "react";
import { Link } from "react-router-dom";
import styles from "./Cal.module.css";

const CAL_SRC =
  "https://calendar.google.com/calendar/embed?src=a0ccadea8432cefa326b59168dc6a9607969783f7a1dd492cf8737170f2b479f%40group.calendar.google.com&src=51d1dfca34125b7a3d5dffa77f9e54f7a0222dd5b3b2481279cad17efa46d9bd%40group.calendar.google.com&src=njdweis%40gmail.com&src=08f4a1f7d8e33a9d38937ce85c537f6d79afc3e7e62d93510d9ad3f300a8781b%40group.calendar.google.com&ctz=America%2FLos_Angeles&mode=WEEK";

export function Cal() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Calendar | Noah Weis | QuackHacks";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      if (meta.parentNode) meta.parentNode.removeChild(meta);
      document.title = prevTitle;
    };
  }, []);

  return (
    <main className={`${styles.page} fade-in-text`}>
      <h1 className={styles.heading}>
        <Link to="/">My Availability</Link>
      </h1>
      <p className={styles.description}>
        Below is my free/busy schedule for the week. Times are shown in Pacific
        Time.
      </p>
      <iframe
        src={CAL_SRC}
        className={styles.iframe}
        frameBorder="0"
        scrolling="no"
        title="Google Calendar availability"
      />
      <p className={styles.footer}>
        <Link to="/">&larr; Back to home</Link>
      </p>
    </main>
  );
}
