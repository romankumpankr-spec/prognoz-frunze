"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type Round = { id: string; name: string; sort_order: number };
type Match = { id: string; round_id: string; home_team: string; away_team: string; kickoff_at: string; home_score: number | null; away_score: number | null };
type Participant = { id: string; display_name: string; role: "player" | "admin" };
type Prediction = { match_id: string; user_id: string; home_score: number; away_score: number; submitted_at: string | null };
type Result = { match_id: string; user_id: string; points: number | null };
type VisitStats = { total_visits: number; today: number; last_7_days: number; last_30_days: number };

export default function AdminPage() {
  const supabase = createClient(); const router = useRouter();
  const [rounds,setRounds]=useState<Round[]>([]); const [matches,setMatches]=useState<Match[]>([]); const [participants,setParticipants]=useState<Participant[]>([]); const [predictions,setPredictions]=useState<Prediction[]>([]); const [results,setResults]=useState<Result[]>([]); const [allowed,setAllowed]=useState(false); const [visitStats,setVisitStats]=useState<VisitStats|null>(null);
  const [roundName,setRoundName]=useState(""); const [home,setHome]=useState(""); const [away,setAway]=useState(""); const [kickoff,setKickoff]=useState(""); const [roundId,setRoundId]=useState(""); const [status,setStatus]=useState(""); const [editRound,setEditRound]=useState<string|null>(null); const [editMatch,setEditMatch]=useState<string|null>(null);

  async function load(){
    const {data:{user}}=await supabase.auth.getUser(); if(!user)return router.replace("/login");
    const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).single(); if(profile?.role!=="admin")return router.replace("/dashboard");
    setAllowed(true);
    const [{data:rs},{data:ms},{data:ps},{data:pr},{data:rr},{data:vs,error:vsError}]=await Promise.all([
      supabase.from("rounds").select("id,name,sort_order").order("sort_order"),
      supabase.from("matches").select("id,round_id,home_team,away_team,kickoff_at,home_score,away_score").order("kickoff_at"),
      supabase.from("profiles").select("id,display_name,role").order("display_name"),
      supabase.from("predictions").select("match_id,user_id,home_score,away_score,submitted_at").order("submitted_at"),
      supabase.from("prediction_results").select("match_id,user_id,points"),
      supabase.rpc("admin_site_visit_stats")
    ]);
    setRounds(rs??[]);setMatches(ms??[]);setParticipants(ps??[]);setPredictions(pr??[]);setResults(rr??[]);setVisitStats(vsError?null:vs as VisitStats);if(!roundId&&rs?.[0])setRoundId(rs[0].id);
  }
  useEffect(()=>{load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  async function addRound(e:FormEvent){e.preventDefault();if(!roundName.trim())return;const {error}=await supabase.from("rounds").insert({name:roundName.trim(),sort_order:rounds.length+1});setStatus(error?"Ошибка при добавлении тура.":"Тур добавлен.");if(!error)setRoundName("");await load();}
  async function updateRound(id:string){if(!roundName.trim())return;const {error}=await supabase.from("rounds").update({name:roundName.trim()}).eq("id",id);setStatus(error?"Ошибка изменения тура.":"Тур изменён.");setEditRound(null);setRoundName("");await load();}
  async function deleteRound(id:string){if(!confirm("Удалить тур вместе с его матчами и прогнозами?"))return;const {error}=await supabase.from("rounds").delete().eq("id",id);setStatus(error?"Не удалось удалить тур.":"Тур удалён.");await load();}
  async function addMatch(e:FormEvent){e.preventDefault();if(!roundId||!home.trim()||!away.trim()||!kickoff)return;const {error}=await supabase.from("matches").insert({round_id:roundId,home_team:home.trim(),away_team:away.trim(),kickoff_at:new Date(kickoff).toISOString()});setStatus(error?"Ошибка при добавлении матча.":"Матч добавлен.");if(!error){setHome("");setAway("");setKickoff("");}await load();}
  async function updateMatch(id:string){if(!roundId||!home.trim()||!away.trim()||!kickoff)return;const {error}=await supabase.from("matches").update({round_id:roundId,home_team:home.trim(),away_team:away.trim(),kickoff_at:new Date(kickoff).toISOString()}).eq("id",id);setStatus(error?"Ошибка изменения матча.":"Матч изменён.");setEditMatch(null);setHome("");setAway("");setKickoff("");await load();}
  async function deleteMatch(id:string){if(!confirm("Удалить этот матч и связанные прогнозы?"))return;const {error}=await supabase.from("matches").delete().eq("id",id);setStatus(error?"Не удалось удалить матч.":"Матч удалён.");await load();}
  async function setResult(match:Match,hs:string,as:string){if(hs===""||as==="")return;const {error}=await supabase.from("matches").update({home_score:Number(hs),away_score:Number(as),result_confirmed:true}).eq("id",match.id);setStatus(error?"Не удалось сохранить фактический результат.":"Фактический результат подтверждён. Очки пересчитаны в обоих турнирах.");await load();}
  function startRoundEdit(r:Round){setEditRound(r.id);setRoundName(r.name);}
  function startMatchEdit(m:Match){setEditMatch(m.id);setRoundId(m.round_id);setHome(m.home_team);setAway(m.away_team);setKickoff(new Date(m.kickoff_at).toISOString().slice(0,16));}

  function roundStats(id:string){const ms=matches.filter(m=>m.round_id===id);const sentUsers=new Set(predictions.filter(p=>p.submitted_at&&ms.some(m=>m.id===p.match_id)).map(p=>p.user_id));const complete=participants.filter(p=>p.role==="player"&&ms.length>0&&ms.every(m=>predictions.some(x=>x.match_id===m.id&&x.user_id===p.id&&x.submitted_at))).length;return {sent:sentUsers.size,complete};}
  const predictionFor=(matchId:string,userId:string)=>predictions.find(p=>p.match_id===matchId&&p.user_id===userId);
  const pointsFor=(matchId:string,userId:string)=>results.find(r=>r.match_id===matchId&&r.user_id===userId)?.points;

  if(!allowed)return null;
  return <main className="page"><div className="container">
    <header className="header"><div className="logo">ПРОГНОЗ<span>-ФРУНЗЕ</span></div><button className="badge" onClick={()=>router.push("/dashboard")} style={{background:"none",border:0,cursor:"pointer"}}>← В кабинет</button></header>
    <h1>Панель администратора</h1><p className="badge">Управление турами, матчами, прогнозами и фактическими результатами.</p>

    <section className="card" style={{marginTop:20}}><h2 style={{marginTop:0}}>👁 Посещения сайта</h2><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>{[["Всего",visitStats?.total_visits??0],["Сегодня",visitStats?.today??0],["За 7 дней",visitStats?.last_7_days??0],["За 30 дней",visitStats?.last_30_days??0]].map(([label,value])=><div key={label as string} style={{padding:16,border:"1px solid var(--border)",borderRadius:14}}><div className="badge">{label}</div><div style={{fontSize:28,fontWeight:800,marginTop:6}}>{value}</div></div>)}</div><p className="badge" style={{marginBottom:0}}>Считается один визит за сессию браузера. Данные видит только администратор.</p></section>

    <section className="card" style={{marginTop:20}}><h2 style={{marginTop:0}}>Статус туров</h2>{rounds.length===0?<p className="badge">Туров пока нет.</p>:rounds.map(r=>{const st=roundStats(r.id);return <div key={r.id} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:10,alignItems:"center",padding:"10px 0",borderBottom:"1px solid var(--border)"}}><b>{r.name}</b><span className="badge">Отправили: {st.sent} · полностью: {st.complete}</span><div style={{display:"flex",gap:6}}><button className="badge" onClick={()=>startRoundEdit(r)} style={{cursor:"pointer",background:"none"}}>Изменить</button><button className="badge" onClick={()=>deleteRound(r.id)} style={{cursor:"pointer",background:"none"}}>Удалить</button></div></div>})}</section>

    <section className="card" style={{marginTop:20}}><h2 style={{marginTop:0}}>Участники</h2><div style={{display:"grid",gap:8}}>{participants.map((p,i)=><div key={p.id} style={{display:"grid",gridTemplateColumns:"32px 1fr auto",gap:8,alignItems:"center",padding:"9px 0",borderBottom:i===participants.length-1?"none":"1px solid var(--border)"}}><b>{i+1}</b><span>{p.display_name}</span><span className="badge">{p.role==="admin"?"Администратор":"Участник"}</span></div>)}</div></section>

    <div className="grid" style={{gridTemplateColumns:"1fr 1fr",marginTop:20}}>
      <form className="card form" onSubmit={e=>{e.preventDefault();if(editRound)updateRound(editRound);else addRound(e)}}><h2>{editRound?"Изменить тур":"Новый тур"}</h2><input className="input" placeholder="Например: Тур 2" value={roundName} onChange={e=>setRoundName(e.target.value)} required/><div style={{display:"flex",gap:8}}><button className="cta" type="submit" style={{border:0,cursor:"pointer",marginTop:0}}>{editRound?"Сохранить":"Добавить тур"}</button>{editRound&&<button type="button" className="badge" onClick={()=>{setEditRound(null);setRoundName("")}} style={{cursor:"pointer",background:"none"}}>Отмена</button>}</div></form>
      <form className="card form" onSubmit={e=>{e.preventDefault();if(editMatch)updateMatch(editMatch);else addMatch(e)}}><h2>{editMatch?"Изменить матч":"Новый матч"}</h2><select className="input" value={roundId} onChange={e=>setRoundId(e.target.value)} required><option value="">Выберите тур</option>{rounds.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select><input className="input" placeholder="Хозяева" value={home} onChange={e=>setHome(e.target.value)} required/><input className="input" placeholder="Гости" value={away} onChange={e=>setAway(e.target.value)} required/><input className="input" type="datetime-local" value={kickoff} onChange={e=>setKickoff(e.target.value)} required/><div style={{display:"flex",gap:8}}><button className="cta" type="submit" style={{border:0,cursor:"pointer",marginTop:0}}>{editMatch?"Сохранить":"Добавить матч"}</button>{editMatch&&<button type="button" className="badge" onClick={()=>{setEditMatch(null);setHome("");setAway("");setKickoff("")}} style={{cursor:"pointer",background:"none"}}>Отмена</button>}</div></form>
    </div>
    {status&&<p className="badge" style={{marginTop:16}}>{status}</p>}

    <section className="card" style={{marginTop:20}}><h2>Матчи, прогнозы и фактические результаты</h2>{matches.length===0?<p className="badge">Матчей пока нет.</p>:matches.map(m=>{const round=rounds.find(r=>r.id===m.round_id);const sent=predictions.filter(p=>p.match_id===m.id&&p.submitted_at);return <div key={m.id} style={{padding:"16px 0",borderBottom:"1px solid var(--border)"}}><div className="badge">{round?.name??"Тур"} · {new Date(m.kickoff_at).toLocaleString("ru-RU")} · отправили {sent.length}</div><div style={{display:"flex",alignItems:"center",gap:8,marginTop:8,flexWrap:"wrap"}}><b>{m.home_team}</b><input className="input" style={{maxWidth:70}} type="number" min="0" defaultValue={m.home_score??""} id={`h-${m.id}`}/><span>:</span><input className="input" style={{maxWidth:70}} type="number" min="0" defaultValue={m.away_score??""} id={`a-${m.id}`}/><b>{m.away_team}</b><button className="cta" onClick={()=>{const h=(document.getElementById(`h-${m.id}`) as HTMLInputElement).value;const a=(document.getElementById(`a-${m.id}`) as HTMLInputElement).value;setResult(m,h,a)}} style={{border:0,cursor:"pointer",marginTop:0}}>{m.home_score!==null?"Изменить факт":"Сохранить факт"}</button><button className="badge" onClick={()=>startMatchEdit(m)} style={{cursor:"pointer",background:"none"}}>Изменить матч</button><button className="badge" onClick={()=>deleteMatch(m.id)} style={{cursor:"pointer",background:"none"}}>Удалить</button></div>
      {participants.filter(p=>p.role==="player").map(p=>{const pred=predictionFor(m.id,p.id);const pts=pointsFor(m.id,p.id);return <div key={p.id} style={{display:"grid",gridTemplateColumns:"minmax(130px,1fr) auto auto",gap:10,alignItems:"center",padding:"8px 0",marginTop:6,borderTop:"1px solid rgba(255,255,255,.05)"}}><span>{p.display_name}</span>{pred?.submitted_at?<><b>{pred.home_score}:{pred.away_score}</b><span className="badge">{pts===null||pts===undefined?"Очки после факта":`${pts} очк.`}</span></>:<span className="badge" style={{gridColumn:"2 / 4"}}>Не отправил</span>}</div>})}</div>})}</section>
  </div></main>;
}
