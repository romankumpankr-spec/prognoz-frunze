"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const target = new Date("2026-09-08T16:45:00+03:00").getTime();

function getLeft() {
  const diff = Math.max(0, target - Date.now());
  return { days: Math.floor(diff / 86400000), hours: Math.floor(diff / 3600000) % 24, minutes: Math.floor(diff / 60000) % 60, seconds: Math.floor(diff / 1000) % 60, done: diff === 0 };
}

export default function Home() {
  const [left, setLeft] = useState(getLeft());
  useEffect(() => { const id = window.setInterval(() => setLeft(getLeft()), 1000); return () => window.clearInterval(id); }, []);

  return (
    <main className="home-page">
      <header className="home-nav">
        <Link href="/" className="home-brand"><span className="brand-mark">◢</span><span><b>ПРОГНОЗ-ФРУНЗЕ</b><small>ВМЕСТЕ К НОВЫМ ПОБЕДАМ!</small></span></Link>
        <nav>
          <Link className="active" href="/">⌂ Главная</Link><Link href="/dashboard">⚽ Прогнозы</Link><Link href="/teams">♟ 6 команд</Link><Link href="/chat">💬 Общий чат</Link><Link href="/dashboard">▥ Статистика</Link><Link href="/dashboard">🏆 Результаты</Link>
        </nav>
        <Link href="/login" className="home-login">Войти →</Link>
      </header>

      <section className="mine-hero">
        <div className="mine-brand"><div className="mine-logo">△</div><b>СУХА БАЛКА</b><span>ГЛУБЖЕ · СИЛЬНЕЕ · РАЗОМ</span></div>
        <div className="countdown-card">
          <div className="countdown-title">⚽ &nbsp; ДО СТАРТА 1-ГО ТУРА</div>
          <div className="countdown-subtitle">ЛИГИ ЧЕМПИОНОВ ОСТАЛОСЬ</div>
          <div className="countdown-grid">
            {[['days','ДНЕЙ'],['hours','ЧАСА'],['minutes','МИНУТ'],['seconds','СЕКУНД']].map(([key,label]) => <div className="count-box" key={key}><strong>{String(left[key as keyof typeof left]).padStart(2,'0')}</strong><span>{label}</span></div>)}
          </div>
          <div className="countdown-message">{left.done ? "1-Й ТУР УЖЕ НАЧАЛСЯ!" : "Большие победы начинаются с глубины!"}</div>
        </div>
        <div className="mine-flag"><div className="flag-mark">△</div><b>СУХА БАЛКА</b></div>
      </section>

      <section className="home-cards">
        <Link href="/dashboard" className="home-card"><span>⚽</span><div><b>Прогнозы</b><small>Делай прогнозы<br/>и набирай очки</small></div><i>→</i></Link>
        <Link href="/teams" className="home-card"><span>♟</span><div><b>6 команд</b><small>Жеребьевка<br/>и распределение</small></div><i>→</i></Link>
        <Link href="/dashboard" className="home-card"><span>▥</span><div><b>Статистика</b><small>Таблицы, результаты<br/>и аналитика</small></div><i>→</i></Link>
        <Link href="/chat" className="home-card"><span>💬</span><div><b>Общий чат</b><small>Общение участников<br/>и новости</small></div><i>→</i></Link>
      </section>

      <section className="home-footer-promo"><div className="quote">“ Сильные люди делают<br/>сильные команды. ”</div><div className="values"><span>⚒<small>КОМАНДА</small></span><span>⌁<small>РАЗВИТИЕ</small></span><span>▥<small>РЕЗУЛЬТАТ</small></span><span>♟<small>БУДУЩЕЕ</small></span></div><div className="sb-sign"><b>СУХА БАЛКА</b><small>БОЛЬШЕ ЧЕМ РАБОТА</small></div></section>
      <div className="home-bottom"><span>© 2026 Прогноз-Фрунзе. Все права защищены.</span><b>ВМЕСТЕ К НОВЫМ ПОБЕДАМ!</b></div>
    </main>
  );
}
