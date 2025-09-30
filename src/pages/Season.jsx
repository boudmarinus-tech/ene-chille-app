// src/pages/Season.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Season(){
  const thisYear = new Date().getFullYear();
  const [year,setYear] = useState(thisYear);
  const [roster,setRoster] = useState([]);           // alle spelers
  const [matches,setMatches] = useState([]);         // {id, created_at}
  const [stats,setStats] = useState([]);             // player_stats rows (match_id, roster_id, goals, assists)
  const [loading,setLoading] = useState(true);
  const [err,setErr] = useState("");

  // Data ophalen (éénmalig of bij jaarwisseling: matches en roster + stats)
  useEffect(()=>{ (async()=>{
    try{
      setLoading(true); setErr("");

      // Roster (altijd alles)
      const { data: r, error: er } = await supabase.from("roster").select("id,name").order("name");
      if (er) throw er;
      setRoster(r || []);

      // Matches (we hebben created_at nodig om op jaar te filteren)
      const { data: m, error: em } = await supabase
        .from("matches")
        .select("id,created_at");
      if (em) throw em;
      setMatches(m || []);

      // Alle stats (we filteren in de client op jaar + match_id)
      const { data: ps, error: eps } = await supabase
        .from("player_stats")
        .select("match_id, roster_id, goals, assists");
      if (eps) throw eps;
      setStats(ps || []);
    } catch(e){
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  })(); }, [year]); // year in deps zodat we meteen refreshen als je wisselt

  // Helper
  const safeRate = (num, den) => den > 0 ? (num/den) : 0;

  // Afgeleide tabel
  const rows = useMemo(()=>{
    // 1) match_ids die in het gekozen jaar vallen
    const yearMatchIds = new Set(
      (matches || [])
        .filter(m => new Date(m.created_at).getFullYear() === Number(year))
        .map(m => m.id)
    );

    // 2) init map voor alle spelers
    const base = Object.fromEntries(
      (roster || []).map(p => [p.id, {
        id: p.id,
        name: p.name,
        matches: 0,
        goals: 0,
        assists: 0,
        _seen: new Set(), // om distinct wedstrijden te tellen
      }])
    );

    // 3) accumuleer stats binnen dit jaar
    (stats || []).forEach(s => {
      if (!yearMatchIds.has(s.match_id)) return;      // alleen stats van matchen in dit jaar
      const rec = base[s.roster_id];
      if (!rec) return;                               // (voor het geval van oude IDs)
      rec.goals += (s.goals || 0);
      rec.assists += (s.assists || 0);
      rec._seen.add(s.match_id);
    });

    // 4) rond af & bereken rates
    const list = Object.values(base).map(rec => {
      const matches = rec._seen.size;
      const gpm = safeRate(rec.goals, matches);
      const apm = safeRate(rec.assists, matches);
      return {
        id: rec.id,
        name: rec.name,
        matches,
        goals: rec.goals,
        assists: rec.assists,
        gpm,
        apm,
      };
    });

    // 5) sort: eerst meeste goals, dan assists, dan naam
    list.sort((a,b) =>
      (b.goals - a.goals) ||
      (b.assists - a.assists) ||
      a.name.localeCompare(b.name)
    );

    return list;
  }, [roster, matches, stats, year]);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent:"space-between", alignItems:"center" }}>
        <div className="section-title">Jaaroverzicht</div>
        <select className="select" value={year} onChange={e=>setYear(Number(e.target.value))}>
          {Array.from({length:5}).map((_,i)=>{
            const y = thisYear - i;
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
      </div>

      {loading && <p className="small">Bezig met laden…</p>}
      {err && <p className="small" style={{color:"crimson"}}>{err}</p>}

      {!loading && (
        <table style={{ width:"100%", borderCollapse:"collapse", marginTop:8 }}>
          <thead>
            <tr style={{ textAlign:"left" }}>
              <th className="small" style={{ padding:"6px 4px" }}>Speler</th>
              <th className="small" style={{ padding:"6px 4px" }}>Wedstrijden</th>
              <th className="small" style={{ padding:"6px 4px" }}>Goals</th>
              <th className="small" style={{ padding:"6px 4px" }}>Goals / match</th>
              <th className="small" style={{ padding:"6px 4px" }}>Assists</th>
              <th className="small" style={{ padding:"6px 4px" }}>Assists / match</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderTop:"1px solid #e5e7eb" }}>
                <td style={{ padding:"8px 4px" }}><b>{r.name}</b></td>
                <td style={{ padding:"8px 4px" }}>{r.matches}</td>
                <td style={{ padding:"8px 4px" }}>{r.goals}</td>
                <td style={{ padding:"8px 4px" }}>{r.gpm.toFixed(2)}</td>
                <td style={{ padding:"8px 4px" }}>{r.assists}</td>
                <td style={{ padding:"8px 4px" }}>{r.apm.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="small" style={{ marginTop:8, opacity:.7 }}>
        Wedstrijden = aantal wedstrijden met een ingevulde stats-rij voor die speler in {year}.<br/>
        Per-match gemiddelden tellen alleen matchen waarin de speler voorkwam.
      </p>
    </div>
  );
}
