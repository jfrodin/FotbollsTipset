import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/db";
import { predictions, users, matches } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { matchId } = await params;

  const [match] = await db.select({ status: matches.status, startsAt: matches.startsAt })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  // Visa bara efter matchstart
  if (new Date() < new Date(match.startsAt) && match.status === "scheduled") {
    return NextResponse.json({ error: "Match has not started yet" }, { status: 403 });
  }

  const rows = await db
    .select({
      userId: predictions.userId,
      displayName: users.displayName,
      predictedHomeScore: predictions.predictedHomeScore,
      predictedAwayScore: predictions.predictedAwayScore,
      points: predictions.points,
    })
    .from(predictions)
    .innerJoin(users, eq(predictions.userId, users.id))
    .where(eq(predictions.matchId, matchId))
    .orderBy(users.displayName);

  return NextResponse.json(rows);
}
