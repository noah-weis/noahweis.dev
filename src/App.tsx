import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./routes/Home";
import { Cal } from "./routes/Cal";
import { Login } from "./routes/admin/Login";
import { AuthHelpersHarness } from "./routes/__test/AuthHelpersHarness";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cal" element={<Cal />} />
        <Route path="/admin" element={<Login />} />
        {import.meta.env.DEV && (
          <Route path="/__test/auth-helpers" element={<AuthHelpersHarness />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}
