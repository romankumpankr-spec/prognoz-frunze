"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type OrderItem = { id: string; display_name: string; position: number };
type DraftStatus = {
  started: boolean; finished: boolean; current_pick: number; round_number: number;
  current_user_id: string | null; current_user_name: string | null; your_turn: boolean;
  player_order: OrderItem[]; own_picks: string[]; available_teams: string[]; picked_count: number;
};

export default function TeamsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<{ display_name: string; role: "player" | "admin" } | null>(null);
  const [status, setStatus] = useState<DraftStatus | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [starting, setStarting] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login"); return; }
    setUserId(user.id);
    const [{ data: p }, { data: s, error }] = await Promise.all([
      supabase.from("profiles").select("display_name,role").eq("id", user.id).single(),
      supabase.rpc("team_draft_status")
    ]);
    setProfile(p ?? null);
    if (error) setMessage(error.message);
    else setStatus(s as DraftStatus);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const currentOrder = useMemo(() => {
    if (!status) return [];
    return status.player_order.map((p, i) => ({ ...p, isCurrent: p.id === status.current_user_id, isMe: p.id === userId, place: i + 1 }));
  }, [status, userId]);

  async function startDraft() {
    if (!confirm("Провести жребьевку и начать новый турнир «6 команд»? Текущие тестовые выборы будут сброшены.")) return;
    setStarting(true); setMessage("");
    const { data, error } = await supabase.rpc("start_team_draft");
    setStarting(false);
    if (error) setMessage(error.message);
    else { setStatus(data as DraftStatus); setMessage("Жребьевка проведена. Начался первый выбор."); }
  }

  async function pick(team: string) {
    if (!status?.your_turn || picking) return;
    setPicking(true); setMessage("");
    const { data, error } = await supabase.rpc("make_team_draft_pick", { p_team_name: team });
    setPicking(false);
    if (error) setMessage(error.message);
    else { setStatus(data as DraftStatus); setMessage(`Выбрано: ${team}`); }
  }

  async function logout() { await supabase.auth.signOut(); router.replace("/"); }

  if (loading) return <main className="page"><div className="container"><section className="card"><p>Загрузка турнира…</p></section></div></main>;

  return <main className="page"><div className="container">
    <header className="header">
      <div className="logo">ПРОГНОЗ<span>-ФРУНЗЕ</span></div>
      <div className="top-actions">
        <span className="badge">{profile?.display_name ?? "Участник"}</span>
        {profile?.role === "admin" && <button className="text-button" onClick={() => router.push("/admin/teams")}>Админка 6 команд</button>}
        <button className="text-button" onClick={() => router.push("/dashboard")}>Прогнозы</button>
        <button className="text-button" onClick={logout}>Выйти</button>
      </div>
    </header>

    <section className="card team-hero">
      <span className="eyebrow">Отдельный турнир</span>
      <h1>👕 6 команд</h1>
      <p>36 команд распределяются между 6 участниками по жребию. Каждый получает по 6 команд. Выбор идет змейкой: <b>1→2→3→4→5→6, затем 6→5→4→3→2→1</b> и так до 36-й команды.</p>
      <div className="team-counter"><strong>{status?.picked_count ?? 0}/36</strong><span>{!status?.started ? "Жеребьевка еще не начата" : status.finished ? "Все команды распределены" : status.your_turn ? `Ваш ход — выбор №${status.current_pick}` : `Сейчас выбирает ${status.current_user_name ?? "участник"}`}</span></div>
      {profile?.role === "admin" && !status?.started && <button className="cta team-submit" disabled={starting} onClick={startDraft}>{starting ? "Проводим жребий…" : "🎲 Провести жребьевку и начать"}</button>}
      {message && <p className="status-line">{message}</p>}
    </section>

    {status?.started && <>
      <section className="card" style={{marginTop:16}}>
        <div className="section-heading"><div><h2>🎲 Порядок выбора</h2><p className="badge">Порядок определяется случайно один раз в начале турнира.</p></div><span className="badge">Раунд {Math.min(status.round_number, 6)} из 6</span></div>
        <div className="draft-order-grid">{currentOrder.map(p => <div key={p.id} className={`draft-order-item ${p.isCurrent ? "current" : ""} ${p.isMe ? "me" : ""}`}><span>{p.place}</span><b>{p.display_name}</b>{p.isCurrent && <em>ХОД</em>}</div>)}</div>
      </section>

      <div className="team-layout">
        <section className="card">
          <div className="section-heading"><div><h2>{status.your_turn ? "Ваш выбор" : "Доступные команды"}</h2><p className="badge">Команды, уже выбранные другими участниками, и команды, играющие с вашими командами, здесь не показываются.</p></div><span className="badge">Доступно: {status.available_teams.length}</span></div>
          <div className="team-grid">{status.available_teams.map(team => <button key={team} className="team-option" disabled={!status.your_turn || picking} onClick={() => pick(team)}><span>○</span>{team}</button>)}</div>
          {status.your_turn && <p className="badge" style={{marginTop:12}}>Нажми на одну команду — выбор сразу фиксируется.</p>}
        </section>

        <aside className="card">
          <h2>Мои команды</h2>
          {status.own_picks.length === 0 ? <p className="badge">Пока ничего не выбрано.</p> : <ol className="selected-list">{status.own_picks.map(t => <li key={t}>{t}</li>)}</ol>}
          <div className="mini-stat"><strong>{status.own_picks.length}/6</strong><span>ваших команд выбрано</span></div>
          <p className="badge" style={{marginTop:14}}>После каждого выбора очередь автоматически переходит к следующему участнику по змейке.</p>
        </aside>
      </div>
    </>}
  </div></main>;
}
