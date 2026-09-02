"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Авторизация будет подключена через Supabase. Сначала настроим базу и аккаунты участников.");
  }

  return (
    <main className="page">
      <div className="container">
        <div className="login card">
          <Link className="badge" href="/">← На главную</Link>
          <h1>Вход в кабинет</h1>
          <p className="badge">Ваши прогнозы видите только вы до публикации результатов.</p>
          <form className="form" onSubmit={submit}>
            <label>
              <span className="badge">Email</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              <span className="badge">Пароль</span>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <button className="cta" type="submit" style={{ border: 0, cursor: "pointer", justifyContent: "center" }}>Войти</button>
          </form>
          {message && <p className="badge" style={{ marginTop: 16 }}>{message}</p>}
        </div>
      </div>
    </main>
  );
}
