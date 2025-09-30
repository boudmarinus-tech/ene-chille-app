// src/pages/Home.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";

// optioneel: interne code genereren (we tonen die niet aan de user)
function codeFromId(id) {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

export default function Home() {
  const nav = useNavigate();
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function loadRecent() {
    const { data, error } = await supabase
      .from("matches")
      .select("id,name,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) setErr(error.message);
    setRecent(data || []);
  }

  useEffect(() => {
    loadRecent();
  }, []);

  const latest = recent[0] || null;

  async function createMatch() {
    setErr("");
    const suggested = "Ene Chille vs …";
    const name = (prompt("Naam van de match:", suggested) || "").trim();
    if (!name) return;

    setLoading(true);
    // 1) aanmaken
    const { data, error } = await supabase
      .from("matches")
      .insert({ name })
      .select()
      .single();
    if (error) {
      setLoading(false);
      setErr(error.message);
      return;
    }

    // 2) optioneel: interne code bijvullen (we tonen die nergens)
    const code = codeFromId(data.id);
    await supabase.from("matches").update({ code }).eq("id", data.id);

    setLoading(false);
    // 3) meteen naar stemmen
    nav(`/vote?match=${data.id}`);
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      {/* Kop */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="section-title">ENE CHILLE</div>
            <div className="small">Man van de Match • Ezel van de Match • Stats</div>
          </div>
          <button className="btn" onClick={createMatch} disabled={loading}>
            {loading ? "Aanmaken…" : "Nieuwe match starten"}
          </button>
        </div>
        {err && <p className="small" style={{ color: "crimson", marginTop: 8 }}>{err}</p>}
      </div>

      {/* Snel starten: laatste match */}
      <div className="card">
        <div className="section-title">Snel stemmen op de laatste match</div>
        {latest ? (
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div className="small"><b>{latest.name}</b></div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" onClick={() => nav(`/vote?match=${latest.id}`)}>
                Ga stemmen
              </button>
              <button className="btn secondary" onClick={() => nav(`/results?match=${latest.id}`)}>
                Bekijk resultaten
              </button>
            </div>
          </div>
        ) : (
          <p className="small">Nog geen matchen aangemaakt.</p>
        )}
      </div>

      {/* Oudere match kiezen */}
      <div className="card">
        <div className="section-title">Kies een eerdere match</div>
        <div className="row" style={{ gap: 8 }}>
          <select
            className="select"
            defaultValue=""
            onChange={(e) => e.target.value && nav(`/vote?match=${e.target.value}`)}
          >
            <option value="" disabled>
              Selecteer match om te stemmen…
            </option>
            {recent.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <select
            className="select"
            defaultValue=""
            onChange={(e) => e.target.value && nav(`/results?match=${e.target.value}`)}
          >
            <option value="" disabled>
              Selecteer match om resultaten te zien…
            </option>
            {recent.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
