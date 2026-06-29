export interface ApiFootballFixture {
  fixture: {
    id: number;
    date: string;
    status: {
      short: string; // NS, 1H, HT, 2H, FT, AET, PEN, PST, CANC, etc.
    };
    venue: {
      name: string | null;
      city: string | null;
    };
  };
  league: {
    id: number;
    round: string;
    season: number;
  };
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null };
    away: { id: number; name: string; logo: string; winner: boolean | null };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
}

// Resultatet efter 90 minuter (ordinarie tid) – det är detta som ska räknas för tipspoäng,
// inte resultat efter förlängning/straffar
export function regulationScore(fixture: ApiFootballFixture): { home: number | null; away: number | null } {
  return fixture.score.fulltime.home !== null
    ? fixture.score.fulltime
    : fixture.goals;
}

export interface ApiFootballTeam {
  team: {
    id: number;
    name: string;
    code: string;
    country: string;
    logo: string;
  };
}

export type MatchStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled";

export function mapFixtureStatus(short: string): MatchStatus {
  if (["FT", "AET", "PEN"].includes(short)) return "finished";
  if (["1H", "HT", "2H", "ET", "BT", "P", "INT"].includes(short)) return "live";
  if (["PST"].includes(short)) return "postponed";
  if (["CANC", "ABD", "AWD", "WO"].includes(short)) return "cancelled";
  return "scheduled";
}

export function roundToPhaseType(round: string): "group" | "knockout" {
  const lower = round.toLowerCase();
  if (
    lower.includes("group") ||
    lower.includes("regular season") ||
    lower.includes("group stage")
  ) {
    return "group";
  }
  return "knockout";
}
