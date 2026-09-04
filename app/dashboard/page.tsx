"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type Profile = { display_name: string; role: "player" | "admin" };
type Message = { id: string; user_id: string; body: string; created_at: string };
type Round = { id: string; name: string; sort_order: number };
type Match = { id: string; round_id: string; home_team: string; away_team: string; kickoff_at: string; home_score: number | null; away_score: number | null };
type Prediction = { match_id: string; home_score: number; away_score: number; submitted_at: string | null };
type PredictionResult = { match_id: string; points: number | null };
type Standing = { user_id: string; display_name: string; points: number; scored_matches: number };
type BoardRow = { match_id: string; user_id: string; display_name: string; predicted_home_score: number; predicted_away_score: number; submitted_at: string; points: number | null; home_team: string; away_team: string; kickoff_at: string; home_score: number | null; away_score: number | null; round_id: string };

function formatDate(value: string) { return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Kyiv" }).format(new Date(value)); }

export default function DashboardPage() {
  const router = useRouter(); const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null); const [userId, setUserId] = useState("");
  const [rounds, setRounds] = useState<Round[]>([]); const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({}); const [results, setResults] = useState<Record<string, PredictionResult>>({});
  const [messages, setMessages] = useState<Message[]>([]); const [names, setNames] = useState<Record<string, string>>({}); const [standings, setStandings] = useState<Standing[]>([]); const [board, setBoard] = useState<BoardRow[]>([]);
  const [message, setMessage] = useState(""); const [status, setStatus] = useState(""); const [loadError, setLoadError] = useState(""); const [submittingRound, setSubmittingRound] = useState<string | null>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) { router.replace("/login"); return; }
    setUserId(user.id);
    const [profileQ, roundsQ, matchesQ, predictionsQ, resultsQ, chatQ, standingsQ, boardQ] = await Promise.all([
      supabase.from("profiles").select("display_name, role").eq("id", user.id).single(),
      supabase.from("rounds").select("id,name,sort_order").order("sort_order"),
      supabase.from("matches").select("id,round_id,home_team,away_team,kickoff_at,home_score,away_score").order("kickoff_at"),
      supabase.from("predictions").select("match_id,home_score,away_score,submitted_at").eq("user_id", user.id),
      supabase.from("prediction_results").select("match_id,points").eq("user_id", user.id),
      supabase.from("chat_messages").select("id,user_id,body,created_at").order("created_at", { ascending: true }).limit(100),
      supabase.from("standings").select("user_id,display_name,points,scored_matches").order("points", { ascending: false }).order("display_name"),
      supabase.from("submitted_prediction_board").select("match_id,user_id,display_name,predicted_home_score,predicted_away_score,submitted_at,points,home_team,away_team,kickoff_at,home_score,away_score,round_id").order("kickoff_at").order("display_name"),
    ]);
    const errors = [profileQ.error && `профиль: ${profileQ.error.message}`, roundsQ.error && `туры: ${roundsQ.error.message}`, matchesQ.error && `матчи: ${matchesQ.error.message}`, predictionsQ.error && `прогнозы: ${predictionsQ.error.message}`, resultsQ.error && `результаты: ${resultsQ.error.message}`, chatQ.error && `чат: ${chatQ.error.message}`, standingsQ.error && `таблица: ${standingsQ.error.message}`, boardQ.error && `общая таблица прогнозов: ${boardQ.error.message}`].filter(Boolean) as string[];
    setLoadError(errors.join(" | "));
    setProfile(profileQ.data ?? null); setRounds(roundsQ.data ?? []); setMatches(matchesQ.data ?? []); setStandings(standingsQ.data ?? []); setBoard(boardQ.data ?? []);
    const map: Record<string, Prediction> = {}; for (const x of predictionsQ.data ?? []) map[x.match_id] = x; setPredictions(map);
    const resultMap: Record<string, PredictionResult> = {}; for (const x of resultsQ.data ?? []) resultMap[x.match_id] = x; setResults(resultMap);
    setMessages(chatQ.data ?? []);
    const ids = Array.from(new Set((chatQ.data ?? []).map(x => x.user_id))); if (ids.length) { const { data: people } = await supabase.from("profiles").select("id,display_name").in("id", ids); const n: Record<string,string> = {}; for (const person of people ?? []) n[person.id] = person.display_name; setNames(n); }
  }

  useEffect(() => { load(); const channel = supabase.channel("public-chat").on("postgres_changes", { event:"INSERT", schema:"public", table:"chat_messages" }, async payload => { const msg=payload.new as Message; setMessages(c=>[...c,msg].slice(-100)); const {data}=await supabase.from("profiles").select("display_name").eq("id",msg.user_id).single(); if(data) setNames(c=>({...c,[msg.user_id]:data.display_name})); }).subscribe(); return ()=>{supabase.removeChannel(channel)}; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changePrediction(match: Match, side: "home_score" | "away_score", value: string) {
    setPredictions(x => ({...x, [match.id]: {match_id:match.id, home_score:x[match.id]?.home_score ?? 0, away_score:x[match.id]?.away_score ?? 0, submitted_at:x[match.id]?.submitted_at ?? null, [side]: value === "" ? 0 : Number(value)}}));
  }

  async function savePrediction(match: Match) {
    const value=predictions[match.id]; if(!value || value.submitted_at) return;
    const {error}=await supabase.from("predictions").upsert({match_id:match.id,user_id:userId,home_score:value.home_score,away_score:value.away_score},{onConflict:"match_id,user_id"});
    setStatus(error?"Не удалось сохранить прогноз.":"Прогноз сохранён. Пока не отправлен."); setTimeout(()=>setStatus(""),2500); await load();
  }

  async function submitRound(round: Round) {
    const roundMatches = matches.filter(m => m.round_id === round.id);
    const missing = roundMatches.filter(m => !predictions[m.id]);
    if (missing.length) { setStatus(`Для «${round.name}» нужно сделать прогноз на все ${roundMatches.length} матчей.`); return; }
    setSubmittingRound(round.id);
    const { data, error } = await supabase.rpc("submit_round_predictions", { p_round_id: round.id });
    setSubmittingRound(null);
    setStatus(error ? (error.message || "Не удалось отправить прогнозы.") : `Прогнозы за «${round.name}» отправлены. Теперь видны все прогнозы участников, которые уже отправили свои.`);
    if (!error) await load();
  }

  async function sendMessage(e:FormEvent){e.preventDefault(); const body=message.trim(); if(!body)return; const {error}=await supabase.from("chat_messages").insert({user_id:userId,body}); if(!error)setMessage("");}
  async function logout(){await supabase.auth.signOut();router.replace("/");}

  const submittedRound = (roundId: string) => matches.filter(m => m.round_id === roundId).length > 0 && matches.filter(m => m.round_id === roundId).every(m => predictions[m.id]?.submitted_at);
  const boardMatches = Array.from(new Map(board.map(row => [row.match_id, row])).values());

  return <main className="page"><div className="container">
    <header className="header"><div className="logo">ПРОГНОЗ<span>-ФРУНЗЕ</span></div><div style={{display:"flex",gap:12,alignItems:"center"}}><span className="badge">{profile?.display_name ?? "Участник"}{profile?.role === "admin" ? " · Админ" : ""}</span>{profile?.role === "admin" && <button className="badge" onClick={()=>router.push("/admin")} style={{background:"none",border:0,cursor:"pointer"}}>Админка</button>}<button className="badge" onClick={logout} style={{background:"none",border:0,cursor:"pointer"}}>Выйти</button></div></header>
    {loadError && <section className="card" style={{border:"1px solid #e74c3c",marginBottom:16}}><b>Ошибка загрузки данных</b><div className="badge" style={{marginTop:4}}>{loadError}</div></section>}
    <div className="grid" style={{gridTemplateColumns:"minmax(0,1.7fr) minmax(300px,1fr)"}}>
      <section className="card"><h1>Мои прогнозы</h1><p className="badge" style={{marginBottom:18}}>Сначала заполни все матчи тура. Пока прогноз не отправлен, его никто не видит. После отправки становятся видны все уже отправленные прогнозы участников.</p>
        {rounds.length===0?<p className="badge">Туры пока не добавлены.</p>:rounds.map(round=>{const roundMatches=matches.filter(m=>m.round_id===round.id); const sent=submittedRound(round.id); return <section key={round.id} className="card" style={{marginBottom:18,background:"rgba(23,36,59,.5)"}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><h2 style={{margin:0}}>{round.name}</h2><span className="badge">{sent?"✓ Прогнозы отправлены":"Черновик"}</span></div>{roundMatches.map(match=>{const locked=new Date(match.kickoff_at).getTime()<=Date.now(); const value=predictions[match.id]; const result=results[match.id]; const submitted=!!value?.submitted_at; return <article key={match.id} style={{padding:"14px 0",borderBottom:"1px solid var(--border)"}}><div className="badge">{formatDate(match.kickoff_at)} · {locked?"Приём закрыт":"Приём открыт"}</div><h3 style={{margin:"8px 0 12px"}}>{match.home_team} — {match.away_team}</h3>{match.home_score!==null&&match.away_score!==null&&<p className="badge">Фактический результат: {match.home_score}:{match.away_score}</p>}{submitted?<p style={{fontWeight:800,margin:"8px 0"}}>Мой прогноз: {value!.home_score}:{value!.away_score} · <span className="badge">отправлен</span>{result?.points!==null&&result?.points!==undefined?` · ${result.points} очк.`:""}</p>:locked?<p className="badge">Прогноз не был отправлен вовремя.</p>:<div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><input className="input" style={{maxWidth:80}} type="number" min="0" value={value?.home_score ?? ""} placeholder="0" onChange={e=>changePrediction(match,"home_score",e.target.value)}/><b>:</b><input className="input" style={{maxWidth:80}} type="number" min="0" value={value?.away_score ?? ""} placeholder="0" onChange={e=>changePrediction(match,"away_score",e.target.value)}/><button className="cta" onClick={()=>savePrediction(match)} style={{border:0,cursor:"pointer",marginTop:0}}>Сохранить</button></div>}</article>})}{roundMatches.length>0&&!sent&&<button className="cta" disabled={submittingRound===round.id} onClick={()=>submitRound(round)} style={{border:0,cursor:submittingRound===round.id?"wait":"pointer",width:"100%",justifyContent:"center",marginTop:16}}>{submittingRound===round.id?"Отправляем…":"Отправить прогноз за тур"}</button>}{sent&&<p className="badge" style={{marginTop:14}}>После отправки прогнозы этого тура становятся видны тем участникам, которые тоже отправили свои прогнозы.</p>}</section>})}{status&&<p className="badge">{status}</p>}</section>
      <div style={{display:"grid",gap:16,alignContent:"start"}}>
        <section className="card"><h2 style={{marginTop:0}}>🏆 Турнирная таблица</h2>{standings.length===0?<p className="badge">Пока нет участников.</p>:standings.map((s,i)=><div key={s.user_id} style={{display:"grid",gridTemplateColumns:"32px 1fr auto",gap:8,padding:"10px 0",borderBottom:"1px solid var(--border)"}}><b>{i+1}</b><span>{s.display_name}</span><b>{s.points} очк.</b></div>)}</section>
        <section className="card"><h2 style={{marginTop:0}}>📋 Общая таблица прогнозов</h2><p className="badge">Показываются прогнозы только тех участников, которые уже отправили прогноз за соответствующий тур.</p>{board.length===0?<p className="badge">Пока никто не отправил прогноз.</p>:boardMatches.map(match=>{const rows=board.filter(x=>x.match_id===match.match_id);return <div key={match.match_id} style={{marginTop:14,paddingTop:12,borderTop:"1px solid var(--border)"}}><div><b>{match.home_team} — {match.away_team}</b><div className="badge" style={{marginTop:4}}>{formatDate(match.kickoff_at)}{match.home_score!==null&&match.away_score!==null?` · Факт: ${match.home_score}:${match.away_score}`:""}</div></div><div style={{marginTop:8,display:"grid",gap:6}}>{rows.map(row=><div key={row.user_id} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:8,alignItems:"center",padding:"6px 0"}}><span>{row.display_name}</span><b>{row.predicted_home_score}:{row.predicted_away_score}</b><span className="badge">{row.points===null?"—":`${row.points} очк.`}</span></div>)}</div></div>})}</section>
        <section className="card" style={{display:"flex",flexDirection:"column",minHeight:460}}><h2 style={{marginTop:0}}>💬 Общий чат</h2><p className="badge">Сообщения появляются в реальном времени у всех участников.</p><div style={{flex:1,overflowY:"auto",margin:"12px 0",padding:8,background:"rgba(11,18,32,.55)",borderRadius:12}}>{messages.length===0?<p className="badge">Пока сообщений нет. Напишите первым.</p>:messages.map(msg=><div key={msg.id} style={{marginBottom:12}}><b>{names[msg.user_id]??"Участник"}</b> <span className="badge">{formatDate(msg.created_at)}</span><div style={{marginTop:3,lineHeight:1.4}}>{msg.body}</div></div>)}</div><form onSubmit={sendMessage} style={{display:"flex",gap:8}}><input className="input" value={message} maxLength={1000} placeholder="Напишите сообщение…" onChange={e=>setMessage(e.target.value)}/><button className="cta" type="submit" style={{marginTop:0,border:0,cursor:"pointer"}}>Отправить</button></form></section>
      </div>
    </div>
  </div></main>;
}
