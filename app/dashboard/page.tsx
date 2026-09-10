"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { MatchPreview } from "./match-preview";
import { MatchVideo } from "./match-video";

type Profile = { display_name: string; role: "player" | "admin" };
type Message = { id: string; user_id: string; body: string; created_at: string };
type Round = { id: string; name: string; sort_order: number };
type Match = { id: string; round_id: string; home_team: string; away_team: string; kickoff_at: string; home_score: number | null; away_score: number | null; youtube_url: string | null };
type Prediction = { match_id: string; home_score: string; away_score: string; submitted_at: string | null };
type PredictionResult = { match_id: string; points: number | null };
type Standing = { user_id: string; display_name: string; points: number; scored_matches: number };
type BoardRow = { match_id: string; user_id: string; display_name: string; predicted_home_score: number; predicted_away_score: number; submitted_at: string; points: number | null; home_team: string; away_team: string; kickoff_at: string; home_score: number | null; away_score: number | null; round_id: string };

function formatDate(value: string) { return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Kyiv" }).format(new Date(value)); }

export default function DashboardPage() {
  const router = useRouter(); const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null); const [userId, setUserId] = useState("");
  const [rounds, setRounds] = useState<Round[]>([]); const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({}); const [savedDrafts, setSavedDrafts] = useState<Record<string, boolean>>({}); const [results, setResults] = useState<Record<string, PredictionResult>>({});
  const [messages, setMessages] = useState<Message[]>([]); const [names, setNames] = useState<Record<string, string>>({}); const [standings, setStandings] = useState<Standing[]>([]); const [board, setBoard] = useState<BoardRow[]>([]);
  const [message, setMessage] = useState(""); const [status, setStatus] = useState(""); const [loadError, setLoadError] = useState(""); const [submittingRound, setSubmittingRound] = useState<string | null>(null); const [boardOpen, setBoardOpen] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) { router.replace("/login"); return; }
    setUserId(user.id);
    const [profileQ, roundsQ, matchesQ, predictionsQ, resultsQ, chatQ, standingsQ, boardQ] = await Promise.all([
      supabase.from("profiles").select("display_name, role").eq("id", user.id).single(),
      supabase.from("rounds").select("id,name,sort_order").order("sort_order"),
      supabase.from("matches").select("id,round_id,home_team,away_team,kickoff_at,home_score,away_score,youtube_url").order("kickoff_at"),
      supabase.from("predictions").select("match_id,home_score,away_score,submitted_at").eq("user_id", user.id),
      supabase.from("prediction_results").select("match_id,points").eq("user_id", user.id),
      supabase.from("chat_messages").select("id,user_id,body,created_at").order("created_at", { ascending: true }).limit(100),
      supabase.from("standings").select("user_id,display_name,points,scored_matches").order("points", { ascending: false }).order("display_name"),
      supabase.from("submitted_prediction_board").select("match_id,user_id,display_name,predicted_home_score,predicted_away_score,submitted_at,points,home_team,away_team,kickoff_at,home_score,away_score,round_id").order("kickoff_at").order("display_name"),
    ]);
    const errors = [profileQ.error && `профиль: ${profileQ.error.message}`, roundsQ.error && `туры: ${roundsQ.error.message}`, matchesQ.error && `матчи: ${matchesQ.error.message}`, predictionsQ.error && `прогнозы: ${predictionsQ.error.message}`, resultsQ.error && `результаты: ${resultsQ.error.message}`, chatQ.error && `чат: ${chatQ.error.message}`, standingsQ.error && `таблица: ${standingsQ.error.message}`, boardQ.error && `общая таблица прогнозов: ${boardQ.error.message}`].filter(Boolean) as string[];
    setLoadError(errors.join(" | ")); setProfile(profileQ.data ?? null); setRounds(roundsQ.data ?? []); setMatches(matchesQ.data ?? []); setStandings(standingsQ.data ?? []); setBoard(boardQ.data ?? []);
    const map: Record<string, Prediction> = {}; const saved: Record<string, boolean> = {};
    for (const x of predictionsQ.data ?? []) { map[x.match_id] = { match_id:x.match_id, home_score:String(x.home_score), away_score:String(x.away_score), submitted_at:x.submitted_at }; saved[x.match_id] = true; }
    setPredictions(map); setSavedDrafts(saved);
    const resultMap: Record<string, PredictionResult> = {}; for (const x of resultsQ.data ?? []) resultMap[x.match_id] = x; setResults(resultMap); setMessages(chatQ.data ?? []);
    const ids = Array.from(new Set((chatQ.data ?? []).map(x => x.user_id))); if (ids.length) { const { data: people } = await supabase.from("profiles").select("id,display_name").in("id", ids); const n: Record<string,string> = {}; for (const person of people ?? []) n[person.id] = person.display_name; setNames(n); }
  }

  useEffect(() => { load(); const channel = supabase.channel("public-chat").on("postgres_changes", { event:"INSERT", schema:"public", table:"chat_messages" }, async payload => { const msg=payload.new as Message; setMessages(c=>[...c,msg].slice(-100)); const {data}=await supabase.from("profiles").select("display_name").eq("id",msg.user_id).single(); if(data) setNames(c=>({...c,[msg.user_id]:data.display_name})); }).subscribe(); return ()=>{supabase.removeChannel(channel)}; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changePrediction(match: Match, side: "home_score" | "away_score", value: string) {
    if (value !== "" && !/^\d{0,2}$/.test(value)) return;
    setPredictions(x => ({...x, [match.id]: {match_id:match.id, home_score:side === "home_score" ? value : (x[match.id]?.home_score ?? ""), away_score:side === "away_score" ? value : (x[match.id]?.away_score ?? ""), submitted_at:x[match.id]?.submitted_at ?? null}}));
    setSavedDrafts(x => ({...x, [match.id]: false}));
  }

  async function savePrediction(match: Match) {
    const value=predictions[match.id]; if(!value || value.submitted_at) return;
    if (value.home_score === "" || value.away_score === "") { setStatus("Укажи оба счёта: хозяева и гости."); return; }
    const {error}=await supabase.from("predictions").upsert({match_id:match.id,user_id:userId,home_score:Number(value.home_score),away_score:Number(value.away_score)},{onConflict:"match_id,user_id"});
    if (!error) { setSavedDrafts(x=>({...x,[match.id]:true})); setStatus("Прогноз сохранён как черновик."); await load(); }
    else setStatus(`Не удалось сохранить прогноз: ${error.message}`);
    setTimeout(()=>setStatus(""),2500);
  }

  async function submitRound(round: Round) {
    const roundMatches=matches.filter(m=>m.round_id===round.id); const missing=roundMatches.filter(m=>!predictions[m.id]||predictions[m.id].home_score===""||predictions[m.id].away_score==="");
    if(missing.length){setStatus(`Для «${round.name}» нужно указать оба счёта во всех ${roundMatches.length} матчах.`);return;}
    setSubmittingRound(round.id); const {error}=await supabase.rpc("submit_round_predictions",{p_round_id:round.id}); setSubmittingRound(null);
    setStatus(error?(error.message||"Не удалось отправить прогнозы."):`Прогнозы за «${round.name}» отправлены. Теперь видны прогнозы участников, которые тоже отправили этот тур.`); if(!error) await load();
  }

  async function sendMessage(e:FormEvent){e.preventDefault();const body=message.trim();if(!body)return;const {error}=await supabase.from("chat_messages").insert({user_id:userId,body});if(!error)setMessage("");}
  async function logout(){await supabase.auth.signOut();router.replace("/");}
  const submittedRound=(roundId:string)=>{const ms=matches.filter(m=>m.round_id===roundId);return ms.length>0&&ms.every(m=>predictions[m.id]?.submitted_at);};
  const boardMatches=Array.from(new Map(board.map(row=>[row.match_id,row])).values());
  const boardCount=(roundId:string)=>new Set(board.filter(row=>row.round_id===roundId).map(row=>row.user_id)).size;

  return <main className="page"><div className="container">
    <header className="header"><div className="logo">ПРОГНОЗ<span>-ФРУНЗЕ</span></div><div className="top-actions"><span className="badge">{profile?.display_name??"Участник"}{profile?.role==="admin"?" · Админ":""}</span>{profile?.role==="admin"&&<button className="text-button" onClick={()=>router.push("/admin")}>Админка</button>}<button className="text-button" onClick={logout}>Выйти</button></div></header>
    {loadError&&<section className="card error-card"><b>Ошибка загрузки данных</b><div className="badge">{loadError}</div></section>}
    <div className="grid dashboard-grid">
      <section className="card"><h1>Мои прогнозы</h1><p className="badge intro">Заполни все матчи тура. До отправки твои прогнозы скрыты. После отправки открываются прогнозы всех участников, которые уже отправили этот же тур.</p>
        {rounds.length===0?<p className="badge">Туры пока не добавлены.</p>:rounds.map(round=>{const roundMatches=matches.filter(m=>m.round_id===round.id);const sent=submittedRound(round.id);return <section key={round.id} className="card round-card"><div className="round-head"><h2>{round.name}</h2><span className="badge">{sent?"✓ Прогнозы отправлены":`Отправили: ${boardCount(round.id)}/6`}</span></div>{roundMatches.map(match=>{const locked=new Date(match.kickoff_at).getTime()<=Date.now();const value=predictions[match.id];const result=results[match.id];const isSubmitted=!!value?.submitted_at;const isSaved=!!savedDrafts[match.id];return <article key={match.id} className="match-card"><div className="badge">{formatDate(match.kickoff_at)} · {locked?"Приём закрыт":"Приём открыт"}</div><h3>{match.home_team} <span>—</span> {match.away_team}</h3>{match.home_score!==null&&match.away_score!==null&&<p className="badge">Фактический результат: {match.home_score}:{match.away_score}</p>}{isSubmitted?<div className="my-prediction">Мой прогноз: <strong>{value!.home_score}:{value!.away_score}</strong> <span className="badge">· отправлен</span>{result?.points!==null&&result?.points!==undefined?<strong> · {result.points} очк.</strong>:null}</div>:locked?<p className="badge">Прогноз не был отправлен вовремя.</p>:<div className="prediction-editor"><div className="score-box"><input className="score-input" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={value?.home_score??""} placeholder="—" aria-label={`Счёт ${match.home_team}`} onChange={e=>changePrediction(match,"home_score",e.target.value)}/><span>:</span><input className="score-input" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={value?.away_score??""} placeholder="—" aria-label={`Счёт ${match.away_team}`} onChange={e=>changePrediction(match,"away_score",e.target.value)}/></div><button className={`cta save-score${isSaved?" saved":""}`} onClick={()=>savePrediction(match)} disabled={isSaved}>{isSaved?"Сохранено":"Сохранить"}</button></div>}<MatchPreview home={match.home_team} away={match.away_team}/><MatchVideo url={match.youtube_url}/></article>})}{roundMatches.length>0&&!sent&&<button className="cta round-submit" disabled={submittingRound===round.id} onClick={()=>submitRound(round)}>{submittingRound===round.id?"Отправляем…":"Отправить прогноз за тур"}</button>}{sent&&<p className="badge round-note">✓ Тур отправлен. Ниже видны участники, которые тоже его отправили.</p>}</section>})}{status&&<p className="status-line">{status}</p>}</section>
      <div className="dashboard-side">
        <section className="card"><h2>🏆 Турнирная таблица</h2>{standings.length===0?<p className="badge">Пока нет участников.</p>:standings.map((s,i)=><div className="standing-row" key={s.user_id}><b>{i+1}</b><span>{s.display_name}</span><b>{s.points} очк.</b></div>)}</section>
        <section className="card board-card"><button type="button" className="board-toggle" onClick={()=>setBoardOpen(v=>!v)} aria-expanded={boardOpen}><span>📋 Общая таблица прогнозов</span><span className="board-chevron">{boardOpen?"▲":"▼"}</span></button>{boardOpen&&<><p className="badge">Видны только участники, которые отправили соответствующий тур.</p>{board.length===0?<p className="badge">Пока никто не отправил прогноз.</p>:boardMatches.map(match=>{const rows=board.filter(x=>x.match_id===match.match_id);return <div className="board-match" key={match.match_id}><div><b>{match.home_team} — {match.away_team}</b><div className="badge">{formatDate(match.kickoff_at)}{match.home_score!==null&&match.away_score!==null?` · Факт: ${match.home_score}:${match.away_score}`:""}</div></div><div className="board-rows">{rows.map(row=><div className="board-row" key={row.user_id}><span>{row.display_name}</span><strong>{row.predicted_home_score}:{row.predicted_away_score}</strong><span className="badge">{row.points===null?"—":`${row.points} очк.`}</span></div>)}</div></div>})}</>}</section>
        <section className="card chat-card"><h2>💬 Общий чат</h2><p className="badge">Сообщения появляются в реальном времени у всех участников.</p><div className="chat-messages">{messages.length===0?<p className="badge">Пока сообщений нет. Напишите первым.</p>:messages.map(msg=><div className="chat-message" key={msg.id}><b>{names[msg.user_id]??"Участник"}</b><span>{msg.body}</span></div>)}</div><form className="chat-form" onSubmit={sendMessage}><input className="input" value={message} onChange={e=>setMessage(e.target.value)} placeholder="Напишите сообщение…" maxLength={1000}/><button className="cta" type="submit">Отправить</button></form></section>
      </div>
    </div>
  </div></main>;
}
