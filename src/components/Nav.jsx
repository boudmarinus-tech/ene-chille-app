import { NavLink, useLocation } from "react-router-dom";

export default function Nav() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const matchId = params.get("match") || "";

  // Geef NavLink een class via functie (active vs. niet-active)
  const linkClass = ({ isActive }) => `btn ${isActive ? "" : "secondary"}`;

  return (
    <div className="row" style={{ gap: 8, marginBottom: 14, alignItems: "center" }}>
      <span className="badge">ENE CHILLE</span>

      <NavLink end to="/" className={linkClass}>
        Start
      </NavLink>

      <NavLink to={matchId ? `/vote?match=${matchId}` : "/vote"} className={linkClass}>
        Stemmen
      </NavLink>

      <NavLink to={matchId ? `/results?match=${matchId}` : "/results"} className={linkClass}>
        Resultaten
      </NavLink>

      <NavLink to="/agenda" className={linkClass}>
        Agenda
      </NavLink>

      <NavLink to="/attendance" className={linkClass}>
        Aanwezigheden
      </NavLink>

      <NavLink to="/season" className={linkClass}>
        Jaaroverzicht
      </NavLink>

      <NavLink to="/standings" className={linkClass}>
      Stand
      </NavLink>

    </div>
  );
}
