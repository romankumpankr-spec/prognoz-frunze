"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type Profile = { id: string; display_name: string; role: "player" | "admin" };
type Selection = { user_id: string; team_name: string; created_at: string };
type Submission = { user_id: string; submitted_at: string };

const TEAMS = [
  "АЕК Афины", "Астон Вилла", "Арсенал", "Атлетико", "Барселона", "Бавария", "Бетис", "Боруссия Дортмунд", "Брюгге", "Будё-Глимт", "Викинг", "Вильярреал", "Галатасарай", "Интер", "Комо", "Ланс", "ЛАСК", "Лейпциг", "Лилль", "Ливерпуль", "МЮ", "Ман Сити", "Наполи", "Порту", "ПСВ", "ПСЖ", "Реал", "Рома", "Сабах", "Славия", "Слован", "Спортинг", "Шахтер", "Штутгарт", "Фейеноорд", "Фенербахче"
];

export default function TeamsPage() {
  const supabase = createClient(); const router = useRouter();
  const [userId, setUserId] = useState(""); const [profile, setProfile] = useState<Profile | null>(null); const [profiles, setProfiles] = useState<Record<string,string>>({});
  const [selected, setSelected] = useState<string[]>([]); const [submitted, setSubmitted] = useState<Submission[]>([]); const [selections, setSelections] = useState<Selection[]>([]);
  const [status, setStatus] = useState(""); const [saving, setSaving] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) { router.replace("/login"); return; }
    setUserId(user.id);
    const [{ data: p }, { data: mine }, { data: subs }, { data: all }, { data: people }] = await Promise.all([
      supabase.from("profiles").select("id,display_name,role").eq("id", user.id).single(),
      supabase.from("team_draft_selections").select("team_name,created_at").eq("user_id", user.id).order("created_at"),
      supabase.from("team_draft_submissions").select("user_id,submitted_at").order("submitted_at"),
      supabase.from("team_draft_selections").select("user_id,team_name,created_at").order("created_at"),
      supabase.from("profiles").select("id,display_name").order("display_name")
    ]);
    const nameMap: Record<string,string> = {}; for (const person of people ?? []) nameMap[person.id] = person.display_name;
    setProfile(p ?? null); setProfiles(nameMap); setSelected((mine ?? []).map(x => x.team_name)); setSubmitted(subs ?? []); setSelections(all ?? []);
  }
  useEffect(() => { load(); }, []);

  const submittedSet = useMemo(() => new Set(submitted.map(x => x.user_id)), [submitted]);
  const visiblePeople = useMemo(() => Array.from(new Set(selections.filter(x => submittedSet.has(x.user_id)).map(x => x.user_id))), [selections, submittedSet]);

  function toggleTeam(team: string) {
    if (submittedSet.has(userId)) return;
    setSelected(current => current.includes(team) ? current.filter(x => x !== team) : current.length >= 6 ? current : [...current, team]);
  }

  async function save() {
    if (selected.length !== 6) { setStatus("Нужно выбрать ровно 6 команд."); return; }
    setSaving(true); setStatus("");
    const { error: deleteError } = await supabase.from("team_draft_selections").delete().eq("user_id", userId);
    if (deleteError) { setSaving(false); setStatus("Не удалось сохранить выбор."); return; }
    const { error: insertError } = await supabase.from("team_draft_selections").insert(selected.map(team_name => ({ user_id: userId, team_name })));
    if (insertError) { setSaving(false); setStatus("Не удалось сохранить команды."); return; }
    const { error: submitError } = await supabase.from("team_draft_submissions").insert({ user_id: userId });
    setSaving(false); setStatus(submitError ? (submitError.message || "Не удалось отправить выбор.") : "Выбор из 6 команд отправлен.");
    await load();
  }

  async function logout(){ await supabase.auth.signOut(); router.replace("/"); }

  return <main className="page"><div className="container">
    <header className="header"><div className="logo">ПРОГНОЗ<span>-ФРУНЗЕ</span></div><div className="top-actions"><span className="badge">{profile?.display_name ?? "Участник"}</span>{profile?.role === "admin" && <button className="text-button" onClick={()=>router.push("/admin")}>Админка</button>}<button className="text-button" onClick={logout}>Выйти</button></div></header>
    <section className="card team-hero"><span className="eyebrow">Отдельный турнир</span><h1>🏆 Выбор 6 команд</h1><p>Каждый участник выбирает ровно 6 команд. На этом этапе мы только фиксируем выбор. Подсчёт очков и итоговая таблица результатов будут добавлены позже.</p><div className="team-counter"><strong>{selected.length}/6</strong><span>{submittedSet.has(userId) ? "Выбор отправлен" : selected.length === 6 ? "Можно отправлять" : `Нужно выбрать ещё ${6-selected.length}`}</span></div></section>
    <div className="team-layout">
      <section className="card"><div className="section-heading"><div><h2>Команды</h2><p className="badge">Нажми на команду, чтобы выбрать или убрать её.</p></div><span className="badge">{TEAMS.length} команд</span></div><div className="team-grid">{TEAMS.map(team=><button key={team} className={`team-option ${selected.includes(team)?"selected":""}`} disabled={submittedSet.has(userId)} onClick={()=>toggleTeam(team)}><span>{selected.includes(team)?"✓":"○"}</span>{team}</button>)}</div>{!submittedSet.has(userId)&&<button className="cta team-submit" disabled={saving} onClick={save}>{saving?"Сохраняем…":"Отправить выбор 6 команд"}</button>}{status&&<p className="status-line">{status}</p>}</section>
      <aside className="card"><h2>Мой выбор</h2>{selected.length===0?<p className="badge">Пока ничего не выбрано.</p>:<ol className="selected-list">{selected.map(t=><li key={t}>{t}</li>)}</ol>}<div className="mini-stat"><strong>{submitted.length}/6</strong><span>участников уже сделали выбор</span></div><p className="badge" style={{marginTop:14}}>После отправки изменить выбор пока нельзя.</p></aside>
    </div>
    <section className="card" style={{marginTop:16}}><h2>📋 Выбор участников</h2><p className="badge">Здесь отображаются только участники, которые уже отправили свои 6 команд.</p>{visiblePeople.length===0?<p className="badge">Пока никто не отправил выбор.</p>:<div className="draft-table">{visiblePeople.map(id=>{const picks=selections.filter(x=>x.user_id===id).map(x=>x.team_name); return <div className="draft-row" key={id}><b>{profiles[id] ?? "Участник"}</b><span>{picks.join(" · ")}</span></div>})}</div>}</section>
  </div></main>;
}
