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
  fetchFixtures,
  type ApiFootballStandingEntry,
} from "@/lib/football-api/api-football";
import { TournamentInfo } from "@/components/TournamentInfo";

interface Props {
  params: Promise<{ id: string }>;
}

// VM 2026 Round of 32 – bracket-struktur baserad på FIFA-lottningen december 2024
// Källor: Wikipedia / Sky Sports. "3rd-XXXXX" matchas mot riktig fixture via lag-ID,
// vi gissar aldrig vilket lag det blir - det avgörs av den riktiga matchen från API:t.
const VM2026_BRACKET: [string, string][] = [
  // Vänster halva (top → botten)
  ["A2", "B2"],
  ["F1", "C2"],
  ["E1", "3rd-ABCDF"],
  ["I1", "3rd-CDFGH"],
  ["C1", "F2"],
  ["E2", "I2"],
  ["A1", "3rd-CEFHI"],
  ["L1", "3rd-EHIJK"],
  // Höger halva (top → botten)
  ["D1", "3rd-BEFIJ"],
  ["G1", "3rd-AEHIJ"],
  ["K2", "L2"],
  ["H1", "J2"],
  ["B1", "3rd-EFGIJ"],
  ["K1", "3rd-DEIJL"],
  ["J1", "H2"],
  ["D2", "G2"],
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
  const [standingsData, topScorers, topAssists, topYellow, topRed, fixturesData] = await Promise.allSettled([
    tournament.externalId ? fetchStandings(tournament.externalId, tournament.year) : Promise.resolve([]),
    tournament.externalId ? fetchTopScorers(tournament.externalId, tournament.year) : Promise.resolve([]),
    tournament.externalId ? fetchTopAssists(tournament.externalId, tournament.year) : Promise.resolve([]),
    tournament.externalId ? fetchTopYellowCards(tournament.externalId, tournament.year) : Promise.resolve([]),
    tournament.externalId ? fetchTopRedCards(tournament.externalId, tournament.year) : Promise.resolve([]),
    tournament.externalId ? fetchFixtures(tournament.externalId, tournament.year) : Promise.resolve([]),
  ]);

  const allFixtures = fixturesData.status === "fulfilled" ? fixturesData.value : [];
  const r32Fixtures = allFixtures.filter((f) => f.league.round === "Round of 32");

  const standings = standingsData.status === "fulfilled" ? standingsData.value : [];
  const rawStandings = standings[0]?.league?.standings ?? [];

  // API:ts separata "Group Stage"-lista för bästa treor innehåller ibland gammal/felaktig
  // data (t.ex. fel antal spelade matcher). Vi ignorerar den och bygger treorna själva
  // utifrån de riktiga gruppställningarna (rank === 3) längre ner istället.
  const realGroups = rawStandings
    .filter((g) => g.length > 0)
    .map((g) => ({ name: g[0]?.group ?? "", entries: dedup(g) }))
    .filter((g) => !isThirdPlacedGroup(g.name, g.entries.length));

  const thirdPlacedEntries = realGroups
    .map((g) => g.entries.find((e) => e.rank === 3))
    .filter((e): e is NonNullable<typeof e> => !!e);

  const groups = [
    ...realGroups.map((g) => ({
      name: g.name,
      swedishName: toSwedishGroup(g.name, g.entries.length),
      isThird: false,
      entries: g.entries,
    })),
    {
      name: "Bästa grupptreor",
      swedishName: "Bästa grupptreor",
      isThird: true,
      entries: [...thirdPlacedEntries]
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.goalsDiff !== a.goalsDiff) return b.goalsDiff - a.goalsDiff;
          return b.all.goals.for - a.all.goals.for;
        })
        .map((e, idx) => ({ ...e, rank: idx + 1 })),
    },
  ].sort((a, b) => {
    // Bästa grupptreor alltid sist
    if (a.isThird && !b.isThird) return 1;
    if (!a.isThird && b.isThird) return -1;
    return a.name.localeCompare(b.name);
  });

  // teamId → grupposition (t.ex. "A1", "B2") från de riktiga gruppställningarna
  const positionToTeamId = new Map<string, number>();
  for (const group of groups) {
    if (group.isThird) continue;
    const letter = group.name.replace(/^Group\s+/i, "").replace(/^Group Stage\s*-\s*Group\s+/i, "");
    for (const entry of group.entries) {
      if (entry.rank <= 2) positionToTeamId.set(`${letter}${entry.rank}`, entry.team.id);
    }
  }

  // Matcha varje bracket-slot mot en riktig R32-fixture via lag-ID. Vi gissar aldrig
  // vilket lag som blir "bästa 3:a" – det laget kommer direkt från den riktiga matchen.
  function findFixtureFor(posA: string, posB: string) {
    const teamIdA = positionToTeamId.get(posA);
    const teamIdB = positionToTeamId.get(posB);
    return r32Fixtures.find((f) => {
      const homeId = f.teams.home.id;
      const awayId = f.teams.away.id;
      const matchesA = teamIdA !== undefined && (homeId === teamIdA || awayId === teamIdA);
      const matchesB = teamIdB !== undefined && (homeId === teamIdB || awayId === teamIdB);
      return matchesA || matchesB;
    });
  }

  const bracket = VM2026_BRACKET.map(([posA, posB]) => {
    const fixture = findFixtureFor(posA, posB);
    if (!fixture) {
      return {
        home: { label: posA, team: null },
        away: { label: posB, team: null },
      };
    }
    return {
      home: { label: posA, team: fixture.teams.home },
      away: { label: posB, team: fixture.teams.away },
    };
  });

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
