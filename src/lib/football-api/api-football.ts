import type { ApiFootballFixture, ApiFootballTeam } from "./types";

const BASE_URL = "https://v3.football.api-sports.io";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "x-apisports-key": process.env.FOOTBALL_API_KEY!,
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`API-Football error: ${res.status} ${path}`);
  }

  const json = await res.json();
  return json.response as T;
}

export async function fetchFixtures(leagueId: string, season: number): Promise<ApiFootballFixture[]> {
  return apiFetch<ApiFootballFixture[]>(
    `/fixtures?league=${leagueId}&season=${season}`
  );
}

export async function fetchFixture(fixtureId: string): Promise<ApiFootballFixture | null> {
  const results = await apiFetch<ApiFootballFixture[]>(`/fixtures?id=${fixtureId}`);
  return results[0] ?? null;
}

export async function fetchLiveFixtures(leagueId: string): Promise<ApiFootballFixture[]> {
  return apiFetch<ApiFootballFixture[]>(`/fixtures?league=${leagueId}&live=all`);
}

export async function fetchTeams(leagueId: string, season: number): Promise<ApiFootballTeam[]> {
  return apiFetch<ApiFootballTeam[]>(`/teams?league=${leagueId}&season=${season}`);
}

export async function fetchStandings(leagueId: string, season: number): Promise<ApiFootballStandingsResponse[]> {
  return apiFetch<ApiFootballStandingsResponse[]>(`/standings?league=${leagueId}&season=${season}`);
}

export interface ApiFootballStandingsResponse {
  league: {
    id: number;
    name: string;
    standings: ApiFootballStandingEntry[][];
  };
}

export interface ApiFootballStandingEntry {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  group: string;
  description?: string;
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
}

export interface ApiFootballTopScorer {
  player: { id: number; name: string; photo: string; nationality: string };
  statistics: [{
    team: { id: number; name: string; logo: string };
    goals: { total: number | null; assists: number | null };
    cards: { yellow: number; red: number };
  }];
}

export async function fetchTopScorers(leagueId: string, season: number): Promise<ApiFootballTopScorer[]> {
  return apiFetch<ApiFootballTopScorer[]>(`/players/topscorers?league=${leagueId}&season=${season}`);
}

export async function fetchTopAssists(leagueId: string, season: number): Promise<ApiFootballTopScorer[]> {
  return apiFetch<ApiFootballTopScorer[]>(`/players/topassists?league=${leagueId}&season=${season}`);
}

export async function fetchTopYellowCards(leagueId: string, season: number): Promise<ApiFootballTopScorer[]> {
  return apiFetch<ApiFootballTopScorer[]>(`/players/topyellowcards?league=${leagueId}&season=${season}`);
}

export async function fetchTopRedCards(leagueId: string, season: number): Promise<ApiFootballTopScorer[]> {
  return apiFetch<ApiFootballTopScorer[]>(`/players/topredcards?league=${leagueId}&season=${season}`);
}

export interface ApiFootballEvent {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string };
  player: { id: number | null; name: string | null };
  assist: { id: number | null; name: string | null };
  type: string;
  detail: string;
}

export async function fetchMatchEvents(fixtureId: string): Promise<ApiFootballEvent[]> {
  return apiFetch<ApiFootballEvent[]>(`/fixtures/events?fixture=${fixtureId}`);
}
