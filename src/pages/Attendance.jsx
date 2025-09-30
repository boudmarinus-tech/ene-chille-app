import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";

function useQuery(){ return new URLSearchParams(useLocation().search); }

export default function Attendance(){
  const q = useQuery();
  const nav = useNavigate();
  const matchIdFromUrl = q.get("match");

  const [roster,setRoster] = useState([]);
  const [recentMatches,setRecentMatches] = useState([]);
  const [currentMatch,setCurrentMatch] = useState(null);

  const [selfId,setSelfId] = useState("");
  const [status,setStatus] = useState("");
  const [loading,setLoading] = useState(false);
  const [err,setErr] = useState("");

  const [records,setRecords] = useState([]);

  const nameOf = (id)=> roster.find(r=>r.id===id)?.name || "Onbekend";

  useEffect(()=>{(async()=>{
    const {data} = await supabase.from("roster").select("id,name").order("name");
    setRoster(data||[]);
  })();},[]);

  useEffect(()=>{(async()=>{
    const {data:m} = await supabase.from("matches")
      .select("id,name,created_at").order("created_at",{ascending:false}).limit(20);
    setRecentMatches(m||[]);
    if(matchIdFromUrl){
      const f=(m||[]).find(x=>x.id===matchIdFromUrl);
      if(f) setCurrentMatch(f);
    } else if(m && m[0]){
      setCurrentMatch(m[0]);
      nav(`?match=${m[0].id}`,{replace:true});
    }
  })();/* eslint-disable-next-line */},[matchIdFromUrl]);

  useEffect(()=>{ refresh(); /* eslint-disable-next-line */},[currentMatch]);

  async function refresh(){
    if(!currentMatch) return;
    const {data,error} = await supabase.from("attendance")
      .select("match_id,roster_id,status,created_at")
      .eq("match_id", currentMatch.id);
    if(error) setErr(error.message);
    else setRecords(data||[]);
  }

  async function save(){
    if(!selfId) return setErr("Kies jezelf.");
    if(!status) return setErr("Kies ja/nee/misschien.");
    setLoading(true); setErr("");
    const {error} = await supabase.from("attendance").upsert(
      { match_id: currentMatch.id, roster_id: selfId, status },
      { onConflict: "match_id,roster_id" }
    );
    setLoading(false);
    if(error) setErr(error.message); else { refresh(); alert("Aanwezigheid opgeslagen ✅"); }
  }

  const byStatus = useMemo(()=>{
    const g={ja:[],nee:[],misschien:[]};
    (records||[]).forEach(r=>{ g[r.status]?.push(nameOf(r.roster_id)); });
    return g;
  },[records,roster]);

  const noResponse = useMemo(()=>{
    const responded = new Set((records||[]).map(r=>r.roster_id));
    return roster.filter(r=>!responded.has(r.id)).map(r=>r.name);
  },[records,roster]);

  function onSelectMatch(id){
    const f = recentMatches.find(m=>m.id===id);
    if(f){ setCurrentMatch(f); nav(`?match=${f.id}`,{replace:true}); }
  }

  return (
    <div className="grid" style={{gap:12}}>
      <div className="card">
        <div className="section-title">Aanwezigheden</div>
        {currentMatch ? (
          <div className="row" style={{justifyContent:"space-between",alignItems:"center"}}>
            <span><b>{currentMatch.name}</b></span>
            <select className="select" value={currentMatch.id} onChange={e=>onSelectMatch(e.target.value)}>
              {recentMatches.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        ) : <p className="small">Laden…</p>}
      </div>

      <div className="card">
        <div className="section-title">Jouw keuze</div>
        <select className="select" value={selfId} onChange={e=>setSelfId(e.target.value)}>
          <option value="">Kies jezelf</option>
          {roster.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="row" style={{gap:8,marginTop:8}}>
          <select className="select" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="">Kies status</option>
            <option value="ja">✅ Ja</option>
            <option value="nee">❌ Nee</option>
            <option value="misschien">🤔 Misschien</option>
          </select>
          <button className="btn" onClick={save} disabled={loading}>Opslaan</button>
        </div>
        {err && <p className="small" style={{color:"crimson"}}>{err}</p>}
      </div>

      <div className="card">
        <div className="section-title">Overzicht</div>
        <div className="small">✅ Ja ({byStatus.ja.length})</div>
        <ul>{byStatus.ja.map(n=><li key={n}>{n}</li>)}</ul>

        <div className="small">❌ Nee ({byStatus.nee.length})</div>
        <ul>{byStatus.nee.map(n=><li key={n}>{n}</li>)}</ul>

        <div className="small">🤔 Misschien ({byStatus.misschien.length})</div>
        <ul>{byStatus.misschien.map(n=><li key={n}>{n}</li>)}</ul>

        <div className="small">Nog geen reactie ({noResponse.length})</div>
        <ul>{noResponse.map(n=><li key={n}>{n}</li>)}</ul>
      </div>
    </div>
  );
}
