"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {createClient} from "../../lib/supabase/client";

type Row={user_id:string;display_name:string;team_name:string;stage:number;opponent:string|null;result:string|null};
const stages=["Лига","Вышла из лиги","Плей-офф","1/8 финала","1/4 финала","1/2 финала","Финал","🏆 Победитель"];
export default function ChampionPage(){const supabase=createClient(),router=useRouter();const[rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(true);
async function load(){setLoading(true);const{data,error}=await supabase.rpc("champion_tournament_board");if(!error)setRows((data??[]) as Row[]);setLoading(false)}useEffect(()=>{load()},[]);
return <main className="page"><div className="container"><header className="header"><div className="logo">ПРОГНОЗ<span>-ФРУНЗЕ</span></div><button className="text-button" onClick={()=>router.push("/dashboard")}>← В кабинет</button></header><section className="card"><span className="eyebrow">Третий конкурс</span><h1>🏆 Победитель Лиги чемпионов</h1><p className="badge">Здесь нет очков. Побеждает участник, чья выбранная команда пройдет дальше всех.</p></section><section className="card" style={{marginTop:16}}><h2>Выбор участников</h2>{loading?<p>Загрузка…</p>:<div className="draft-table">{rows.map(r=><div className="draft-row" key={r.user_id}><b>{r.display_name}</b><span><strong>{r.team_name}</strong></span><span>{stages[r.stage]??"—"}</span>{r.opponent&&<span>vs {r.opponent}</span>}{r.result&&<span className="badge">{r.result}</span>}</div>)}</div>}</section></div></main>}
