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

// VM 2026 slutspelsstruktur baserad på FIFA-lottningen december 2024 (Wikipedia/Sky Sports).
// Varje R32-slot har sitt officiella matchnummer (M73-M88), och vi vet exakt vilka
// matchnummer som möts i nästa runda (R16/QF/SF/Final) – inget gissande om det.
// "3rd-XXXXX" matchas mot riktig fixture via lag-ID; vilket lag det blir avgörs alltid
// av den riktiga matchen från API:t, aldrig av oss.
// Halvorna nedan är verifierade mot de faktiska SF-matcherna 2026 (Frankrike–Spanien resp.
// Norge/England–Argentina/Schweiz), INTE mot Wikipedias visuella "vänster/höger"-gissning
// som visade sig fel. M99 (Spanien/Belgien) hör ihop med M97 (Frankrike/Marocko) i samma
// halva – inte med M100 – annars hamnar rätt lag i fel del av trädet i SF.
const VM2026_R32: { num: number; home: string; away: string }[] = [
  // Vänster halva → SF 101 (M97+M99-grenen)
  { num: 73, home: "A2", away: "B2" },
  { num: 75, home: "F1", away: "C2" },
  { num: 74, home: "E1", away: "3rd-ABCDF" },
  { num: 77, home: "I1", away: "3rd-CDFGH" },
  { num: 81, home: "D1", away: "3rd-BEFIJ" },
  { num: 82, home: "G1", away: "3rd-AEHIJ" },
  { num: 83, home: "K2", away: "L2" },
  { num: 84, home: "H1", away: "J2" },
  // Höger halva → SF 102 (M98+M100-grenen)
  { num: 76, home: "C1", away: "F2" },
  { num: 78, home: "E2", away: "I2" },
  { num: 79, home: "A1", away: "3rd-CEFHI" },
  { num: 80, home: "L1", away: "3rd-EHIJK" },
  { num: 85, home: "B1", away: "3rd-EFGIJ" },
  { num: 87, home: "K1", away: "3rd-DEIJL" },
  { num: 86, home: "J1", away: "H2" },
  { num: 88, home: "D2", away: "G2" },
];

// [eget matchnummer, matchnummer A, matchnummer B] – vinnaren av A möter vinnaren av B.
// Ordningen i arrayen MÅSTE matcha den visuella paringen av VM2026_R32 (par 0+1, 2+3, osv)
// – inte FIFA:s officiella matchnummerordning, annars hamnar fel lag i fel ruta i trädet.
const R16_PAIRS: [number, number, number][] = [
  [90, 73, 75], [89, 74, 77], [94, 81, 82], [93, 83, 84],
  [91, 76, 78], [92, 79, 80], [96, 85, 87], [95, 86, 88],
];
const QF_PAIRS: [number, number, number][] = [
  [97, 89, 90], [99, 93, 94], [98, 91, 92], [100, 95, 96],
];
const SF_PAIRS: [number, number, number][] = [
  [101, 97, 99], [102, 98, 100],
];
const FINAL_PAIR: [number, number, number] = [103, 101, 102];

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

  // Matcha varje R32-slot mot en riktig fixture via lag-ID. Vi gissar aldrig vilket lag
  // som blir "bästa 3:a" – det laget kommer direkt från den riktiga matchen.
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

  type BTeam = { id: number; name: string; logo: string };
  type BResult = { home: BTeam | null; away: BTeam | null; winner: BTeam | null };

  function winnerOf(fixture: (typeof allFixtures)[number]): BTeam | null {
    if (fixture.teams.home.winner === true) return fixture.teams.home;
    if (fixture.teams.away.winner === true) return fixture.teams.away;
    return null;
  }

  // Hitta en riktig fixture i en given omgång.
  // Om BÅDA lagen är kända krävs att BÅDA matchar (AND) – annars kan samma fixture
  // hamna i två olika bracket-slots (t.ex. Spanien-Frankrike på bägge sidor).
  function findRealFixture(roundName: string, teamA: BTeam | null, teamB: BTeam | null) {
    if (!teamA && !teamB) return null;
    return allFixtures.find((f) => {
      if (f.league.round !== roundName) return false;
      const homeId = f.teams.home.id;
      const awayId = f.teams.away.id;
      if (teamA && teamB) {
        return (homeId === teamA.id || awayId === teamA.id) &&
               (homeId === teamB.id || awayId === teamB.id);
      }
      if (teamA) return homeId === teamA.id || awayId === teamA.id;
      return homeId === teamB!.id || awayId === teamB!.id;
    }) ?? null;
  }

  const resultByNum = new Map<number, BResult>();

  for (const slot of VM2026_R32) {
    const fixture = findFixtureFor(slot.home, slot.away);
    resultByNum.set(slot.num, fixture
      ? { home: fixture.teams.home, away: fixture.teams.away, winner: winnerOf(fixture) }
      : { home: null, away: null, winner: null });
  }

  // Bygg nästa runda utifrån vinnarna av föregående matchnummer (förbestämd koppling,
  // t.ex. M89 = vinnare M74 möter vinnare M77). Om den riktiga fixturen redan finns i
  // API:t (omgången har börjat) använder vi den datan istället – aldrig en gissning.
  function buildRound(pairs: [number, number, number][], roundName: string) {
    for (const [num, fromA, fromB] of pairs) {
      const teamA = resultByNum.get(fromA)?.winner ?? null;
      const teamB = resultByNum.get(fromB)?.winner ?? null;
      const realFixture = findRealFixture(roundName, teamA, teamB);
      resultByNum.set(num, realFixture
        ? { home: realFixture.teams.home, away: realFixture.teams.away, winner: winnerOf(realFixture) }
        : { home: teamA, away: teamB, winner: null });
    }
  }
  buildRound(R16_PAIRS, "Round of 16");
  buildRound(QF_PAIRS, "Quarter-finals");
  buildRound(SF_PAIRS, "Semi-finals");
  buildRound([FINAL_PAIR], "Final");

  const r32Matches = VM2026_R32.map((slot) => {
    const r = resultByNum.get(slot.num);
    return {
      home: { label: slot.home, team: r?.home ?? null },
      away: { label: slot.away, team: r?.away ?? null },
    };
  });

  function progressMatches(pairs: [number, number, number][]) {
    return pairs.map(([num]) => {
      const r = resultByNum.get(num);
      return {
        home: { label: "TBD", team: r?.home ?? null },
        away: { label: "TBD", team: r?.away ?? null },
      };
    });
  }
  const r16Matches = progressMatches(R16_PAIRS);
  const qfMatches = progressMatches(QF_PAIRS);
  const sfMatches = progressMatches(SF_PAIRS);
  const finalMatch = progressMatches([FINAL_PAIR])[0];

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
          r32Matches={r32Matches}
          r16Matches={r16Matches}
          qfMatches={qfMatches}
          sfMatches={sfMatches}
          finalMatch={finalMatch}
        />
      </main>
    </>
  );
}
