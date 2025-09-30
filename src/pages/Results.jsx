import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";

function useQuery() { return new URLSearchParams(useLocation().search); }
const byDesc = (a, b) => new Date(b.created_at) - new Date(a.created_at);

export default function Results() {
  const q = useQuery();
  const nav = useNavigate();
  const matchIdFromUrl = q.get("match");

  const [currentMatch, setCurrentMatch] = useState(null);
  const [recentMatches, setRecentMatches] = useState([]);
  const [roster, setRoster] = useState([]);

  const [motmScores, setMotmScores] = useState({});
  const [donkeyScores, setDonkeyScores] = useState({});
  const [statsMap, setStatsMap] = useState({});
  const [motmBallots, setMotmBallots] = useState([]);
  const [donkeyBallots, setDonkeyBallots] = useState([]);

  const nameOf = (id) => new Map(roster.map(p => [p.id, p.name])).get(id) || "Onbekend";

  // Roster
  useEffect(() => { (async () => {
    const { data } = await supabase.from("roster").select("id,name").order("name");
    setRoster(data || []);
  })(); }, []);

  // Meest recente match + lijst
  useEffect(() => { (async () => {
    const { data: m } = await supabase
      .from("matches").select("id,name,created_at")
      .order("created_at", { ascending: false }).limit(20);
    const list = (m || []).sort(byDesc);
    setRecentMatches(list);

    if (matchIdFromUrl) {
      const found = list.find(x => x.id === matchIdFromUrl);
      if (found) setCurrentMatch(found);
      else if (list[0]) { setCurrentMatch(list[0]); nav(`?match=${list[0].id}`, { replace:true }); }
    } else if (list[0]) {
      setCurrentMatch(list[0]);
      nav(`?match=${list[0].id}`, { replace:true });
    }
  })(); /* eslint-disable-next-line */ }, [matchIdFromUrl]);

  // Resultaten laden
  useEffect(() => { refreshResults(); /* eslint-disable-next-line */ }, [currentMatch, roster.length]);

  async function refreshResults() {
    if (!currentMatch) return;

    // MOTM
    const { data: v } = await supabase
      .from("votes")
      .select("match_id,roster_id,voter_roster_id,weight,created_at")
      .eq("match_id", currentMatch.id);

    const motm = {}; const ballots = [];
    (v||[]).forEach(r => {
      motm[r.roster_id] = (motm[r.roster_id] || 0) + (r.weight || 0);
      ballots.push({ voterName: nameOf(r.voter_roster_id), pickName: nameOf(r.roster_id), weight: r.weight, created_at: r.created_at });
    });
    ballots.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    setMotmScores(motm); setMotmBallots(ballots.slice(0,60));

    // Ezel
    const { data: d } = await supabase
      .from("donkey_votes")
      .select("match_id,roster_id,voter_roster_id,reason,created_at")
      .eq("match_id", currentMatch.id);

    const counts = {}; const dBallots = [];
    (d||[]).forEach(r => {
      counts[r.roster_id] = (counts[r.roster_id] || 0) + 1;
      dBallots.push({ voterName: nameOf(r.voter_roster_id), pickName: nameOf(r.roster_id), reason: r.reason, created_at: r.created_at });
    });
    dBallots.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    setDonkeyScores(counts); setDonkeyBallots(dBallots.slice(0,60));

    // Stats (incl. 0/0 als er een rij bestaat)
    const { data: ps } = await supabase
      .from("player_stats")
      .select("roster_id,goals,assists")
      .eq("match_id", currentMatch.id);

    const sm = {};
    (ps||[]).forEach(r => {
      const prev = sm[r.roster_id] || { goals:0, assists:0 };
      sm[r.roster_id] = { goals: prev.goals + (r.goals||0), assists: prev.assists + (r.assists||0) };
    });
    setStatsMap(sm);
  }

  const motmRanking = useMemo(() =>
    roster.map(p => ({ id:p.id, name:p.name, points:motmScores[p.id]||0 }))
          .sort((a,b)=>b.points-a.points), [roster, motmScores]);

  const donkeyRanking = useMemo(() =>
    roster.map(p => ({ id:p.id, name:p.name, votes:donkeyScores[p.id]||0 }))
          .sort((a,b)=>b.votes-a.votes), [roster, donkeyScores]);

  const statsRows = useMemo(() => {
    const rows = Object.entries(statsMap).map(([id,s]) => ({ id, name: nameOf(id), goals:s.goals, assists:s.assists }));
    return rows.sort((a,b)=>(b.goals-a.goals)||(b.assists-a.assists)||a.name.localeCompare(b.name));
  }, [statsMap, roster]);

  function onSelectMatch(id){
    const found = recentMatches.find(m => m.id === id);
    if (found){ setCurrentMatch(found); nav(`?match=${found.id}`, { replace:true }); }
  }

  return (
    <div className="grid grid-2" style={{ gap:12 }}>
      {/* Header + selector (geen code tonen) */}
      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <div className="row" style={{ justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div className="section-title">Resultaten</div>
            {currentMatch ? <div className="kicker"><b>{currentMatch.name}</b></div> : <div className="small">Laden…</div>}
          </div>
          <div className="row" style={{ gap:8 }}>
            <select className="select" value={currentMatch?.id || ""} onChange={e=>onSelectMatch(e.target.value)}>
              {recentMatches.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <button className="btn secondary" onClick={refreshResults}>Refresh</button>
          </div>
        </div>
      </div>

      {/* Links: MOTM en Ezel */}
      <div className="grid" style={{ gap:12 }}>
        <div className="card">
          <div className="section-title">🏆 Man van de Match — Ranking</div>
          <div className="grid" style={{ gap:10 }}>
            {motmRanking.map((r,i)=>(
              <div key={r.id}>
                <div className="row" style={{ justifyContent:"space-between" }}>
                  <div>{i+1}. <b>{r.name}</b></div>
                  <div><b>{r.points}</b> pt</div>
                </div>
                <div className="bar"><div style={{width:`${motmRanking[0]?.points ? (r.points/motmRanking[0].points)*100 : 0}%`}}/></div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-title">🫏 Ezel van de Match — Telling</div>
          <div className="grid" style={{ gap:10 }}>
            {donkeyRanking.map((r,i)=>(
              <div key={r.id}>
                <div className="row" style={{ justifyContent:"space-between" }}>
                  <div>{i+1}. <b>{r.name}</b></div>
                  <div><b>{r.votes}</b> x</div>
                </div>
                <div className="bar"><div style={{width:`${donkeyRanking[0]?.votes ? (r.votes/donkeyRanking[0].votes)*100 : 0}%`}}/></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rechts: stats en wie-op-wie */}
      <div className="grid" style={{ gap:12 }}>
        <div className="card">
          <div className="section-title">📊 Goals & Assists (deze match)</div>
          {statsRows.length===0 ? <p className="small">Nog geen stats.</p> : (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ textAlign:"left" }}>
                  <th className="small" style={{ padding:"6px 4px" }}>Speler</th>
                  <th className="small" style={{ padding:"6px 4px" }}>Goals</th>
                  <th className="small" style={{ padding:"6px 4px" }}>Assists</th>
                </tr>
              </thead>
              <tbody>
                {statsRows.map(r=>(
                  <tr key={r.id} style={{ borderTop:"1px solid #e5e7eb" }}>
                    <td style={{ padding:"8px 4px" }}><b>{r.name}</b></td>
                    <td style={{ padding:"8px 4px" }}>{r.goals}</td>
                    <td style={{ padding:"8px 4px" }}>{r.assists}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="section-title">🗳️ Wie stemde op wie?</div>

          <div className="small" style={{ marginBottom:6 }}>MOTM</div>
          {motmBallots.length===0 ? <p className="small">Nog geen stemmen.</p> :
            <ul style={{ paddingLeft:16, marginBottom:8 }}>
              {motmBallots.map((b,i)=><li key={i} className="small"><b>{b.voterName}</b> → {b.pickName} ({b.weight} pt)</li>)}
            </ul>
          }

          <div className="small" style={{ marginTop:8, marginBottom:6 }}>Ezel</div>
          {donkeyBallots.length===0 ? <p className="small">Nog geen ezel-stemmen.</p> :
            <ul style={{ paddingLeft:16 }}>
              {donkeyBallots.map((b,i)=>
                <li key={i} className="small"><b>{b.voterName}</b> → {b.pickName}{b.reason ? <> — “{b.reason}”</> : null}</li>
              )}
            </ul>
          }
        </div>
      </div>
    </div>
  );
}
