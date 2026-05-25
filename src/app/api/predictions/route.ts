import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { predictions, matches } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";

const schema = z.object({
  matchId: z.string(),
  tournamentId: z.string(),
  predictedHomeScore: z.number().int().min(0).max(99),
  predictedAwayScore: z.number().int().min(0).max(99),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { matchId, tournamentId, predictedHomeScore, predictedAwayScore } = schema.parse(body);

    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (new Date() >= match.startsAt) {
      return NextResponse.json({ error: "Matchen har redan startat" }, { status: 400 });
    }

    if (["finished", "live", "cancelled"].includes(match.status)) {
      return NextResponse.json({ error: "Matchen är inte öppen för tips" }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: predictions.id })
      .from(predictions)
      .where(and(eq(predictions.matchId, matchId), eq(predictions.userId, session.id)))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(predictions)
        .set({
          predictedHomeScore,
          predictedAwayScore,
          updatedAt: new Date(),
        })
        .where(eq(predictions.id, existing.id))
        .returning();
      return NextResponse.json(updated);
    }

    const [created] = await db
      .insert(predictions)
      .values({
        matchId,
        tournamentId,
        userId: session.id,
        predictedHomeScore,
        predictedAwayScore,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ogiltig inmatning" }, { status: 400 });
    }
    console.error("predictions error:", err);
    return NextResponse.json({ error: "Serverfel" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tournamentId = req.nextUrl.searchParams.get("tournamentId");
  if (!tournamentId) {
    return NextResponse.json({ error: "tournamentId required" }, { status: 400 });
  }

  const userPredictions = await db
    .select()
    .from(predictions)
    .where(and(eq(predictions.tournamentId, tournamentId), eq(predictions.userId, session.id)));

  return NextResponse.json(userPredictions);
}
