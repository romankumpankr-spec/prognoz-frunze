import { NextRequest, NextResponse } from "next/server";

const API_URL = "https://v3.football.api-sports.io";
const UCL_LEAGUE_ID = 2;
const UCL_SEASON = 2026;
const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "P", "BT", "LIVE"]);

type ApiFixture = {
  fixture: {
    id: number;
    date: string;
    status: { short: string; long: string; elapsed: number | null; extra?: number | null };
  };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
  events?: Array<{
    time: { elapsed: number | null; extra?: number | null };
    team: { name: string };
    player: { name: string | null };
    assist?: { name: string | null };
    type: string;
    detail: string;
  }>;
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zа-яё0-9]/gi, "");
}

const aliases: Record<string, string[]> = {
  "штутгарт": ["vfbstuttgart", "stuttgart"],
  "штуtgарт": ["vfbstuttgart", "stuttgart"],
  "штуgart": ["vfbstuttgart", "stuttgart"],
  "викинг": ["viking", "vikingfk"],
  "псж": ["parissaintgermain", "psg"],
  "слован": ["slovanbratislava"],
  "мансити": ["manchestercity", "mancity"],
  "реал": ["realmadrid"],
  "интер": ["inter", "intermilan", "internazionale"],
  "боруссиядортмунд": ["borussiadortmund", "dortmund"],
  "вильярреал": ["villarreal"],
  "барселона": ["barcelona", "fcbarcelona"],
  "фейеноорд": ["feyenoord"],
  "наполі": ["napoli"],
  "наполи": ["napoli"],
  "арсенал": ["arsenal"],
  "бавария": ["bayernmunich", "bayernmunchen", "bayern"],
  "будеглимт": ["bodo/glimt", "bodoglimt"],
  "ливерпуль": ["liverpool"],
  "атлетико": ["atleticomadrid", "atleticomadrid"],
  "спортинг": ["sportingcp", "sportinglisbon"],
  "галатасарай": ["galatasaray"],
  "псв": ["psveindhoven", "psv"],
  "шахтер": ["shakhtardonetsk", "shakhtardonetsk"],
  "фенербахче": ["fenerbahce"],
  "рома": ["asroma", "roma"],
  "мю": ["manchesterunited", "manutd"],
  "сабах": ["sabah"],
  "славия": ["slaviaprague", "slaviapraha"],
  "ланс": ["lens", "rclens"],
  "комо": ["como"],
  "лейпциг": ["rbleipzig", "leipzig"],
  "брюгге": ["clubbrugge", "brugge"],
  "астонвилла": ["astonvilla"],
  "аекафины": ["aekathens", "aek"],
  "ласк": ["lask"],
  "порту": ["porto", "fcporto"],
  "лилль": ["lille", "lilleosc"],
  "бетис": ["realbetis", "betis"],
};

function teamMatches(localName: string, apiName: string) {
  const local = normalize(localName);
  const api = normalize(apiName);
  if (local === api || local.includes(api) || api.includes(local)) return true;
  return (aliases[local] ?? []).some(alias => {
    const a = normalize(alias);
    return api === a || api.includes(a) || a.includes(api);
  });
}

function findFixture(fixtures: ApiFixture[], home: string, away: string) {
  return fixtures.find(f => teamMatches(home, f.teams.home.name) && teamMatches(away, f.teams.away.name))
    ?? fixtures.find(f => teamMatches(home, f.teams.away.name) && teamMatches(away, f.teams.home.name));
}

async function apiGet(path: string, params: Record<string, string>) {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) throw new Error("FOOTBALL_API_KEY не задан в Render");
  const url = new URL(`${API_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url, { headers: { "x-apisports-key": key, Accept: "application/json" }, cache: "no-store" });
  const body = await response.json();
  if (!response.ok || (body.errors && Object.keys(body.errors).length)) {
    const errors = typeof body.errors === "string" ? body.errors : JSON.stringify(body.errors);
    throw new Error(errors || `API HTTP ${response.status}`);
  }
  return body;
}

export async function GET(request: NextRequest) {
  try {
    const home = request.nextUrl.searchParams.get("home")?.trim();
    const away = request.nextUrl.searchParams.get("away")?.trim();
    const kickoff = request.nextUrl.searchParams.get("kickoff")?.trim();
    if (!home || !away || !kickoff) return NextResponse.json({ error: "Не хватает home, away или kickoff" }, { status: 400 });

    const kickoffDate = new Date(kickoff);
    const date = kickoffDate.toISOString().slice(0, 10);
    const now = Date.now();
    const nearKickoff = Math.abs(now - kickoffDate.getTime()) <= 4 * 60 * 60 * 1000;
    let fixture: ApiFixture | undefined;

    // Во время матча сначала используем live=2: API-Football рекомендует этот режим
    // для livescore и событий текущих матчей.
    if (nearKickoff) {
      const live = await apiGet("/fixtures", { live: String(UCL_LEAGUE_ID) });
      fixture = findFixture((live.response ?? []) as ApiFixture[], home, away);
    }

    // Для будущих и уже завершённых матчей берём расписание конкретной даты.
    if (!fixture) {
      const schedule = await apiGet("/fixtures", {
        league: String(UCL_LEAGUE_ID),
        season: String(UCL_SEASON),
        date,
        timezone: "Europe/Kyiv",
      });
      fixture = findFixture((schedule.response ?? []) as ApiFixture[], home, away);
    }

    // Если API не вернул матч по дате, один раз ищем по всему сезону.
    // Это защищает нас от различий в часовом поясе/дате публикации расписания.
    if (!fixture) {
      const seasonFixtures = await apiGet("/fixtures", { league: String(UCL_LEAGUE_ID), season: String(UCL_SEASON) });
      fixture = findFixture((seasonFixtures.response ?? []) as ApiFixture[], home, away);
    }

    if (!fixture) return NextResponse.json({ error: "Матч не найден в API-Football", home, away, date }, { status: 404 });

    const details = await apiGet("/fixtures", { ids: String(fixture.fixture.id) });
    const full = (details.response?.[0] ?? fixture) as ApiFixture;
    const status = full.fixture.status.short;
    const events = (full.events ?? []).map(event => ({
      minute: event.time.elapsed,
      extra: event.time.extra ?? null,
      team: event.team?.name ?? "",
      player: event.player?.name ?? null,
      assist: event.assist?.name ?? null,
      type: event.type,
      detail: event.detail,
    }));

    return NextResponse.json({
      fixtureId: full.fixture.id,
      home: full.teams.home.name,
      away: full.teams.away.name,
      homeScore: full.goals.home,
      awayScore: full.goals.away,
      status: full.fixture.status,
      isLive: LIVE_STATUSES.has(status),
      events,
      updatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка API-Football";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
