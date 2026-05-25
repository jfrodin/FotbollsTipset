import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { predictions, users, phases, matches } from "@/db/schema";
import { eq, and, sum, count, sql } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params;
  const phaseId = req.nextUrl.searchParams.get("phaseId");

  const conditions = [eq(predictions.tournamentId, tournamentId)];

  if (phaseId) {
    // Filter by phase via match join
    const phaseMatchIds = await db
      .select({ id: matches.id })
      .from(matches)
      .where(and(eq(matches.phaseId, phaseId), eq(matches.tournamentId, tournamentId)));

    const ids = phaseMatchIds.map((m) => m.id);
    if (ids.length === 0) return NextResponse.json([]);

    conditions.push(sql`${predictions.matchId} = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::text[])`);
  }

  const rows = await db
    .select({
      userId: predictions.userId,
      displayName: users.displayName,
      email: users.email,
      totalPoints: sum(predictions.points).mapWith(Number),
      exactScores: count(sql`CASE WHEN ${predictions.isExactScore} = true THEN 1 END`).mapWith(Number),
      correctOutcomes: count(sql`CASE WHEN ${predictions.isCorrectOutcome} = true THEN 1 END`).mapWith(Number),
      predictionsCount: count(predictions.id).mapWith(Number),
    })
    .from(predictions)
    .innerJoin(users, eq(predictions.userId, users.id))
    .where(and(...conditions))
    .groupBy(predictions.userId, users.displayName, users.email);

  // Sort: points DESC, exactScores DESC, correctOutcomes DESC, predictionsCount DESC, displayName ASC
  const sorted = rows.sort((a, b) => {
    if ((b.totalPoints ?? 0) !== (a.totalPoints ?? 0)) return (b.totalPoints ?? 0) - (a.totalPoints ?? 0);
    if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
    if (b.correctOutcomes !== a.correctOutcomes) return b.correctOutcomes - a.correctOutcomes;
    if (b.predictionsCount !== a.predictionsCount) return b.predictionsCount - a.predictionsCount;
    return a.displayName.localeCompare(b.displayName);
  });

  const leaderboard = sorted.map((row, idx) => ({
    rank: idx + 1,
    userId: row.userId,
    displayName: row.displayName,
    totalPoints: row.totalPoints ?? 0,
    exactScores: row.exactScores,
    correctOutcomes: row.correctOutcomes,
    predictionsCount: row.predictionsCount,
  }));

  return NextResponse.json(leaderboard);
}
