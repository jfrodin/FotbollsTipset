import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { MatchList } from "@/components/MatchList";
import Link from "next/link";
import { db } from "@/db";
import { matches, teams, phases, predictions } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";

interface Props {
  params: Promise<{ id: string }>;
}

async function getGroupMatches(tournamentId: string, userId?: string) {
  const rows = await db
    .select({
      id: matches.id,
      phaseId: matches.phaseId,
      startsAt: matches.startsAt,
      status: matches.status,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      groupName: matches.groupName,
      roundName: matches.roundName,
      venue: matches.venue,
      broadcastChannel: matches.broadcastChannel,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      phaseName: phases.name,
      phaseType: phases.type,
    })
    .from(matches)
    .leftJoin(phases, eq(matches.phaseId, phases.id))
    .where(and(eq(matches.tournamentId, tournamentId), eq(phases.type, "group")))
    .orderBy(asc(matches.startsAt), asc(matches.groupName));

  const allTeams = await db.select().from(teams);
  const teamMap = new Map(allTeams.map((t) => [t.id, t]));

  const predMap = new Map<string, { predictedHomeScore: number; predictedAwayScore: number; points: number | null }>();
  if (userId) {
    const userPreds = await db
      .select()
      .from(predictions)
      .where(and(eq(predictions.tournamentId, tournamentId), eq(predictions.userId, userId)));
    for (const p of userPreds) {
      predMap.set(p.matchId, { predictedHomeScore: p.predictedHomeScore, predictedAwayScore: p.predictedAwayScore, points: p.points });
    }
  }

  return rows.map((row) => ({
    ...row,
    tournamentId,
    homeTeam: row.homeTeamId ? (teamMap.get(row.homeTeamId) ?? null) : null,
    awayTeam: row.awayTeamId ? (teamMap.get(row.awayTeamId) ?? null) : null,
    userPrediction: predMap.get(row.id) ?? null,
  }));
}

export default async function GroupStagePage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id: tournamentId } = await params;
  const matches = await getGroupMatches(tournamentId, session.id);

  return (
    <>
      <Navbar user={session} />
      <main className="max-w-4xl mx-auto px-4 py-8 w-full flex-1">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm">
            ← Hem
          </Link>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <h1 className="text-xl font-bold">Gruppspel</h1>
        </div>

        <MatchList matches={matches as unknown as Parameters<typeof MatchList>[0]["matches"]} />
      </main>
    </>
  );
}
