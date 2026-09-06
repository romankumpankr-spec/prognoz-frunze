"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type OrderItem = { id: string; display_name: string; position: number };
type DraftStatus = { started:boolean; finished:boolean; current_pick:number; round_number:number; current_user_id:string|null; current_user_name:string|null; your_turn:boolean; player_order:OrderItem[]; own_picks:string[]; available_teams:string[]; picked_count:number };
type Pick = { user_id:string; team_name:string; pick_number:number; round_number:number; created_at:string };

type Data = { state: DraftStatus; picks: Pick[] };

export default function AdminTeamsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [data,setData]=useState<Data|null>(null);
  const [allowed,setAllowed]=useState(false);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  async function load(){
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace("/login");return;}
    const {data:me}=await supabase.from("profiles").select("role").eq("id",user.id).single();
    if(me?.role!=="admin"){router.replace("/dashboard");return;}
    setAllowed(true);
    const {data:d,error}=await supabase.rpc("admin_team_draft_data");
    if(error)setMessage(error.message); else setData(d as Data);
  }
  useEffect(()=>{load();},[]);

  async function start(){
    if(!confirm("Провести новый жребий? Все текущие выборы будут сброшены."))return;
    setBusy(true);setMessage("");
    const {data:d,error}=await supabase.rpc("start_team_draft");
    setBusy(false);
    if(error)setMessage(error.message);else{setData({state:d as DraftStatus,picks:[]});setMessage("Жребьевка проведена.");}
  }
  async function reset(){
    if(!confirm("Полностью сбросить турнир «6 команд»? После этого нужно будет провести новый жребий."))return;
    setBusy(true);setMessage("");
    const {error}=await supabase.rpc("reset_team_draft");
    setBusy(false);
    if(error)setMessage(error.message);else{setMessage("Турнир сброшен.");await load();}
  }

  if(!allowed)return null;
  const state=data?.state;
  const picks=data?.picks??[];
  const name=(id:string)=>state?.player_order.find(p=>p.id===id)?.display_name??"Участник";

  return <main className="page"><div className="container">
    <header className="header"><div className="logo">ПРОГНОЗ<span>-ФРУНЗЕ</span></div><button className="text-button" onClick={()=>router.push("/teams")}>← К турниру</button></header>
    <section className="card"><span className="eyebrow">Администрирование</span><h1>👕 Турнир «6 команд»</h1><p>36 команд распределяются между 6 участниками по системе snake draft. Уже выбранные команды не показываются другим участникам, а команда, которая встречается с одной из ваших команд в лиге, недоступна для вашего выбора.</p><div className="top-actions" style={{marginTop:14}}><button className="cta" disabled={busy} onClick={start}>🎲 Новый жребий</button><button className="text-button" disabled={busy} onClick={reset}>Сбросить турнир</button></div>{message&&<p className="status-line">{message}</p>}</section>
    {state?.started&&<>
      <section className="card" style={{marginTop:16}}><div className="section-heading"><div><h2>Порядок выбора</h2><p className="badge">Ход № {state.current_pick<=36?state.current_pick:"завершено"} · Раунд {Math.min(state.round_number,6)}/6</p></div><span className="badge">{state.picked_count}/36</span></div><div className="draft-order-grid">{state.player_order.map((p,i)=><div key={p.id} className={`draft-order-item ${p.id===state.current_user_id?"current":""}`}><span>{i+1}</span><b>{p.display_name}</b>{p.id===state.current_user_id&&<em>ХОД</em>}</div>)}</div></section>
      <section className="card" style={{marginTop:16}}><h2>История выбора</h2>{picks.length===0?<p className="badge">Пока ни одна команда не выбрана.</p>:<div className="draft-table">{picks.map(p=><div className="draft-row" key={p.pick_number}><b>#{p.pick_number} · {name(p.user_id)}</b><span>{p.team_name}</span></div>)}</div>}</section>
    </>}
  </div></main>;
}
