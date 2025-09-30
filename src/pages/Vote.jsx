import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function Vote() {
  const q = useQuery();
  const nav = useNavigate();
  const matchIdFromUrl = q.get("match");

  const [roster, setRoster] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [currentMatch, setCurrentMatch] = useState(null);

  const [selfId, setSelfId] = useState("");
  const [goals, setGoals] = useState("0");
  const [assists, setAssists] = useState("0");
  const [selfSaved, setSelfSaved] = useState(false);

  const [pick1, setPick1] = useState("");
  const [pick2, setPick2] = useState("");
  const [pick3, setPick3] = useState("");
  const [donkeyPick, setDonkeyPick] = useState("");
  const [donkeyReason, setDonkeyReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Roster ophalen
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("roster").select("id,name").order("name");
      setRoster(data || []);
    })();
  }, []);

  // Matches ophalen
  useEffect(() => {
    (async () => {
      const { data: m } = await supabase
        .from("matches")
        .select("id,name,created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      const list = m || [];
      setRecentMatches(list);

      if (matchIdFromUrl) {
        const found = list.find((x) => x.id === matchIdFromUrl);
        if (found) setCurrentMatch(found);
      } else if (list[0]) {
        setCurrentMatch(list[0]);
        nav(`?match=${list[0].id}`, { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchIdFromUrl]);

  // Helpers
  function options(exclude) {
    return roster.filter((r) => !exclude.includes(r.id));
  }
  function onSelectMatch(id) {
    const found = recentMatches.find((m) => m.id === id);
    if (found) {
      setCurrentMatch(found);
      nav(`?match=${found.id}`, { replace: true });
    }
  }

  // Stats opslaan
  async function saveStats(g = goals, a = assists) {
    if (!currentMatch) return;
    if (!selfId) return setErr("Selecteer jezelf.");
    setLoading(true);
    const { error } = await supabase.from("player_stats").insert({
      match_id: currentMatch.id,
      roster_id: selfId,
      goals: parseInt(g, 10) || 0,
      assists: parseInt(a, 10) || 0,
    });
    setLoading(false);
    if (error) return setErr(error.message);
    setSelfSaved(true);
    setErr("");
  }

  // MOTM stemmen
  async function submitMotm() {
    if (!currentMatch) return;
    if (!selfSaved) return setErr("Vul eerst jezelf + goals/assists in.");
    if (!pick1 || !pick2 || !pick3 || new Set([pick1, pick2, pick3]).size !== 3) {
      return setErr("Kies 3 verschillende spelers.");
    }

    // ⛔ Blokkeer eigen stem
    if ([pick1, pick2, pick3].includes(selfId)) {
      return setErr("Je kan niet op jezelf stemmen 😉");
    }

    setLoading(true);
    const payload = [
      { match_id: currentMatch.id, roster_id: pick1, weight: 3, voter_roster_id: selfId },
      { match_id: currentMatch.id, roster_id: pick2, weight: 2, voter_roster_id: selfId },
      { match_id: currentMatch.id, roster_id: pick3, weight: 1, voter_roster_id: selfId },
    ];
    const { error } = await supabase.from("votes").insert(payload);
    setLoading(false);
    if (error) return setErr(error.message);
    setPick1(""); setPick2(""); setPick3("");
    setErr("");
    alert("MOTM-stem geregistreerd ✅ — je kan nu ook Ezel stemmen.");
  }

  // Ezel stemmen
  async function submitDonkey() {
    if (!currentMatch) return;
    if (!selfSaved) return setErr("Vul eerst jezelf + goals/assists in.");
    if (!donkeyPick) return setErr("Kies iemand voor Ezel.");

    // ⛔ Blokkeer eigen stem
    if (donkeyPick === selfId) {
      return setErr("Je kan jezelf niet als Ezel aanduiden 😉");
    }

    if (donkeyReason.length > 280) return setErr("Tekst te lang.");
    setLoading(true);
    const { error } = await supabase.from("donkey_votes").insert({
      match_id: currentMatch.id,
      roster_id: donkeyPick,
      voter_roster_id: selfId,
      reason: donkeyReason || null,
    });
    setLoading(false);
    if (error) return setErr(error.message);
    setDonkeyPick(""); setDonkeyReason("");
    setErr("");
    alert("Ezel-stem geregistreerd 🫏");
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      {/* Match selectie */}
      <div className="card">
        <div className="section-title">Match</div>
        {currentMatch ? (
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <span><b>{currentMatch.name}</b></span>
            <select className="select" value={currentMatch.id} onChange={(e)=>onSelectMatch(e.target.value)}>
              {recentMatches.map((m)=><option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        ) : <p className="small">Laden…</p>}
      </div>

      {/* Zelf + stats */}
      <div className="card">
        <div className="section-title">Wie ben jij?</div>
        <select className="select" value={selfId} onChange={(e)=>setSelfId(e.target.value)}>
          <option value="">Kies jezelf</option>
          {roster.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="row" style={{ marginTop: 8 }}>
          <input className="input" type="number" min="0" value={goals} onChange={e=>setGoals(e.target.value)} placeholder="Goals" />
          <input className="input" type="number" min="0" value={assists} onChange={e=>setAssists(e.target.value)} placeholder="Assists" />
        </div>
        <div className="row" style={{ marginTop: 8, gap: 6 }}>
          <button className="btn" onClick={() => saveStats()} disabled={loading}>Opslaan</button>
          <button className="btn secondary" onClick={() => saveStats(0,0)} disabled={loading}>👓 Brilscore</button>
        </div>
        {selfSaved && <p className="small">Stats opgeslagen ✅</p>}
        {err && <p className="small" style={{ color: "crimson" }}>{err}</p>}
      </div>

      {/* MOTM */}
      <div className="card">
        <div className="section-title">MOTM — 3·2·1 punten</div>
        <div className="row">
          <select className="select" value={pick1} onChange={e=>setPick1(e.target.value)} disabled={!selfSaved}>
            <option value="">1e (3 pt)</option>
            {options([pick2,pick3]).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="select" value={pick2} onChange={e=>setPick2(e.target.value)} disabled={!selfSaved}>
            <option value="">2e (2 pt)</option>
            {options([pick1,pick3]).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="select" value={pick3} onChange={e=>setPick3(e.target.value)} disabled={!selfSaved}>
            <option value="">3e (1 pt)</option>
            {options([pick1,pick2]).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button className="btn" onClick={submitMotm} disabled={!selfSaved || loading}>Stem indienen</button>
      </div>

      {/* Ezel */}
      <div className="card">
        <div className="section-title">🫏 Ezel van de Match</div>
        <select className="select" value={donkeyPick} onChange={e=>setDonkeyPick(e.target.value)} disabled={!selfSaved}>
          <option value="">Kies de ezel</option>
          {roster.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <textarea className="input" rows={3} maxLength={280} placeholder="Waarom? (optioneel)"
          value={donkeyReason} onChange={e=>setDonkeyReason(e.target.value)} disabled={!selfSaved}/>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={submitDonkey} disabled={!selfSaved || loading}>Ezel indienen</button>
          <button className="btn secondary" onClick={() => currentMatch && nav(`/results?match=${currentMatch.id}`)}>
            Toon resultaten
          </button>
        </div>
      </div>
    </div>
  );
}
