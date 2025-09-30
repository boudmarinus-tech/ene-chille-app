import { useEffect, useState } from "react";

export default function Standings() {
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await fetch("/.netlify/functions/fetchStand");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setHeaders(data.headers || []);
        setRows(data.rows || []);
      } catch (e) {
        setErr(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="card">
      <div className="section-title">Stand (live van lzvcup.be)</div>
      {loading && <p className="small">Laden…</p>}
      {err && <p className="small" style={{ color: "crimson" }}>{err}</p>}

      {!loading && !err && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                {headers.map((h, i) => (
                  <th key={i} className="small" style={{ padding: "6px 4px", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                  {r.map((c, j) => (
                    <td key={j} style={{ padding: "8px 4px", whiteSpace: "nowrap" }}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="small" style={{ opacity: .7, marginTop: 8 }}>
        De tabel wordt bij elke paginalaad live opgehaald.
      </p>
    </div>
  );
}
