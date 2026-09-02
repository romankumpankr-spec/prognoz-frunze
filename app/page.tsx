import Link from "next/link";

const rules = [
  ["3", "Точный счёт", "Например, прогноз 2:1 и итог 2:1."],
  ["2", "Разница мячей", "Счёт не угадан, но разница мячей совпала."],
  ["1", "Исход матча", "Победа, ничья или поражение угаданы правильно."],
];

export default function Home() {
  return (
    <main className="page">
      <div className="container">
        <header className="header">
          <div className="logo">ПРОГНОЗ<span>-ФРУНЗЕ</span></div>
          <div className="badge">UEFA Champions League</div>
        </header>

        <section className="hero">
          <h1>Своя лига.<br />Свои прогнозы.</h1>
          <p>
            Закрытая лига прогнозов для шести участников. Каждый видит свой кабинет,
            вносит прогнозы до дедлайна, а после матчей система сама считает очки и
            обновляет турнирную таблицу.
          </p>
          <Link className="cta" href="/login">Войти в кабинет →</Link>
        </section>

        <section className="grid" aria-label="Правила начисления очков">
          {rules.map(([points, title, text]) => (
            <article className="card" key={points}>
              <div style={{ fontSize: 42, fontWeight: 800, marginBottom: 8 }}>{points}</div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
