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
  league: { id: number; season: number };
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

type CacheEntry = { expiresAt: number; data: unknown };
const cache = new Map<string, CacheEntry>();

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zа-яё0-9]/gi, "");
}

const aliases: Record<string, string[]> = {
  "штутгарт": ["vfbstuttgart", "stuttgart"], "штуtgарт": ["vfbstuttgart", "stuttgart"], "штуgart": ["vfbstuttgart", "stuttgart"],
  "викинг": ["viking", "vikingfk"], "псж": ["parissaintgermain", "psg"], "слован": ["slovanbratislava"],
  "мансити": ["manchestercity", "mancity"], "реал": ["realmadrid"], "интер": ["inter", "intermilan", "internazionale"],
  "боруссиядортмунд": ["borussiadortmund", "dortmund"], "вильярреал": ["villarreal"], "барселона": ["barcelona", "fcbarcelona"],
  "фейеноорд": ["feyenoord"], "наполі": ["napoli"], "наполи": ["napoli"], "арсенал": ["arsenal"],
  "бавария": ["bayernmunich", "bayernmunchen", "bayern"], "будеглимт": ["bodoglimt", "bodo"],
  "ливерпуль": ["liverpool"], "атлетико": ["atleticomadrid"], "спортинг": ["sportingcp", "sportinglisbon"],
  "галатасарай": ["galatasaray"], "псв": ["psveindhoven", "psv"], "шахтер": ["shakhtardonetsk"],
  "фенербахче": ["fenerbahce"], "рома": ["asroma", "roma"], "мю": ["manchesterunited", "manutd"],
  "сабах": ["sabah"], "славия": ["slaviaprague", "slaviapraha"], "ланс": ["lens", "rclens"],
  "комо": ["como"], "лейпциг": ["rbleipzig", "leipzig"], "брюгге": ["clubbrugge", "brugge"],
  "астонвилла": ["astonvilla"], "аекафины": ["aekathens", "aek"], "ласк": ["lask"], "порту": ["porto", "fcporto"],
  "лилль": ["lille", "lilleosc"], "бетис": ["realbetis", "betis"],
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
  return fixtures.find(f =>
    f.league?.id === UCL_LEAGUE_ID &&
    teamMatches(home, f.teams.home.name) &&
    teamMatches(away, f.teams.away.name)
  ) ?? fixtures.find(f =>
    f.league?.id === UCL_LEAGUE_ID &&
    teamMatches(home, f.teams.away.name) &&
    teamMatches(away, f.teams.home.name)
  );
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

    const cacheKey = `${normalize(home)}|${normalize(away)}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return NextResponse.json(cached.data);

    const kickoffDate = new Date(kickoff);
    const date = kickoffDate.toISOString().slice(0, 10);
    const now = Date.now();
    const nearKickoff = Math.abs(now - kickoffDate.getTime()) <= 4 * 60 * 60 * 1000;
    let fixture: ApiFixture | undefined;

    // API-Football принимает live как "all" или список ID в формате id-id.
    // Надёжнее запрашивать все текущие live-матчи одним запросом и затем оставить только ЛЧ.
    if (nearKickoff) {
      const live = await apiGet("/fixtures", { live: "all" });
      fixture = findFixture((live.response ?? []) as ApiFixture[], home, away);
    }

    // Для будущих/завершённых матчей — один запрос расписания конкретной даты.
    if (!fixture) {
      const schedule = await apiGet("/fixtures", {
        league: String(UCL_LEAGUE_ID),
        season: String(UCL_SEASON),
        date,
        timezone: "Europe/Kyiv",
      });
      fixture = findFixture((schedule.response ?? []) as ApiFixture[], home, away);
    }

    if (!fixture) return NextResponse.json({ error: "Матч не найден в API-Football", home, away, date }, { status: 404 });

    const status = fixture.fixture.status.short;
    const events = (fixture.events ?? []).map(event => ({
      minute: event.time.elapsed,
      extra: event.time.extra ?? null,
      team: event.team?.name ?? "",
      player: event.player?.name ?? null,
      assist: event.assist?.name ?? null,
      type: event.type,
      detail: event.detail,
    }));

    const data = {
      fixtureId: fixture.fixture.id,
      home: fixture.teams.home.name,
      away: fixture.teams.away.name,
      homeScore: fixture.goals.home,
      awayScore: fixture.goals.away,
      status: fixture.fixture.status,
      isLive: LIVE_STATUSES.has(status),
      events,
      updatedAt: new Date().toISOString(),
    };

    cache.set(cacheKey, { data, expiresAt: Date.now() + (LIVE_STATUSES.has(status) ? 90_000 : 60 * 60_000) });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка API-Football";
    const rateLimited = message.includes("rateLimit") || message.includes("Too many requests");
    return NextResponse.json({ error: rateLimited ? "API-Football временно ограничил запросы. Квота или лимит запросов исчерпаны — повторим после сброса лимита." : message }, { status: rateLimited ? 429 : 500 });
  }
}
