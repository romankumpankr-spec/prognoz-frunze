"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type OrderItem = { id: string; display_name: string; position: number };
type Participant = { id: string; display_name: string; role: "player" | "admin" };
type DraftStatus = { started:boolean; finished:boolean; current_pick:number; total_picks:number; round_number:number; current_user_id:string|null; current_user_name:string|null; your_turn:boolean; player_order:OrderItem[]; own_picks:string[]; available_teams:string[]; picked_count:number; participant_count:number; };

export default function TeamsPage() {
  const supabase=createClient(); const router=useRouter();
  const [userId,setUserId]=useState(""); const [profile,setProfile]=useState<{display_name:string;role:"player"|"admin"}|null>(null);
  const [status,setStatus]=useState<DraftStatus|null>(null); const [participants,setParticipants]=useState<Participant[]>([]); const [selected,setSelected]=useState<string[]>([]);
  const [message,setMessage]=useState(""); const [loading,setLoading]=useState(true); const [picking,setPicking]=useState(false); const [starting,setStarting]=useState(false);

  async function load(){
    const {data:{user}}=await supabase.auth.getUser(); if(!user){router.replace("/login");return;} setUserId(user.id);
    const [{data:p},{data:s,error},{data:people}]=await Promise.all([
      supabase.from("profiles").select("display_name,role").eq("id",user.id).single(),
      supabase.rpc("team_draft_status"),
      supabase.from("profiles").select("id,display_name,role").order("display_name")
    ]);
    setProfile(p??null); setParticipants((people??[]) as Participant[]); if(error)setMessage(error.message); else {setStatus(s as DraftStatus); if((s as DraftStatus)?.player_order?.length) setSelected((s as DraftStatus).player_order.map(x=>x.id));}
    setLoading(false);
  }
  useEffect(()=>{load();},[]);
  const currentOrder=useMemo(()=>status?.player_order.map((p,i)=>({...p,isCurrent:p.id===status.current_user_id,isMe:p.id===userId,place:i+1}))??[],[status,userId]);

  function toggleParticipant(id:string){setSelected(x=>x.includes(id)?x.filter(v=>v!==id):x.length<6?[...x,id]:x);}
  async function startDraft(){
    if(selected.length<1||selected.length>6){setMessage("Выберите от 1 до 6 участников.");return;}
    if(!confirm(`Участвуют ${selected.length} человек. Провести жребьевку?`))return;
    setStarting(true);setMessage("");
    const {data,error}=await supabase.rpc("start_team_draft",{p_participant_ids:selected}); setStarting(false);
    if(error)setMessage(error.message); else {setStatus(data as DraftStatus);setMessage("Жеребьевка проведена. Начался первый выбор.");}
  }
  async function pick(team:string){if(!status?.your_turn||picking)return;setPicking(true);setMessage("");const {data,error}=await supabase.rpc("make_team_draft_pick",{p_team_name:team});setPicking(false);if(error)setMessage(error.message);else{setStatus(data as DraftStatus);setMessage(`Выбрано: ${team}`);}}
  async function logout(){await supabase.auth.signOut();router.replace("/");}
  if(loading)return <main className="page"><div className="container"><section className="card"><p>Загрузка турнира…</p></section></div></main>;

  return <main className="page"><div className="container">
    <header className="header"><div className="logo">ПРОГНОЗ<span>-ФРУНЗЕ</span></div><div className="top-actions"><span className="badge">{profile?.display_name??"Участник"}</span>{profile?.role==="admin"&&<button className="text-button" onClick={()=>router.push("/admin/teams")}>Админка 6 команд</button>}<button className="text-button" onClick={()=>router.push("/dashboard")}>Прогнозы</button><button className="text-button" onClick={logout}>Выйти</button></div></header>
    <section className="card team-hero"><span className="eyebrow">Отдельный турнир</span><h1>👕 6 команд</h1><p>Перед жребьевкой администратор отмечает участников галочками. Каждый выбранный участник получает ровно 6 команд. Порядок затем определяется случайно, а выбор идет змейкой.</p>
      <div className="team-counter"><strong>{status?.started?`${status.picked_count}/${status.total_picks}`:`${selected.length}/6`}</strong><span>{!status?.started?"Выберите участников для турнира":""}{status?.started&&(status.finished?"Все команды распределены":status.your_turn?`Ваш ход — выбор №${status.current_pick}`:`Сейчас выбирает ${status.current_user_name??"участник"}`)}</span></div>
      {profile?.role==="admin"&&!status?.started&&<div className="participant-picker"><h2>👥 Кто участвует?</h2><p className="badge">Отметьте галочками от 1 до 6 человек. Остальные не будут участвовать в этом турнире.</p><div className="participant-list">{participants.map(p=><label className="participant-check" key={p.id}><input type="checkbox" checked={selected.includes(p.id)} onChange={()=>toggleParticipant(p.id)}/><span>{p.display_name}</span></label>)}</div><button className="cta team-submit" disabled={starting||selected.length<1} onClick={startDraft}>{starting?"Проводим жребий…":"🎲 Провести жребьевку"}</button></div>}
      {message&&<p className="status-line">{message}</p>}
    </section>
    {status?.started&&<><section className="card" style={{marginTop:16}}><div className="section-heading"><div><h2>🎲 Порядок выбора</h2><p className="badge">Порядок определяется случайно один раз в начале турнира.</p></div><span className="badge">Раунд {Math.min(status.round_number,6)} из 6</span></div><div className="draft-order-grid">{currentOrder.map(p=><div key={p.id} className={`draft-order-item ${p.isCurrent?"current":""} ${p.isMe?"me":""}`}><span>{p.place}</span><b>{p.display_name}</b>{p.isCurrent&&<em>ХОД</em>}</div>)}</div></section>
      <div className="team-layout"><section className="card"><div className="section-heading"><div><h2>{status.your_turn?"Ваш выбор":"Доступные команды"}</h2><p className="badge">Выбранные другими команды и команды, играющие с вашими командами, здесь не показываются.</p></div><span className="badge">Доступно: {status.available_teams.length}</span></div><div className="team-grid">{status.available_teams.map(team=><button key={team} className="team-option" disabled={!status.your_turn||picking} onClick={()=>pick(team)}><span>○</span>{team}</button>)}</div>{status.your_turn&&<p className="badge" style={{marginTop:12}}>Нажми на одну команду — выбор сразу фиксируется.</p>}</section><aside className="card"><h2>Мои команды</h2>{status.own_picks.length===0?<p className="badge">Пока ничего не выбрано.</p>:<ol className="selected-list">{status.own_picks.map(t=><li key={t}>{t}</li>)}</ol>}<div className="mini-stat"><strong>{status.own_picks.length}/6</strong><span>ваших команд выбрано</span></div><p className="badge" style={{marginTop:14}}>После каждого выбора очередь автоматически переходит по змейке.</p></aside></div></>}
  </div></main>;
}
