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

// VM 2026 Round of 32 – korrekt bracket baserad på FIFA-lottningen december 2024
// Vänster halva (matcher 73-80), höger halva (matcher 81-88)
// Källor: Wikipedia / FIFA / Sky Sports
// "3rd" = bästa treor (position avgörs av vilka grupper som kvalificerar en 3:a)
// VM 2026 Round of 32 – korrekt bracket baserad på FIFA-lottningen december 2024
// Källor: Wikipedia / FIFA / Sky Sports
const VM2026_BRACKET: [string, string, string?, string?][] = [
  // Vänster halva (top → botten)
  ["A2", "B2"],
  ["F1", "C2"],
  ["E1", "3rd-ABCDF"],   // M74 – E1 vs bästa 3:a från grupp A/B/C/D/F
  ["I1", "3rd-CDFGH"],   // M77 – I1 vs bästa 3:a från grupp C/D/F/G/H
  ["C1", "F2"],
  ["E2", "I2"],
  ["A1", "3rd-CEFHI"],   // M79 – A1 (Mexiko) vs bästa 3:a från grupp C/E/F/H/I
  ["L1", "3rd-EHIJK"],   // M80 – L1 vs bästa 3:a från grupp E/H/I/J/K
  // Höger halva (top → botten)
  ["D1", "3rd-BEFIJ"],   // M81 – D1 (USA) vs bästa 3:a från grupp B/E/F/I/J
  ["G1", "3rd-AEHIJ"],   // M82 – G1 vs bästa 3:a från grupp A/E/H/I/J
  ["K2", "L2"],
  ["H1", "J2"],
  ["B1", "3rd-EFGIJ"],   // M85 – B1 (Kanada) vs bästa 3:a från grupp E/F/G/I/J
  ["K1", "3rd-DEIJL"],   // M87 – K1 vs bästa 3:a från grupp D/E/I/J/L
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
  const [standingsData, topScorers, topAssists, topYellow, topRed] = await Promise.allSettled([
    tournament.externalId ? fetchStandings(tournament.externalId, tournament.year) : Promise.resolve([]),
    tournament.externalId ? fetchTopScorers(tournament.externalId, tournament.year) : Promise.resolve([]),
    tournament.externalId ? fetchTopAssists(tournament.externalId, tournament.year) : Promise.resolve([]),
    tournament.externalId ? fetchTopYellowCards(tournament.externalId, tournament.year) : Promise.resolve([]),
    tournament.externalId ? fetchTopRedCards(tournament.externalId, tournament.year) : Promise.resolve([]),
  ]);

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

  // Build bracket from current standings
  const positionMap = new Map<string, { id: number; name: string; logo: string }>();
  const MATCHES_PER_TEAM = 3;

  // Ett lag visas i bracket-positionen bara om gruppen är helt klar, eller om
  // inget lag under dem i tabellen matematiskt kan ta igen deras poäng (klinchat)
  function isPositionClinched(entries: ApiFootballStandingEntry[], idx: number): boolean {
    const team = entries[idx];
    if (!team) return false;
    const allFinished = entries.every((e) => e.all.played >= MATCHES_PER_TEAM);
    if (allFinished) return true;
    // entries är redan sorterad efter nuvarande placering (poäng/målskillnad/inbördes möten).
    // Om ett hotande lag i bästa fall bara kan nå SAMMA poäng (inte fler) och vårt lag redan
    // ligger före dem just nu, har de redan förlorat den tiebreakern (t.ex. inbördes möte)
    // – då räknar vi platsen som klinchad.
    return entries.slice(idx + 1).every((e) => {
      const maxPoints = e.points + (MATCHES_PER_TEAM - e.all.played) * 3;
      return maxPoints <= team.points;
    });
  }

  for (const group of groups) {
    if (group.isThird) continue;
    const letter = group.name.replace(/^Group\s+/i, "").replace(/^Group Stage\s*-\s*Group\s+/i, "");
    group.entries.forEach((entry, idx) => {
      if (entry.rank > 2) return;
      if (isPositionClinched(group.entries, idx)) {
        positionMap.set(`${letter}${entry.rank}`, entry.team);
      }
    });
  }

  // OBS: vilket 3:e-placerat lag som hamnar i vilken slot avgörs av FIFA:s officiella
  // kombinationstabell (beroende på vilka 8 av 12 grupper som kvalificerar en trea).
  // Vi har inte den tabellen och gissar inte – visar bara platsen tills riktiga
  // slutspelsfixturer dyker upp i API:t.
  function resolveSlot(key: string): { label: string; team: { name: string; logo: string } | null } {
    if (!key.startsWith("3rd-")) {
      return { label: key, team: positionMap.get(key) ?? null };
    }
    const letters = key.replace("3rd-", "");
    const label = `Bästa 3:a (${letters.split("").join("/")})`;
    return { label, team: null };
  }

  const bracket = VM2026_BRACKET.map(([h, a]) => ({
    home: resolveSlot(h),
    away: resolveSlot(a),
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
