"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import "./home.css";

type HomeMatch = {
  id: string;
  round_id: string;
  round_name: string;
  round_sort_order: number;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  home_score: number | null;
  away_score: number | null;
  result_confirmed: boolean;
};

function kyivDate(value: string | number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function kyivTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Kyiv", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function dayLabel(key: string) {
  return new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Kyiv", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${key}T12:00:00+03:00`));
}

function matchState(match: HomeMatch, now: number) {
  if (match.result_confirmed && match.home_score !== null && match.away_score !== null) return "result" as const;
  const start = new Date(match.kickoff_at).getTime();
  if (now < start) return "upcoming" as const;
  if (now < start + 150 * 60 * 1000) return "live" as const;
  return "waiting" as const;
}

export default function Home() {
  const supabase = createClient();
  const [matches, setMatches] = useState<HomeMatch[]>([]);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");

  async function loadMatches() {
    const { data, error: queryError } = await supabase.rpc("home_match_board");
    if (queryError) setError(queryError.message);
    else setMatches((data ?? []) as HomeMatch[]);
  }

  useEffect(() => {
    loadMatches();
    const clock = window.setInterval(() => setNow(Date.now()), 30000);
    const refresh = window.setInterval(loadMatches, 30000);
    return () => { window.clearInterval(clock); window.clearInterval(refresh); };
  }, []);

  const todayKey = kyivDate(now);
  const dayKeys = useMemo(() => Array.from(new Set(matches.map(m => kyivDate(m.kickoff_at)))).sort(), [matches]);
  const activeDay = dayKeys.includes(todayKey) ? todayKey : (dayKeys.find(day => day > todayKey) ?? dayKeys[dayKeys.length - 1] ?? todayKey);
  const dayMatches = matches.filter(m => kyivDate(m.kickoff_at) === activeDay).sort((a,b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());
  const activeRound = dayMatches[0]?.round_name ?? "1 тур";
  const completed = dayMatches.filter(m => matchState(m, now) === "result").length;
  const nextMatch = dayMatches.find(m => matchState(m, now) === "upcoming");
  const liveMatch = dayMatches.find(m => matchState(m, now) === "live");
  const allDayFinished = dayMatches.length > 0 && completed === dayMatches.length;

  return (
    <main className="home-page">
      <header className="home-nav">
        <Link href="/" className="home-brand"><span className="brand-mark">◢</span><span><b>ПРОГНОЗ-ФРУНЗЕ</b><small>ВМЕСТЕ К НОВЫМ ПОБЕДАМ!</small></span></Link>
        <nav>
          <Link className="active" href="/">⌂ Главная</Link><Link href="/dashboard">⚽ Прогнозы</Link><Link href="/teams">♟ 6 команд</Link><Link href="/chat">💬 Общий чат</Link><Link href="/dashboard">▥ Статистика</Link><Link href="/dashboard">🏆 Результаты</Link>
        </nav>
        <Link href="/login" className="home-login">Войти →</Link>
      </header>

      <section className="mine-hero match-day-hero">
        <div className="match-day-card">
          <div className="match-day-kicker">⚽ &nbsp; {activeRound.toUpperCase()}</div>
          <h1>{allDayFinished ? "ДЕНЬ МАТЧЕЙ ЗАВЕРШЁН" : `СЕГОДНЯ — ${activeRound.toUpperCase()}`}</h1>
          <div className="match-day-date">{dayLabel(activeDay)}</div>

          <div className="match-day-meta">
            <span><b>{dayMatches.length}</b> матчей</span>
            <span><b>{completed}</b> завершено</span>
            {liveMatch ? <span className="live-pill">🔴 МАТЧ ИДЁТ</span> : nextMatch ? <span>⏱ следующий в {kyivTime(nextMatch.kickoff_at)}</span> : <span>✅ все результаты внесены</span>}
          </div>

          <div className="match-list">
            {dayMatches.map(match => {
              const state = matchState(match, now);
              return <div className={`home-match ${state}`} key={match.id}>
                <div className="home-match-time">
                  {state === "live" ? <span className="match-live-dot">●</span> : state === "result" ? "✓" : kyivTime(match.kickoff_at)}
                </div>
                <div className="home-match-teams"><b>{match.home_team}</b><span>—</span><b>{match.away_team}</b></div>
                <div className="home-match-score">
                  {state === "result" ? <strong>{match.home_score} : {match.away_score}</strong> : state === "live" ? <small>МАТЧ ИДЁТ</small> : state === "waiting" ? <small>РЕЗУЛЬТАТ</small> : <small>{kyivTime(match.kickoff_at)}</small>}
                </div>
              </div>;
            })}
            {!dayMatches.length && <div className="match-empty">Матчи пока не добавлены.</div>}
          </div>

          <div className="match-day-footer">
            <span>{error ? "Не удалось обновить расписание" : "Расписание и результаты обновляются автоматически"}</span>
            <Link href="/dashboard">Все прогнозы →</Link>
          </div>
        </div>
      </section>

      <section className="home-cards">
        <Link href="/dashboard" className="home-card"><span>⚽</span><div><b>Прогнозы</b><small>Делай прогнозы<br/>и набирай очки</small></div><i>→</i></Link>
        <Link href="/teams" className="home-card"><span>♟</span><div><b>6 команд</b><small>Жеребьевка<br/>и распределение</small></div><i>→</i></Link>
        <Link href="/champion" className="home-card"><span>🏆</span><div><b>Победитель ЛЧ</b><small>Кто дойдёт<br/>дальше всех</small></div><i>→</i></Link>
        <Link href="/chat" className="home-card"><span>💬</span><div><b>Общий чат</b><small>Общение участников<br/>и новости</small></div><i>→</i></Link>
      </section>

      <section className="home-footer-promo"><div className="quote">“ Сильные люди делают<br/>сильные команды. ”</div><div className="values"><span>⚒<small>КОМАНДА</small></span><span>⌁<small>РАЗВИТИЕ</small></span><span>▥<small>РЕЗУЛЬТАТ</small></span><span>♟<small>БУДУЩЕЕ</small></span></div><div className="sb-sign"><b>СУХА БАЛКА</b><small>БОЛЬШЕ ЧЕМ РАБОТА</small></div></section>
      <div className="home-bottom"><span>© 2026 Прогноз-Фрунзе. Все права защищены.</span><b>ВМЕСТЕ К НОВЫМ ПОБЕДАМ!</b></div>
    </main>
  );
}
