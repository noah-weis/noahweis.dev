import { useEffect } from "react";
import { Outlet, useNavigate, Link } from "react-router-dom";
import { useSession, signOut } from "../../lib/auth";
import s from "../../styles/admin.module.css";

export function AdminRoot() {
  const navigate = useNavigate();
  const { session, loading } = useSession();

  useEffect(() => {
    if (!loading && !session) navigate("/admin", { replace: true });
  }, [loading, session, navigate]);

  if (loading) return <div className={s.loadingScreen}>Loading…</div>;
  if (!session) return null; // redirect in flight

  return (
    <div className={s.shell}>
      <div className={s.topbar}>
        <Link to="/admin/dashboard" className={s.brand}>noahweis.dev</Link>
        <div className={s.topbarRight}>
          <span data-testid="admin-topbar-email" className={s.email}>{session.user.email}</span>
          <button
            data-testid="admin-topbar-signout"
            className={s.signoutBtn}
            onClick={async () => {
              await signOut();
              navigate("/admin", { replace: true });
            }}
          >
            Sign out
          </button>
        </div>
      </div>
      <div className={s.content}><Outlet /></div>
    </div>
  );
}
