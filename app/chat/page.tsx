"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type Person = { id: string; display_name: string; role: "player" | "admin" };
type DirectMessage = { id: string; sender_id: string; recipient_id: string; body: string; created_at: string };

export default function ChatPage() {
  const supabase = createClient(); const router = useRouter();
  const [me, setMe] = useState(""); const [people, setPeople] = useState<Person[]>([]); const [selected, setSelected] = useState<string>("");
  const [messages, setMessages] = useState<DirectMessage[]>([]); const [body, setBody] = useState(""); const [status, setStatus] = useState("");
  const names = useMemo(() => Object.fromEntries(people.map(p => [p.id, p.display_name])), [people]);

  async function loadPeople() {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) { router.replace("/login"); return; }
    setMe(user.id); const { data } = await supabase.from("profiles").select("id,display_name,role").order("display_name");
    const list = (data ?? []) as Person[]; setPeople(list); if (!selected) setSelected(list.find(p => p.id !== user.id)?.id ?? "");
  }

  async function loadMessages(target: string) {
    if (!me || !target) return;
    const { data, error } = await supabase.from("direct_messages").select("id,sender_id,recipient_id,body,created_at").or(`and(sender_id.eq.${me},recipient_id.eq.${target}),and(sender_id.eq.${target},recipient_id.eq.${me})`).order("created_at", { ascending: true }).limit(200);
    if (error) setStatus(error.message); else setMessages((data ?? []) as DirectMessage[]);
  }

  useEffect(() => { loadPeople(); }, []);
  useEffect(() => { if (selected) loadMessages(selected); }, [selected, me]);
  useEffect(() => {
    if (!me) return;
    const channel = supabase.channel(`direct-${me}`).on("postgres_changes", { event:"INSERT", schema:"public", table:"direct_messages" }, payload => {
      const msg = payload.new as DirectMessage;
      if (msg.sender_id === me || msg.recipient_id === me) setMessages(current => current.some(x => x.id === msg.id) ? current : [...current, msg]);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [me]);

  async function send(e: FormEvent) {
    e.preventDefault(); const text = body.trim(); if (!text || !selected) return;
    const { error } = await supabase.from("direct_messages").insert({ sender_id:me, recipient_id:selected, body:text });
    if (error) setStatus(error.message); else setBody("");
  }

  const selectedName = names[selected] ?? "Участник";
  return <main className="page"><div className="container">
    <header className="header"><div><div className="logo">ПРОГНОЗ<span>-ФРУНЗЕ</span></div><div className="badge">Личные сообщения</div></div><button className="text-button" onClick={() => router.push("/dashboard")}>← В кабинет</button></header>
    <div className="direct-layout">
      <aside className="card direct-people"><h2>Участники</h2>{people.filter(p => p.id !== me).map(p => <button key={p.id} className={`direct-person ${selected === p.id ? "active" : ""}`} onClick={() => setSelected(p.id)}>{p.display_name}{p.role === "admin" ? " · Админ" : ""}</button>)}</aside>
      <section className="card direct-card"><h2>💬 {selectedName}</h2><div className="direct-messages">{messages.length === 0 ? <p className="badge">Сообщений пока нет. Напишите первым.</p> : messages.map(m => <div key={m.id} className={`direct-message ${m.sender_id === me ? "mine" : ""}`}><div className="badge">{m.sender_id === me ? "Вы" : selectedName}</div><div>{m.body}</div></div>)}</div><form className="chat-form" onSubmit={send}><input className="input" value={body} onChange={e => setBody(e.target.value)} maxLength={1000} placeholder="Напишите личное сообщение…" disabled={!selected}/><button className="cta" type="submit" disabled={!selected}>Отправить</button></form>{status && <p className="status-line">{status}</p>}</section>
    </div>
  </div></main>;
}
