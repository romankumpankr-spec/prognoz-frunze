"use client";

import { useCallback, useEffect, useState } from "react";

type LiveEvent = {
  minute: number | null;
  extra: number | null;
  team: string;
  player: string | null;
  assist: string | null;
  type: string;
  detail: string;
};

type LiveData = {
  fixtureId: number;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: { short: string; long: string; elapsed: number | null; extra?: number | null };
  isLive: boolean;
  events: LiveEvent[];
  updatedAt: string;
};

function eventIcon(event: LiveEvent) {
  if (event.type === "Goal") return "⚽";
  if (event.type === "Card" && event.detail.toLowerCase().includes("red")) return "🟥";
  if (event.type === "Card") return "🟨";
  if (event.type === "subst") return "🔄";
  return "•";
}

function eventText(event: LiveEvent) {
  if (event.type === "Goal") {
    const suffix = event.detail === "Own Goal" ? " (автогол)" : event.detail === "Penalty" ? " (пен.)" : "";
    return `${event.player ?? "Гол"}${suffix}${event.assist ? ` · пас: ${event.assist}` : ""}`;
  }
  if (event.type === "Card") return `${event.player ?? "Карточка"} · ${event.detail}`;
  if (event.type === "subst") return event.player ? `${event.player} заменён` : "Замена";
  return `${event.player ?? event.type}${event.detail ? ` · ${event.detail}` : ""}`;
}

function minute(event: LiveEvent) {
  if (event.minute == null) return "";
  return `${event.minute}${event.extra ? `+${event.extra}` : ""}′`;
}

export function LiveMatch({ home, away, kickoff }: { home: string; away: string; kickoff: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ home, away, kickoff });
      const response = await fetch(`/api/live-match?${params.toString()}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Не удалось получить данные матча");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки live-данных");
    } finally {
      setLoading(false);
    }
  }, [home, away, kickoff]);

  useEffect(() => {
    if (!open || !data?.isLive) return;
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, [open, data?.isLive, load]);

  return (
    <div style={{ marginTop: 10, borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 10 }}>
      <button
        type="button"
        className="preview-toggle"
        onClick={() => { const next = !open; setOpen(next); if (next && !data) void load(); }}
      >
        ⚡ Онлайн события <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "10px 2px 2px" }}>
          {loading && !data && <div className="badge">Загружаем данные матча…</div>}
          {error && <div className="badge" style={{ color: "#ffb4b4" }}>{error}</div>}
          {data && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <strong>{data.status.short === "FT" || data.status.short === "AET" ? "Завершён" : data.status.long}</strong>
                <strong style={{ fontSize: 20 }}>{data.homeScore ?? "—"}:{data.awayScore ?? "—"}</strong>
              </div>
              {data.isLive && <div className="badge" style={{ marginBottom: 8 }}>🔴 LIVE · обновление каждые 30 секунд</div>}
              {!data.events.length ? <div className="badge">Событий пока нет.</div> : (
                <div style={{ display: "grid", gap: 6 }}>
                  {data.events.map((event, index) => (
                    <div key={`${data.fixtureId}-${index}`} style={{ display: "grid", gridTemplateColumns: "42px 24px 1fr", gap: 7, alignItems: "start" }}>
                      <span className="badge">{minute(event)}</span>
                      <span>{eventIcon(event)}</span>
                      <span><b>{event.team}</b> · {eventText(event)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="badge" style={{ marginTop: 8 }}>Источник: API-Football · обновлено {new Date(data.updatedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
