import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { db } from "@/db";
import { tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  fetchStandings,
  fetchTopScorers,
  fetchTopAssists,
  fetchTopYellowCards,
  fetchTopRedCards,
  type ApiFootballStandingEntry,
} from "@/lib/football-api/api-football";
import { TournamentInfo } from "@/components/TournamentInfo";

interface Props {
  params: Promise<{ id: string }>;
}

// VM 2026 Round of 32 bracket (based on FIFA draw format)
// Format: [homeGroupPos, awayGroupPos] e.g. ["A1", "B2"]
const VM2026_BRACKET: [string, string][] = [
  ["A1", "B2"], ["C1", "D2"], ["E1", "F2"], ["G1", "H2"],
  ["I1", "J2"], ["K1", "L2"], ["A2", "B1"], ["C2", "D1"],
  ["E2", "F1"], ["G2", "H1"], ["I2", "J1"], ["K2", "L1"],
  ["3rd-1", "3rd-2"], ["3rd-3", "3rd-4"],
  ["3rd-5", "3rd-6"], ["3rd-7", "3rd-8"],
];

function toSwedishGroup(name: string, size?: number): string {
  if (!name) return name;
  const lower = name.toLowerCase();
  if (lower.includes("third") || lower.includes("3rd")) return "Bästa grupptreor";
  if (size && size > 12) return "Bästa grupptreor";
  if (/^group stage$/i.test(name.trim())) return "Bästa grupptreor";
  const stageMatch = name.match(/Group Stage\s*-\s*Group\s+(\w+)/i);
  if (stageMatch) return `Grupp ${stageMatch[1]}`;
  return name.replace(/^Group\s+/i, "Grupp ");
}

function isThirdPlacedGroup(name: string, size: number): boolean {
  if (size > 12) return true;
  return name.toLowerCase().includes("third") || name.toLowerCase().includes("3rd") || /^group stage$/i.test(name.trim());
}

function dedup(entries: ApiFootballStandingEntry[]): ApiFootballStandingEntry[] {
  const seen = new Set<number>();
  return entries.filter((e) => {
    if (seen.has(e.team.id)) return false;
    seen.add(e.team.id);
    return true;
  });
}

export default async function StandingsPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id: tournamentId } = await params;

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!tournament) redirect("/");

  // Fetch all data in parallel
  const [standingsData, topScorers, topAssists, topYellow, topRed] = await Promise.allSettled([
    tournament.externalId ? fetchStandings(tournament.externalId, tournament.year) : Promise.resolve([]),
    tournament.externalId ? fetchTopScorers(tournament.externalId, tournament.year) : Promise.resolve([]),
    tournament.externalId ? fetchTopAssists(tournament.externalId, tournament.year) : Promise.resolve([]),
    tournament.externalId ? fetchTopYellowCards(tournament.externalId, tournament.year) : Promise.resolve([]),
    tournament.externalId ? fetchTopRedCards(tournament.externalId, tournament.year) : Promise.resolve([]),
  ]);

  const standings = standingsData.status === "fulfilled" ? standingsData.value : [];
  const rawStandings = standings[0]?.league?.standings ?? [];

  const groups = rawStandings
    .filter((g) => g.length > 0)
    .map((g) => {
      const unique = dedup(g);
      const name = g[0]?.group ?? "";
      const swedishName = toSwedishGroup(name, unique.length);
      return {
        name,
        swedishName,
        isThird: isThirdPlacedGroup(name, unique.length),
        entries: unique,
      };
    });

  // Build bracket from current standings
  // Create a map: "A1" → team, "A2" → team, etc.
  const positionMap = new Map<string, { name: string; logo: string }>();
  const thirdPlaced: { team: { name: string; logo: string }; points: number; goalsDiff: number; goals: number }[] = [];

  for (const group of groups) {
    if (group.isThird) {
      for (const entry of group.entries) {
        thirdPlaced.push({
          team: entry.team,
          points: entry.points,
          goalsDiff: entry.goalsDiff,
          goals: entry.all.goals.for,
        });
      }
      continue;
    }
    const letter = group.name.replace(/^Group\s+/i, "").replace(/^Group Stage\s*-\s*Group\s+/i, "");
    for (const entry of group.entries) {
      positionMap.set(`${letter}${entry.rank}`, entry.team);
    }
  }

  // Sort third-placed teams
  thirdPlaced.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalsDiff !== a.goalsDiff) return b.goalsDiff - a.goalsDiff;
    return b.goals - a.goals;
  });

  thirdPlaced.forEach((t, i) => {
    positionMap.set(`3rd-${i + 1}`, t.team);
  });

  const bracket = VM2026_BRACKET.map(([h, a]) => ({
    home: { label: h, team: positionMap.get(h) ?? null },
    away: { label: a, team: positionMap.get(a) ?? null },
  }));

  return (
    <>
      <Navbar user={session} />
      <main className="max-w-4xl mx-auto px-4 py-8 w-full flex-1">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm">
            ← Hem
          </Link>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <h1 className="text-xl font-bold">VM</h1>
        </div>

        <TournamentInfo
          groups={groups}
          topScorers={topScorers.status === "fulfilled" ? topScorers.value : []}
          topAssists={topAssists.status === "fulfilled" ? topAssists.value : []}
          topYellow={topYellow.status === "fulfilled" ? topYellow.value : []}
          topRed={topRed.status === "fulfilled" ? topRed.value : []}
          bracket={bracket}
        />
      </main>
    </>
  );
}
