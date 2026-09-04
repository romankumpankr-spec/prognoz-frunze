"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type Round = { id: string; name: string; sort_order: number };
type Match = { id: string; round_id: string; home_team: string; away_team: string; kickoff_at: string; home_score: number | null; away_score: number | null; result_confirmed: boolean };
type Participant = { id: string; display_name: string; role: "player" | "admin" };

export default function AdminPage() {
  const supabase = createClient();
  const router = useRouter();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [roundName, setRoundName] = useState("");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [roundId, setRoundId] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.replace("/login");
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return router.replace("/dashboard");
    setAllowed(true);
    const [{ data: rs }, { data: ms }, { data: ps }] = await Promise.all([
      supabase.from("rounds").select("id,name,sort_order").order("sort_order"),
      supabase.from("matches").select("id,round_id,home_team,away_team,kickoff_at,home_score,away_score,result_confirmed").order("kickoff_at"),
      supabase.from("profiles").select("id,display_name,role").order("display_name"),
    ]);
    setRounds(rs ?? []); setMatches(ms ?? []); setParticipants(ps ?? []);
    if (!roundId && rs?.[0]) setRoundId(rs[0].id);
  }
  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addRound(e: FormEvent) {
    e.preventDefault();
    if (!roundName.trim()) return;
    const { error } = await supabase.from("rounds").insert({ name: roundName.trim(), sort_order: rounds.length + 1 });
    setStatus(error ? "Ошибка при добавлении тура." : "Тур добавлен.");
    if (!error) setRoundName("");
    await load();
  }

  async function addMatch(e: FormEvent) {
    e.preventDefault();
    if (!roundId || !home.trim() || !away.trim() || !kickoff) return;
    const { error } = await supabase.from("matches").insert({ round_id: roundId, home_team: home.trim(), away_team: away.trim(), kickoff_at: new Date(kickoff).toISOString() });
    setStatus(error ? "Ошибка при добавлении матча." : "Матч добавлен.");
    if (!error) { setHome(""); setAway(""); setKickoff(""); }
    await load();
  }

  async function setResult(match: Match, hs: string, as: string) {
    if (match.result_confirmed || hs === "" || as === "") return;
    const { error } = await supabase.from("matches").update({ home_score: Number(hs), away_score: Number(as) }).eq("id", match.id);
    setStatus(error ? "Не удалось сохранить результат." : "Счёт сохранён как черновик. Пока результат не подтверждён, очки не начисляются и прогнозы не раскрываются.");
    await load();
  }

  async function toggleConfirmation(match: Match) {
    if (!match.result_confirmed && (match.home_score === null || match.away_score === null)) {
      setStatus("Сначала укажите фактический счёт, затем подтвердите результат.");
      return;
    }
    const next = !match.result_confirmed;
    const { error } = await supabase.from("matches").update({ result_confirmed: next }).eq("id", match.id);
    setStatus(error ? "Не удалось изменить подтверждение." : next ? "Результат подтверждён. Прогнозы раскрыты, очки начислены." : "Подтверждение снято. Прогнозы снова скрыты, очки убраны.");
    await load();
  }

  if (!allowed) return null;
  return <main className="page"><div className="container">
    <header className="header"><div className="logo">ПРОГНОЗ<span>-ФРУНЗЕ</span></div><button className="badge" onClick={() => router.push("/dashboard")} style={{background:"none",border:0,cursor:"pointer"}}>← В кабинет</button></header>
    <h1>Панель администратора</h1>
    <p className="badge">Добавляйте туры и матчи. После окончания матча внесите фактический счёт, затем отдельно подтвердите результат. Только после подтверждения открываются прогнозы и начисляются очки.</p>

    <section className="card" style={{marginTop:20}}><h2 style={{marginTop:0}}>Участники</h2><div style={{display:"grid",gap:8}}>{participants.map((p,i)=><div key={p.id} style={{display:"grid",gridTemplateColumns:"32px 1fr auto",gap:8,alignItems:"center",padding:"9px 0",borderBottom:i===participants.length-1?"none":"1px solid var(--border)"}}><b>{i+1}</b><span>{p.display_name}</span><span className="badge">{p.role === "admin" ? "Администратор" : "Участник"}</span></div>)}</div></section>

    <div className="grid" style={{gridTemplateColumns:"1fr 1fr",marginTop:20}}>
      <form className="card form" onSubmit={addRound}><h2>Новый тур</h2><input className="input" placeholder="Например: Тур 1" value={roundName} onChange={e=>setRoundName(e.target.value)} required/><button className="cta" type="submit" style={{border:0,cursor:"pointer",marginTop:0}}>Добавить тур</button></form>
      <form className="card form" onSubmit={addMatch}><h2>Новый матч</h2><select className="input" value={roundId} onChange={e=>setRoundId(e.target.value)} required><option value="">Выберите тур</option>{rounds.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select><input className="input" placeholder="Хозяева" value={home} onChange={e=>setHome(e.target.value)} required/><input className="input" placeholder="Гости" value={away} onChange={e=>setAway(e.target.value)} required/><input className="input" type="datetime-local" value={kickoff} onChange={e=>setKickoff(e.target.value)} required/><button className="cta" type="submit" style={{border:0,cursor:"pointer",marginTop:0}}>Добавить матч</button></form>
    </div>
    {status && <p className="badge" style={{marginTop:16}}>{status}</p>}
    <section className="card" style={{marginTop:20}}><h2>Матчи и результаты</h2>{matches.length===0?<p className="badge">Матчей пока нет.</p>:matches.map(m=><div key={m.id} style={{padding:"14px 0",borderBottom:"1px solid var(--border)"}}><div className="badge">{rounds.find(r=>r.id===m.round_id)?.name ?? "Тур"} · {new Date(m.kickoff_at).toLocaleString("ru-RU")}</div><div style={{display:"flex",alignItems:"center",gap:8,marginTop:8,flexWrap:"wrap"}}><b>{m.home_team}</b><input className="input" style={{maxWidth:70}} type="number" min="0" defaultValue={m.home_score ?? ""} disabled={m.result_confirmed} id={`h-${m.id}`}/><span>:</span><input className="input" style={{maxWidth:70}} type="number" min="0" defaultValue={m.away_score ?? ""} disabled={m.result_confirmed} id={`a-${m.id}`}/><b>{m.away_team}</b>{!m.result_confirmed&&<button className="cta" onClick={()=>{const h=(document.getElementById(`h-${m.id}`) as HTMLInputElement).value; const a=(document.getElementById(`a-${m.id}`) as HTMLInputElement).value; setResult(m,h,a)}} style={{border:0,cursor:"pointer",marginTop:0}}>Сохранить счёт</button>}<button className="badge" onClick={()=>toggleConfirmation(m)} style={{background:"none",border:"1px solid var(--border)",cursor:"pointer"}}>{m.result_confirmed?"✓ Результат подтверждён · снять": "Подтвердить результат"}</button></div>{m.result_confirmed&&<div className="badge" style={{marginTop:8}}>После подтверждения прогнозы участников видны в общей таблице, а очки учитываются в турнирной таблице.</div>}</div>)}</section>
  </div></main>;
}
