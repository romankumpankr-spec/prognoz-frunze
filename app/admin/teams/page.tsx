"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Participant = { id: string; display_name: string; role: "player" | "admin" };
type Submission = { user_id: string; submitted_at: string };
type Selection = { user_id: string; team_name: string; created_at: string };

export default function AdminTeamsPage() {
  const supabase = createClient(); const router = useRouter();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [allowed, setAllowed] = useState(false); const [status, setStatus] = useState("");

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login"); return; }
    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (me?.role !== "admin") { router.replace("/dashboard"); return; }
    setAllowed(true);
    const [{ data: p }, { data: s }, { data: picks }] = await Promise.all([
      supabase.from("profiles").select("id,display_name,role").order("display_name"),
      supabase.from("team_draft_submissions").select("user_id,submitted_at").order("submitted_at"),
      supabase.from("team_draft_selections").select("user_id,team_name,created_at").order("created_at")
    ]);
    setParticipants(p ?? []); setSubmissions(s ?? []); setSelections(picks ?? []);
  }
  useEffect(() => { load(); }, []);

  const submitted = useMemo(() => new Set(submissions.map(x => x.user_id)), [submissions]);
  const picksFor = (id: string) => selections.filter(x => x.user_id === id).map(x => x.team_name);

  async function reset(id: string, name: string) {
    if (!confirm(`Сбросить выбор ${name}? Участник сможет выбрать 6 команд заново.`)) return;
    const { error: a } = await supabase.from("team_draft_submissions").delete().eq("user_id", id);
    const { error: b } = await supabase.from("team_draft_selections").delete().eq("user_id", id);
    setStatus(a || b ? "Не удалось сбросить выбор." : `Выбор ${name} сброшен.`);
    await load();
  }

  if (!allowed) return null;
  return <main className="page"><div className="container">
    <header className="header"><div className="logo">ПРОГНОЗ<span>-ФРУНЗЕ</span></div><button className="text-button" onClick={() => router.push("/teams")}>← К турниру</button></header>
    <section className="card"><span className="eyebrow">Администрирование</span><h1>🏆 Турнир «6 команд»</h1><p>Здесь видно, кто уже отправил свой выбор и какие 6 команд выбраны. Подсчёт результатов пока не выполняется.</p></section>
    <section className="card" style={{marginTop:16}}><h2>Статус участников</h2><div style={{display:"grid",gap:0,marginTop:10}}>{participants.filter(p => p.role === "player").map((p,i) => { const picks=picksFor(p.id); const done=submitted.has(p.id); return <div key={p.id} style={{display:"grid",gridTemplateColumns:"32px minmax(130px,180px) 1fr auto",gap:12,alignItems:"center",padding:"14px 0",borderBottom:i===participants.length-2?"none":"1px solid var(--border)"}}><b>{i+1}</b><strong>{p.display_name}</strong><div>{done ? <span>{picks.join(" · ") || "Выбор пуст"}</span> : <span className="badge">Ещё не отправил</span>}</div>{done && <button className="text-button" onClick={()=>reset(p.id,p.display_name)}>Сбросить</button>}</div> })}</div><p className="badge" style={{marginTop:14}}>Отправили: {submissions.length} из {participants.filter(p=>p.role==="player").length}</p>{status&&<p className="status-line">{status}</p>}</section>
  </div></main>;
}
