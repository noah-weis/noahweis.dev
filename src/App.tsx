import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./routes/Home";
import { Cal } from "./routes/Cal";
import { AuthHelpersHarness } from "./routes/__test/AuthHelpersHarness";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cal" element={<Cal />} />
        {import.meta.env.DEV && (
          <Route path="/__test/auth-helpers" element={<AuthHelpersHarness />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}
