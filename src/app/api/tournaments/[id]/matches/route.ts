import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { matches, teams, phases } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { predictions } from "@/db/schema";
import { and } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params;
  const session = await getSession();

  const homeTeam = db.$with("homeTeam").as(
    db.select({ id: teams.id, name: teams.name, shortName: teams.shortName, logoUrl: teams.logoUrl })
      .from(teams)
  );

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

  // Enrich with team names
  const teamIds = [
    ...new Set([
      ...rows.map((r) => r.homeTeamId).filter(Boolean),
      ...rows.map((r) => r.awayTeamId).filter(Boolean),
    ]),
  ] as string[];

  const teamMap = new Map<string, { name: string; shortName: string | null; logoUrl: string | null }>();
  if (teamIds.length > 0) {
    const teamRows = await db
      .select({ id: teams.id, name: teams.name, shortName: teams.shortName, logoUrl: teams.logoUrl })
      .from(teams)
      .where(eq(teams.id, teamIds[0])); // Will be replaced with inArray below

    // Re-fetch all teams
    const allTeams = await db.select().from(teams);
    for (const t of allTeams) {
      teamMap.set(t.id, { name: t.name, shortName: t.shortName, logoUrl: t.logoUrl });
    }
  }

  // Fetch user predictions if logged in
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
    homeTeam: row.homeTeamId ? teamMap.get(row.homeTeamId) ?? null : null,
    awayTeam: row.awayTeamId ? teamMap.get(row.awayTeamId) ?? null : null,
    userPrediction: predMap.get(row.id) ?? null,
  }));

  return NextResponse.json(enriched);
}
