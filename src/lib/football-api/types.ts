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
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
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
