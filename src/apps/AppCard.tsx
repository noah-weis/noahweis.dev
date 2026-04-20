import { Link } from "react-router-dom";
import type { AppDef } from "./registry";

const cardCss: React.CSSProperties = {
  display: "block",
  padding: 20,
  background: "#18181b",
  border: "1px solid #27272a",
  borderRadius: 10,
  color: "inherit",
  textDecoration: "none",
  transition: "border-color 120ms",
};

export function AppCard({ app }: { app: AppDef }) {
  return (
    <Link
      data-testid={`app-card-${app.slug}`}
      to={`/admin/apps/${app.slug}`}
      style={cardCss}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#818cf8")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#27272a")}
    >
      <div style={{ fontSize: 16, fontWeight: 600 }}>{app.name}</div>
      <div style={{ fontSize: 13, color: "#a1a1aa", marginTop: 6 }}>{app.description}</div>
    </Link>
  );
}
