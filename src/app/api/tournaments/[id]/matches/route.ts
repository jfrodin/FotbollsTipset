import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { matches, teams, phases, predictions } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params;
  const session = await getSession();

  const rows = await db
    .select({
      id: matches.id,
      phaseId: matches.phaseId,
      externalId: matches.externalId,
      startsAt: matches.startsAt,
      status: matches.status,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      groupName: matches.groupName,
      roundName: matches.roundName,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      phaseName: phases.name,
      phaseType: phases.type,
    })
    .from(matches)
    .leftJoin(phases, eq(matches.phaseId, phases.id))
    .where(eq(matches.tournamentId, tournamentId))
    .orderBy(asc(matches.startsAt));

  const allTeams = await db.select().from(teams);
  const teamMap = new Map(allTeams.map((t) => [t.id, t]));

  const predMap = new Map<string, { predictedHomeScore: number; predictedAwayScore: number; points: number | null }>();
  if (session) {
    const userPreds = await db
      .select()
      .from(predictions)
      .where(and(eq(predictions.tournamentId, tournamentId), eq(predictions.userId, session.id)));

    for (const p of userPreds) {
      predMap.set(p.matchId, {
        predictedHomeScore: p.predictedHomeScore,
        predictedAwayScore: p.predictedAwayScore,
        points: p.points,
      });
    }
  }

  const enriched = rows.map((row) => ({
    ...row,
    homeTeam: row.homeTeamId ? (teamMap.get(row.homeTeamId) ?? null) : null,
    awayTeam: row.awayTeamId ? (teamMap.get(row.awayTeamId) ?? null) : null,
    userPrediction: predMap.get(row.id) ?? null,
  }));

  return NextResponse.json(enriched);
}
