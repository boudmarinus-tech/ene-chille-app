import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient.js";

/** QR met fallback */
function QR({ text }) {
  const [src, setSrc] = useState(
    `https://chart.googleapis.com/chart?cht=qr&chs=280x280&chl=${encodeURIComponent(text)}`
  );
  function handleError() {
    setSrc(
      `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(text)}`
    );
  }
  return <img className="qr" src={src} onError={handleError} alt="QR" />;
}
function codeFromId(id) {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

export default function App() {
  /** Data */
  const [roster, setRoster] = useState([]);
  const [match, setMatch] = useState(null);
  const [code, setCode] = useState("");
  const [recentMatches, setRecentMatches] = useState([]);

  /** Self-identification + stats */
  const [selfId, setSelfId] = useState("");
  const [goals, setGoals] = useState("0");
  const [assists, setAssists] = useState("0");
  const [selfSaved, setSelfSaved] = useState(false);

  /** MOTM picks */
  const [pick1, setPick1] = useState("");
  const [pick2, setPick2] = useState("");
  const [pick3, setPick3] = useState("");

  /** Donkey picks */
  const [donkeyPick, setDonkeyPick] = useState("");
  const [donkeyReason, setDonkeyReason] = useState("");

  /** Scores/state */
  const [motmScores, setMotmScores] = useState({});
  const [donkeyScores, setDonkeyScores] = useState({});
  const [donkeyReasons, setDonkeyReasons] = useState([]);

  /** NEW: per-speler stats (goals/assists) voor de match */
  const [statsMap, setStatsMap] = useState({}); // { roster_id: {goals, assists} }

  /** NEW: wie->wie overzichten */
  const [motmBallots, setMotmBallots] = useState([]);   // [{voterName, pickName, weight, created_at}]
  const [donkeyBallots, setDonkeyBallots] = useState([]); // [{voterName, pickName, reason, created_at}]

  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  /** Roster + recente matchen laden */
  useEffect(() => {
    (async () => {
      const { data: r } = await supabase.from("roster").select("id,name").order("name");
      setRoster(r || []);
      const { data: m } = await supabase
        .from("matches")
        .select("id,name,code,created_at")
        .order("created_at", { ascending: false })
        .limit(12);
      setRecentMatches(m || []);
    })();
  }, []);

  /** Auto-join via ?code=... */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get("code");
    if (urlCode) joinByCode(urlCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Hulpjes */
  function options(exclude) {
    return roster.filter((r) => !exclude.includes(r.id));
  }
  function asInt(str, fallback = 0) {
    const n = parseInt(String(str).trim(), 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }
  const nameOf = (id) => new Map(roster.map((p) => [p.id, p.name])).get(id) || "Onbekend";

  /** Match maken/joinen */
  async function createMatch() {
    setErr("");
    const name = prompt("Matchnaam? (bv. Ene Chile vs …)");
    if (!name) return;
    setLoading(true);
    const { data, error } = await supabase.from("matches").insert({ name }).select().single();
    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }
    const c = codeFromId(data.id);
    const { error: updErr } = await supabase.from("matches").update({ code: c }).eq("id", data.id);
    if (updErr) {
      setErr(updErr.message);
      setLoading(false);
      return;
    }
    const m = { id: data.id, name, code: c };
    setMatch(m);
    setCode(c);
    setSelfSaved(false);
    setLoading(false);

    // refresh dropdown-lijst
    const { data: latest } = await supabase
      .from("matches")
      .select("id,name,code,created_at")
      .order("created_at", { ascending: false })
      .limit(12);
    setRecentMatches(latest || []);
  }

  async function joinByCode(input) {
    setErr("");
    const c = (input ?? joinCode).trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("matches")
      .select("id,name,code")
      .eq("code", c)
      .single();
    setLoading(false);
    if (error) return setErr("Code niet gevonden");
    setMatch(data);
    setCode(data.code);
    setSelfSaved(false);
  }

  async function joinById(matchId) {
    if (!matchId) return;
    setErr("");
    setLoading(true);
    const { data, error } = await supabase
      .from("matches")
      .select("id,name,code")
      .eq("id", matchId)
      .single();
    setLoading(false);
    if (error) return setErr("Match niet gevonden");
    setMatch(data);
    setCode(data.code);
    setSelfSaved(false);
  }

  /** Stap 1: ik ben... + goals/assists opslaan (verplicht) */
  async function saveSelfAndStats() {
    if (!match) return;
    setErr("");
    const g = asInt(goals, 0);
    const a = asInt(assists, 0);
    if (!selfId) return setErr("Selecteer jezelf.");
    if (g < 0 || a < 0) return setErr("Goals/assists moeten 0 of meer zijn.");
    setLoading(true);
    const { error } = await supabase.from("player_stats").insert({
      match_id: match.id,
      roster_id: selfId,
      goals: g,
      assists: a,
    });
    setLoading(false);
    if (error) return setErr(error.message);
    setSelfSaved(true);
    await refreshResults(); // meteen stats + overzichten verversen
    alert("Stats opgeslagen ✅");
  }

  /** Stemmen (MOTM / Ezel) */
  async function submitMotm() {
    if (!match) return;
    if (!selfSaved) return setErr("Vul eerst jezelf + goals/assists in.");
    setErr("");
    if (!pick1 || !pick2 || !pick3 || new Set([pick1, pick2, pick3]).size !== 3) {
      return setErr("Kies 3 verschillende spelers voor Man van de Match.");
    }
    setLoading(true);
    const payload = [
      { match_id: match.id, roster_id: pick1, weight: 3, voter_roster_id: selfId },
      { match_id: match.id, roster_id: pick2, weight: 2, voter_roster_id: selfId },
      { match_id: match.id, roster_id: pick3, weight: 1, voter_roster_id: selfId },
    ];
    const { error } = await supabase.from("votes").insert(payload);
    setLoading(false);
    if (error) return setErr(error.message);
    setPick1(""); setPick2(""); setPick3("");
    await refreshResults();
    alert("MOTM-stem geregistreerd ✅");
  }

  async function submitDonkey() {
    if (!match) return;
    if (!selfSaved) return setErr("Vul eerst jezelf + goals/assists in.");
    setErr("");
    if (!donkeyPick) return setErr("Kies iemand voor Ezel van de Match.");
    if (donkeyReason.length > 280) return setErr("Tekst is te lang (max 280 tekens).");
    setLoading(true);
    const { error } = await supabase.from("donkey_votes").insert({
      match_id: match.id,
      roster_id: donkeyPick,
      voter_roster_id: selfId,
      reason: donkeyReason || null,
    });
    setLoading(false);
    if (error) return setErr(error.message);
    setDonkeyPick(""); setDonkeyReason("");
    await refreshResults();
    alert("Ezel-stem geregistreerd 🫏");
  }

  /** Resultaten + stats + wie->wie ophalen */
  async function refreshResults() {
    if (!match) return;

    // MOTM scores + ballots
    const { data: v } = await supabase
      .from("votes")
      .select("match_id, roster_id, voter_roster_id, weight, created_at");
    const motm = {};
    const ballots = [];
    (v || []).forEach((r) => {
      if (r.match_id !== match.id) return;
      motm[r.roster_id] = (motm[r.roster_id] || 0) + (r.weight || 0);
      ballots.push({
        voterName: nameOf(r.voter_roster_id),
        pickName: nameOf(r.roster_id),
        weight: r.weight,
        created_at: r.created_at,
      });
    });
    ballots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setMotmScores(motm);
    setMotmBallots(ballots.slice(0, 60)); // laatste 60 regels max

    // Donkey counts + ballots
    const { data: d } = await supabase
      .from("donkey_votes")
      .select("match_id, roster_id, voter_roster_id, reason, created_at");
    const counts = {};
    const dBallots = [];
    (d || []).forEach((r) => {
      if (r.match_id !== match.id) return;
      counts[r.roster_id] = (counts[r.roster_id] || 0) + 1;
      dBallots.push({
        voterName: nameOf(r.voter_roster_id),
        pickName: nameOf(r.roster_id),
        reason: r.reason,
        created_at: r.created_at,
      });
    });
    dBallots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setDonkeyScores(counts);
    setDonkeyReasons(
      dBallots
        .filter((x) => !!x.reason)
        .slice(0, 6)
        .map((x) => ({ name: x.pickName, reason: x.reason, created_at: x.created_at }))
    );
    setDonkeyBallots(dBallots.slice(0, 60));

    // player_stats
    const { data: ps } = await supabase
      .from("player_stats")
      .select("match_id, roster_id, goals, assists");
    const sm = {};
    (ps || []).forEach((r) => {
      if (r.match_id !== match.id) return;
      const prev = sm[r.roster_id] || { goals: 0, assists: 0 };
      sm[r.roster_id] = {
        goals: prev.goals + (r.goals || 0),
        assists: prev.assists + (r.assists || 0),
      };
    });
    setStatsMap(sm);
  }

  const motmRanking = useMemo(() => {
    return roster
      .map((p) => ({ id: p.id, name: p.name, points: motmScores[p.id] || 0 }))
      .sort((a, b) => b.points - a.points);
  }, [roster, motmScores]);

  const donkeyRanking = useMemo(() => {
    return roster
      .map((p) => ({ id: p.id, name: p.name, votes: donkeyScores[p.id] || 0 }))
      .sort((a, b) => b.votes - a.votes);
  }, [roster, donkeyScores]);

  /** overzicht goals/assists (alleen >0 of ingevuld) */
  const statsRows = useMemo(() => {
    return roster
      .map((p) => {
        const s = statsMap[p.id] || { goals: 0, assists: 0 };
        return { id: p.id, name: p.name, goals: s.goals, assists: s.assists };
      })
      .filter((r) => r.goals > 0 || r.assists > 0)
      .sort((a, b) => (b.goals - a.goals) || (b.assists - a.assists) || a.name.localeCompare(b.name));
  }, [roster, statsMap]);

  return (
    <div className="container">
      <div className="header">
        <span className="badge">ENE CHILE</span>
        <div>
          <div className="title">Man van de Match | Ezel van de Match</div>
          <div className="subtitle">Stem na de match vanaf je gsm – 3·2·1 punten en één ezel</div>
        </div>
      </div>

      {!match && (
        <div className="grid grid-2">
          <div className="card">
            <div className="section-title">Deelnemen</div>
            <p className="small">Kies eenvoudig een recente match of gebruik een code.</p>

            {/* Recente matchen dropdown */}
            <div className="row" style={{ marginTop: 6 }}>
              <select
                className="select"
                onChange={(e) => joinById(e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>
                  Kies een recente match…
                </option>
                {recentMatches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.code ? `(${m.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Of: code invullen */}
            <div className="row" style={{ marginTop: 8 }}>
              <input
                className="input"
                placeholder="Matchcode (bv. 7F2KQX)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              />
              <button className="btn" onClick={() => joinByCode()} disabled={loading}>
                Join
              </button>
            </div>
          </div>

          <div className="card">
            <div className="section-title">Nieuwe match</div>
            <p className="small">Start een nieuwe match en deel de code/QR.</p>
            <button className="btn" onClick={createMatch} disabled={loading}>
              Nieuwe match starten
            </button>
          </div>
        </div>
      )}

      {match && (
        <div className="grid grid-2" style={{ marginTop: 12 }}>
          {/* LINKS */}
          <div className="grid" style={{ gap: 12 }}>
            {/* Match + QR */}
            <div className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div className="section-title">Match</div>
                  <div>
                    <span className="kicker">{match.name}</span> — Code: <b>{code || "—"}</b>
                  </div>
                  {code && (
                    <div className="small" style={{ marginTop: 6 }}>
                      Link: <code>{`${window.location.origin}?code=${code}`}</code>
                      <button
                        className="btn secondary"
                        style={{ marginLeft: 8, padding: "4px 8px" }}
                        onClick={() =>
                          navigator.clipboard.writeText(`${window.location.origin}?code=${code}`)
                        }
                      >
                        Kopieer
                      </button>
                    </div>
                  )}
                </div>
                {code ? (
                  <QR text={`${window.location.origin}?code=${code}`} />
                ) : (
                  <div className="small">QR verschijnt zodra de code is gezet…</div>
                )}
              </div>
            </div>

            {/* Stap 1: Ik ben... + goals/assists */}
            <div className="card">
              <div className="section-title">Stap 1 — Wie ben jij?</div>
              <div className="row">
                <select
                  className="select"
                  value={selfId}
                  onChange={(e) => setSelfId(e.target.value)}
                >
                  <option value="">Kies jezelf (speler)</option>
                  {roster.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <div style={{ flex: 1 }}>
                  <label className="small">Goals (jij in deze match)</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={goals}
                    onChange={(e) => setGoals(e.target.value)}
                    placeholder="0"
                    inputMode="numeric"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="small">Assists (jij in deze match)</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={assists}
                    onChange={(e) => setAssists(e.target.value)}
                    placeholder="0"
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn" onClick={saveSelfAndStats} disabled={loading}>
                  Opslaan
                </button>
                {selfSaved ? (
                  <span className="small">Opgeslagen ✓ — je kan nu stemmen</span>
                ) : (
                  <span className="small">Verplicht voor je kan stemmen</span>
                )}
              </div>
              {err && <p className="small" style={{ color: "crimson" }}>{err}</p>}
            </div>

            {/* MOTM stemmen */}
            <div className="card">
              <div className="section-title">Man van de Match — 3·2·1</div>
              <div className="row">
                <select
                  className="select"
                  value={pick1}
                  onChange={(e) => setPick1(e.target.value)}
                  disabled={!selfSaved}
                >
                  <option value="">1e (3 pt)</option>
                  {options([pick2, pick3]).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  className="select"
                  value={pick2}
                  onChange={(e) => setPick2(e.target.value)}
                  disabled={!selfSaved}
                >
                  <option value="">2e (2 pt)</option>
                  {options([pick1, pick3]).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  className="select"
                  value={pick3}
                  onChange={(e) => setPick3(e.target.value)}
                  disabled={!selfSaved}
                >
                  <option value="">3e (1 pt)</option>
                  {options([pick1, pick2]).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn" onClick={submitMotm} disabled={!selfSaved || loading}>
                  Stem indienen
                </button>
                <button className="btn secondary" onClick={refreshResults} disabled={loading}>
                  Update resultaten
                </button>
              </div>
            </div>

            {/* Ezel stemmen */}
            <div className="card">
              <div className="section-title">🫏 Ezel van de Match</div>
              <div className="row">
                <select
                  className="select"
                  value={donkeyPick}
                  onChange={(e) => setDonkeyPick(e.target.value)}
                  disabled={!selfSaved}
                >
                  <option value="">Kies de ezel 🫏</option>
                  {roster.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginTop: 8 }}>
                <label className="small">Waarom? (optioneel, max 280 tekens)</label>
                <textarea
                  className="input"
                  rows={3}
                  maxLength={280}
                  placeholder="Beschrijf kort de actie/moment"
                  value={donkeyReason}
                  onChange={(e) => setDonkeyReason(e.target.value)}
                  disabled={!selfSaved}
                />
                <div className="small" style={{ textAlign: "right" }}>
                  {donkeyReason.length}/280
                </div>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn" onClick={submitDonkey} disabled={!selfSaved || loading}>
                  Ezel indienen
                </button>
                <button className="btn secondary" onClick={refreshResults} disabled={loading}>
                  Update resultaten
                </button>
              </div>
            </div>
          </div>

          {/* RECHTS */}
          <div className="grid" style={{ gap: 12 }}>
            <div className="card">
              <div className="section-title">🏆 Man van de Match — Ranking</div>
              <div className="grid" style={{ gap: 10 }}>
                {motmRanking.map((r, i) => (
                  <div key={r.id}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <div>{i + 1}. <b>{r.name}</b></div>
                      <div><b>{r.points}</b> pt</div>
                    </div>
                    <div className="bar">
                      <div
                        style={{
                          width: `${
                            motmRanking[0]?.points
                              ? (r.points / motmRanking[0].points) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="section-title">🫏 Ezel van de Match — Telling</div>
              <div className="grid" style={{ gap: 10 }}>
                {donkeyRanking.map((r, i) => (
                  <div key={r.id}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <div>{i + 1}. <b>{r.name}</b></div>
                      <div><b>{r.votes}</b> x</div>
                    </div>
                    <div className="bar">
                      <div
                        style={{
                          width: `${
                            donkeyRanking[0]?.votes
                              ? (r.votes / donkeyRanking[0].votes) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Goals & Assists */}
            <div className="card">
              <div className="section-title">📊 Match stats — Goals & Assists</div>
              {statsRows.length === 0 ? (
                <p className="small">Nog geen stats ingevuld.</p>
              ) : (
                <div style={{ width: "100%", overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left" }}>
                        <th className="small" style={{ padding: "6px 4px" }}>Speler</th>
                        <th className="small" style={{ padding: "6px 4px" }}>Goals</th>
                        <th className="small" style={{ padding: "6px 4px" }}>Assists</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statsRows.map((r) => (
                        <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                          <td style={{ padding: "8px 4px" }}><b>{r.name}</b></td>
                          <td style={{ padding: "8px 4px" }}>{r.goals}</td>
                          <td style={{ padding: "8px 4px" }}>{r.assists}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn secondary" onClick={refreshResults} disabled={loading}>
                  Refresh stats
                </button>
              </div>
            </div>

            {/* NEW: Wie stemde op wie? */}
            <div className="card">
              <div className="section-title">🗳️ Wie stemde op wie?</div>

              <div className="small" style={{ marginBottom: 6 }}>Man van de Match</div>
              {motmBallots.length === 0 ? (
                <p className="small">Nog geen stemmen.</p>
              ) : (
                <ul style={{ paddingLeft: 16, marginBottom: 8 }}>
                  {motmBallots.map((b, i) => (
                    <li key={i} className="small">
                      <b>{b.voterName}</b> → {b.pickName} ({b.weight} pt)
                    </li>
                  ))}
                </ul>
              )}

              <div className="small" style={{ marginTop: 8, marginBottom: 6 }}>Ezel van de Match</div>
              {donkeyBallots.length === 0 ? (
                <p className="small">Nog geen ezel-stemmen.</p>
              ) : (
                <ul style={{ paddingLeft: 16 }}>
                  {donkeyBallots.map((b, i) => (
                    <li key={i} className="small">
                      <b>{b.voterName}</b> → {b.pickName}
                      {b.reason ? <> — “{b.reason}”</> : null}
                    </li>
                  ))}
                </ul>
              )}

              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn secondary" onClick={refreshResults} disabled={loading}>
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
