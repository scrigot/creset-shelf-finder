import { Link, NavLink, Route, Routes } from "react-router-dom";

import ProspectsPage from "./pages/ProspectsPage.jsx";
import ProspectDetailPage from "./pages/ProspectDetailPage.jsx";
import OutreachPage from "./pages/OutreachPage.jsx";

export default function App() {
  const navClass = ({ isActive }) => (isActive ? "nav-link active" : "nav-link");

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">C</span>
          <span className="brand-text">
            <strong>Crest</strong>
            <span>Shelf Finder</span>
          </span>
        </Link>

        <div className="topbar-right">
          <nav className="topnav">
            <NavLink to="/" end className={navClass}>
              Ranking
            </NavLink>
            <NavLink to="/outreach" className={navClass}>
              Find &amp; outreach
            </NavLink>
          </nav>
          <span className="topbar-note">
            Gyms that could stock Crest drinks &amp; supplements
          </span>
        </div>
      </header>

      <main className="page">
        <Routes>
          <Route path="/" element={<ProspectsPage />} />
          <Route path="/prospects/:id" element={<ProspectDetailPage />} />
          <Route path="/outreach" element={<OutreachPage />} />
        </Routes>
      </main>
    </div>
  );
}
