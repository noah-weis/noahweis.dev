import { Link } from "react-router-dom";
import type { AppDef } from "./registry";
import s from "../styles/admin.module.css";

export function AppCard({ app }: { app: AppDef }) {
  return (
    <Link data-testid={`app-card-${app.slug}`} to={`/admin/apps/${app.slug}`} className={s.appCard}>
      <div className={s.appCardName}>{app.name}</div>
      <div className={s.appCardDesc}>{app.description}</div>
    </Link>
  );
}
