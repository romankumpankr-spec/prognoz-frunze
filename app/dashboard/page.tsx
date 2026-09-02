"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type Profile = { display_name: string; role: "player" | "admin" };
type Message = { id: string; user_id: string; body: string; created_at: string };
type Match = { id: string; home_team: string; away_team: string; kickoff_at: string; home_score: number | null; away_score: number | null };
type Prediction = { match_id: string; home_score: number; away_score: number };
type Standing = { user_id: string; display_name: string; points: number; scored_matches: number };

function formatDate(value: string) { return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Kyiv" }).format(new Date(value)); }

export default function DashboardPage() {
  const router = useRouter(); const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null); const [userId, setUserId] = useState("");
  const [matches, setMatches] = useState<Match[]>([]); const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [messages, setMessages] = useState<Message[]>([]); const [names, setNames] = useState<Record<string, string>>({}); const [standings, setStandings] = useState<Standing[]>([]);
  const [message, setMessage] = useState(""); const [status, setStatus] = useState("");

  async function load() {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) { router.replace("/login"); return; }
    setUserId(user.id);
    const [{ data: p }, { data: ms }, { data: ps }, { data: chat }, { data: st }] = await Promise.all([
      supabase.from("profiles").select("display_name, role").eq("id", user.id).single(),
      supabase.from("matches").select("id, home_team, away_team, kickoff_at, home_score, away_score").order("kickoff_at"),
      supabase.from("predictions").select("match_id, home_score, away_score").eq("user_id", user.id),
      supabase.from("chat_messages").select("id, user_id, body, created_at").order("created_at", { ascending: true }).limit(100),
      supabase.from("standings").select("user_id, display_name, points, scored_matches").order("points", { ascending: false }).order("display_name"),
    ]);
    setProfile(p ?? null); setMatches(ms ?? []); setStandings(st ?? []);
    const map: Record<string, Prediction> = {}; for (const x of ps ?? []) map[x.match_id] = x; setPredictions(map); setMessages(chat ?? []);
    const ids = Array.from(new Set((chat ?? []).map(x => x.user_id))); if (ids.length) { const { data: people } = await supabase.from("profiles").select("id, display_name").in("id", ids); const n: Record<string,string> = {}; for (const person of people ?? []) n[person.id] = person.display_name; setNames(n); }
  }
  useEffect(() => { load(); const channel = supabase.channel("public-chat").on("postgres_changes", { event:"INSERT", schema:"public", table:"chat_messages" }, async payload => { const msg=payload.new as Message; setMessages(c=>[...c,msg].slice(-100)); const {data}=await supabase.from("profiles").select("display_name").eq("id",msg.user_id).single(); if(data) setNames(c=>({...c,[msg.user_id]:data.display_name})); }).subscribe(); return ()=>{supabase.removeChannel(channel)}; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function savePrediction(match: Match) { const value=predictions[match.id]; if(!value) return; const {error}=await supabase.from("predictions").upsert({match_id:match.id,user_id:userId,home_score:value.home_score,away_score:value.away_score},{onConflict:"match_id,user_id"}); setStatus(error?"Не удалось сохранить прогноз.":"Прогноз сохранён."); setTimeout(()=>setStatus(""),2500); }
  async function sendMessage(e:FormEvent){e.preventDefault(); const body=message.trim(); if(!body)return; const {error}=await supabase.from("chat_messages").insert({user_id:userId,body}); if(!error)setMessage("");}
  async function logout(){await supabase.auth.signOut();router.replace("/");}

  return <main className="page"><div className="container">
    <header className="header"><div className="logo">ПРОГНОЗ<span>-ФРУНЗЕ</span></div><div style={{display:"flex",gap:12,alignItems:"center"}}><span className="badge">{profile?.display_name ?? "Участник"}{profile?.role === "admin" ? " · Админ" : ""}</span>{profile?.role === "admin" && <button className="badge" onClick={()=>router.push("/admin")} style={{background:"none",border:0,cursor:"pointer"}}>Админка</button>}<button className="badge" onClick={logout} style={{background:"none",border:0,cursor:"pointer"}}>Выйти</button></div></header>
    <div className="grid" style={{gridTemplateColumns:"minmax(0,1.7fr) minmax(300px,1fr)"}}>
      <section className="card"><h1>Мои прогнозы</h1><p className="badge" style={{marginBottom:18}}>Прогноз можно менять до начала матча. Чужие прогнозы до дедлайна не показываются.</p>{matches.length===0?<p className="badge">Матчи пока не добавлены. Их добавит администратор.</p>:matches.map(match=>{const locked=new Date(match.kickoff_at).getTime()<=Date.now();const value=predictions[match.id]??{match_id:match.id,home_score:0,away_score:0};return <article key={match.id} className="card" style={{marginBottom:12,background:"rgba(23,36,59,.65)"}}><div className="badge">{formatDate(match.kickoff_at)} · {locked?"Прогноз закрыт":"Приём прогнозов открыт"}</div><h3 style={{margin:"8px 0 12px"}}>{match.home_team} — {match.away_team}</h3>{match.home_score!==null&&match.away_score!==null&&<p className="badge">Результат: {match.home_score}:{match.away_score}</p>}<div style={{display:"flex",gap:8,alignItems:"center"}}><input className="input" style={{maxWidth:80}} type="number" min="0" value={value.home_score} disabled={locked} onChange={e=>setPredictions(x=>({...x,[match.id]:{...value,home_score:Number(e.target.value)}}))}/><b>:</b><input className="input" style={{maxWidth:80}} type="number" min="0" value={value.away_score} disabled={locked} onChange={e=>setPredictions(x=>({...x,[match.id]:{...value,away_score:Number(e.target.value)}}))}/>{!locked&&<button className="cta" onClick={()=>savePrediction(match)} style={{border:0,cursor:"pointer",marginTop:0}}>Сохранить</button>}</div></article>})}{status&&<p className="badge">{status}</p>}</section>
      <div style={{display:"grid",gap:16,alignContent:"start"}}>
        <section className="card"><h2 style={{marginTop:0}}>🏆 Турнирная таблица</h2>{standings.length===0?<p className="badge">Пока нет участников.</p>:standings.map((s,i)=><div key={s.user_id} style={{display:"grid",gridTemplateColumns:"32px 1fr auto",gap:8,padding:"10px 0",borderBottom:"1px solid var(--border)"}}><b>{i+1}</b><span>{s.display_name}</span><b>{s.points} очк.</b></div>)}</section>
        <section className="card" style={{display:"flex",flexDirection:"column",minHeight:460}}><h2 style={{marginTop:0}}>💬 Общий чат</h2><p className="badge">Сообщения появляются в реальном времени у всех участников.</p><div style={{flex:1,overflowY:"auto",margin:"12px 0",padding:8,background:"rgba(11,18,32,.55)",borderRadius:12}}>{messages.length===0?<p className="badge">Пока сообщений нет. Напишите первым.</p>:messages.map(msg=><div key={msg.id} style={{marginBottom:12}}><b>{names[msg.user_id]??"Участник"}</b> <span className="badge">{formatDate(msg.created_at)}</span><div style={{marginTop:3,lineHeight:1.4}}>{msg.body}</div></div>)}</div><form onSubmit={sendMessage} style={{display:"flex",gap:8}}><input className="input" value={message} maxLength={1000} placeholder="Напишите сообщение…" onChange={e=>setMessage(e.target.value)}/><button className="cta" type="submit" style={{marginTop:0,border:0,cursor:"pointer"}}>Отправить</button></form></section>
      </div>
    </div>
  </div></main>;
}
