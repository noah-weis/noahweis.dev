import { useEffect, useState } from "react";
import styles from "./ScrollArrow.module.css";

export function ScrollArrow() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 2500);
    const onScroll = () => setVisible(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(showTimer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div
      className={`${styles.arrow} ${visible ? styles.visible : ""}`}
      data-testid="scroll-arrow"
    >
      ↓
    </div>
  );
}
