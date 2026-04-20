import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Home } from "./routes/Home";
import { Cal } from "./routes/Cal";
import { Login } from "./routes/admin/Login";
import { AdminRoot } from "./routes/admin/AdminRoot";
import { Dashboard } from "./routes/admin/Dashboard";
import { RequireApp } from "./apps/RequireApp";
import { AuthHelpersHarness } from "./routes/__test/AuthHelpersHarness";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cal" element={<Cal />} />
        <Route path="/admin" element={<Login />} />
        <Route element={<AdminRoot />}>
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/apps/:slug" element={<RequireApp />} />
          <Route path="/admin/*" element={<Navigate to="/admin/dashboard" replace />} />
        </Route>
        {import.meta.env.DEV && (
          <Route path="/__test/auth-helpers" element={<AuthHelpersHarness />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}
