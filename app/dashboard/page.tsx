export default function DashboardPage() {
  return (
    <main className="page">
      <div className="container">
        <header className="header">
          <div className="logo">ПРОГНОЗ<span>-ФРУНЗЕ</span></div>
          <div className="badge">Личный кабинет</div>
        </header>
        <section className="card">
          <h1>Мои прогнозы</h1>
          <p className="badge" style={{ lineHeight: 1.6 }}>
            Здесь будут туры, матчи, ввод прогнозов, дедлайны, результаты и начисленные очки.
            Доступ к странице и данным будет защищён Supabase Auth + Row Level Security.
          </p>
        </section>
      </div>
    </main>
  );
}
