import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

function fmt(dt) {
  const dagen = ["zo", "ma", "di", "wo", "do", "vr", "za"];
  const dag = dagen[dt.getDay()]; // 0 = zondag
  const datum = dt.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" });
  const tijd = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${dag} ${datum} ${tijd}`;
}


export default function Agenda() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      const { data, error } = await supabase
        .from("fixtures")
        .select("id, starts_at, home_team, away_team, venue")
        .order("starts_at", { ascending: true });
      if (error) setErr(error.message);
      setItems(data || []);
      setLoading(false);
    })();
  }, []);

  const rows = useMemo(() => {
    return (items || []).map(row => {
      const dt = new Date(row.starts_at);
      return { ...row, dt, when: fmt(dt) };
    });
  }, [items]);

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="section-title">Agenda (seizoen)</div>
        {loading && <p className="small">Bezig met laden…</p>}
        {err && <p className="small" style={{ color: "crimson" }}>{err}</p>}
        {!loading && rows.length === 0 && <p className="small">Geen wedstrijden gevonden.</p>}

        {rows.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th className="small" style={{ padding: "6px 4px" }}>Datum</th>
                <th className="small" style={{ padding: "6px 4px" }}>Thuis</th>
                <th className="small" style={{ padding: "6px 4px" }}>Uit</th>
                <th className="small" style={{ padding: "6px 4px" }}>Locatie</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "8px 4px", whiteSpace: "nowrap" }}>{r.when}</td>
                  <td style={{ padding: "8px 4px" }}><b>{r.home_team}</b></td>
                  <td style={{ padding: "8px 4px" }}>{r.away_team}</td>
                  <td style={{ padding: "8px 4px" }}>{r.venue || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
