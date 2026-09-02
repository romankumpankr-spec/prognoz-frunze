"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

function authEmail(nickname: string) {
  return `${nickname.trim().toLowerCase()}@prognoz-frunze.local`;
}

export default function LoginPage() {
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail(nickname),
      password,
    });
    setLoading(false);
    if (error) {
      setMessage("Неверный ник или пароль.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="page">
      <div className="container">
        <div className="login card">
          <Link className="badge" href="/">← На главную</Link>
          <h1>Вход в кабинет</h1>
          <p className="badge">Вход по нику и паролю. Email участникам не нужен.</p>
          <form className="form" onSubmit={submit}>
            <label>
              <span className="badge">Ник</span>
              <input className="input" type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} autoComplete="username" required />
            </label>
            <label>
              <span className="badge">Пароль</span>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </label>
            <button className="cta" type="submit" disabled={loading} style={{ border: 0, cursor: loading ? "wait" : "pointer", justifyContent: "center" }}>
              {loading ? "Входим…" : "Войти"}
            </button>
          </form>
          {message && <p className="badge" style={{ marginTop: 16 }}>{message}</p>}
        </div>
      </div>
    </main>
  );
}
