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
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
}
