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
    })
    .sort((a, b) => {
      // Bästa grupptreor alltid sist
      if (a.isThird && !b.isThird) return 1;
      if (!a.isThird && b.isThird) return -1;
      return a.name.localeCompare(b.name);
    });

  // Build bracket from current standings
  const positionMap = new Map<string, { id: number; name: string; logo: string }>();
  // teamId → group letter (t.ex. "A", "B") för att hitta treornas ursprungsgrupp
  const teamGroupMap = new Map<number, string>();

  for (const group of groups) {
    if (group.isThird) continue;
    const letter = group.name.replace(/^Group\s+/i, "").replace(/^Group Stage\s*-\s*Group\s+/i, "");
    for (const entry of group.entries) {
      positionMap.set(`${letter}${entry.rank}`, entry.team);
      teamGroupMap.set(entry.team.id, letter);
    }
  }

  // Bygg lista med treor inkl. deras ursprungsgrupp
  const thirdPlaced: { team: { id: number; name: string; logo: string }; points: number; goalsDiff: number; goals: number; groupLetter: string }[] = [];
  for (const group of groups) {
    if (!group.isThird) continue;
    for (const entry of group.entries) {
      const groupLetter = teamGroupMap.get(entry.team.id) ?? "";
      thirdPlaced.push({
        team: entry.team,
        points: entry.points,
        goalsDiff: entry.goalsDiff,
        goals: entry.all.goals.for,
        groupLetter,
      });
    }
  }

  thirdPlaced.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalsDiff !== a.goalsDiff) return b.goalsDiff - a.goalsDiff;
    return b.goals - a.goals;
  });

  // Populera bracket-slots för treor: hitta bästa trea från rätt grupper
  // Nyckel format: "3rd-ABCDF" → ta bästa trea vars grupLetter finns i "ABCDF"
  const usedThirdTeamIds = new Set<number>();
  function bestThirdFromGroups(groupLetters: string): { name: string; logo: string } | null {
    for (const t of thirdPlaced) {
      if (!usedThirdTeamIds.has(t.team.id) && groupLetters.includes(t.groupLetter)) {
        usedThirdTeamIds.add(t.team.id);
        return t.team;
      }
    }
    return null;
  }

  function resolveSlot(key: string): { label: string; team: { name: string; logo: string } | null } {
    if (!key.startsWith("3rd-")) {
      return { label: key, team: positionMap.get(key) ?? null };
    }
    const letters = key.replace("3rd-", "");
    const label = `Bästa 3:a (${letters.split("").join("/")})`;
    const team = bestThirdFromGroups(letters);
    return { label, team };
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
