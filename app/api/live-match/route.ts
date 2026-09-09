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
  "брюгге": ["clubbrugge", "brugge"],
  "астонвилла": ["astonvilla"],
  "аекафины": ["aekathens", "aek"],
  "ласк": ["lask", "lasklinz"],
  "реал": ["realmadrid"],
  "интер": ["inter", "intermilan"],
  "боруссиядортмунд": ["borussiadortmund", "dortmund"],
  "вильярреал": ["villarreal"],
  "порту": ["porto", "fcporto"],
  "мансити": ["mancity", "manchestercity"],
  "лиль": ["lille", "losc"] ,
  "бетис": ["realbetis", "betis"],
  "барселона": ["barcelona"],
  "фейеноорд": ["feyenoord"],
  "штутгарт": ["vfbstuttgart", "stuttgart"],
  "викинг": ["viking", "vikingfk"],
  "псж": ["parissaintgermain", "psg"],
  "слован": ["slovanbratislava", "slovan"],
  "ливepуль": ["liverpool"],
  "ливерпуль": ["liverpool"],
  "атлетико": ["atleticomadrid", "atletico"],
  "спортинг": ["sportingcp", "sportinglisbon"],
  "галатасарай": ["galatasaray"],
  "наполи": ["napoli"],
  "арсенал": ["arsenal"],
  "псв": ["psveindhoven", "psv"],
  "шахтер": ["shakhtardonetsk", "shakhtar"],
  "шахтёр": ["shakhtardonetsk", "shakhtar"],
  "фенербахче": ["fenerbahce"],
  "рома": ["asroma", "roma"],
  "бавария": ["bayernmunich", "bayern"],
  "будеглимт": ["bodo", "bodo glimt"],
  "мю": ["manchesterunited", "manutd"],
  "сабах": ["sabah", "sabahfk"],
  "славия": ["slaviaprague", "slavia"],
  "ланс": ["lens"],
  "комо": ["como"],
  "лейпциг": ["rbleipzig", "leipzig"],
};

function teamMatches(localName: string, apiName: string) {
  const local = normalize(localName);
  const api = normalize(apiName);
  if (local === api || local.includes(api) || api.includes(local)) return true;
  return (aliases[local] ?? []).some(alias => {
    const normalizedAlias = normalize(alias);
    return api === normalizedAlias || api.includes(normalizedAlias) || normalizedAlias.includes(api);
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
  const response = await fetch(url, {
    headers: { "x-apisports-key": key, Accept: "application/json" },
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok || body.errors?.length) throw new Error(body.errors?.join(", ") || `API HTTP ${response.status}`);
  return body;
}

export async function GET(request: NextRequest) {
  try {
    const home = request.nextUrl.searchParams.get("home")?.trim();
    const away = request.nextUrl.searchParams.get("away")?.trim();
    const kickoff = request.nextUrl.searchParams.get("kickoff")?.trim();
    if (!home || !away || !kickoff) return NextResponse.json({ error: "Не хватает home, away или kickoff" }, { status: 400 });

    const date = new Date(kickoff).toISOString().slice(0, 10);
    const schedule = await apiGet("/fixtures", { league: String(UCL_LEAGUE_ID), season: String(UCL_SEASON), date });
    let fixture = findFixture(schedule.response ?? [], home, away) as ApiFixture | undefined;

    if (!fixture) {
      const nextDate = new Date(new Date(`${date}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
      const previousDate = new Date(new Date(`${date}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
      const [previous, next] = await Promise.all([
        apiGet("/fixtures", { league: String(UCL_LEAGUE_ID), season: String(UCL_SEASON), date: previousDate }),
        apiGet("/fixtures", { league: String(UCL_LEAGUE_ID), season: String(UCL_SEASON), date: nextDate }),
      ]);
      fixture = findFixture([...(previous.response ?? []), ...(next.response ?? [])], home, away) as ApiFixture | undefined;
    }

    if (!fixture) return NextResponse.json({ error: "Матч не найден в API-Football", home, away }, { status: 404 });

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
