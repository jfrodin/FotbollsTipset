import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/db";
import { matches, predictions, tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { calculatePoints } from "@/lib/scoring";

const updateSchema = z.object({
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
  status: z.enum(["scheduled", "live", "finished", "postponed", "cancelled"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const data = updateSchema.parse(body);

    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, id))
      .limit(1);

    if (!match) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db
      .update(matches)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(matches.id, id));

    // Re-score predictions if result set
    const status = data.status ?? match.status;
    if (status === "finished") {
      const [tournament] = await db
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, match.tournamentId))
        .limit(1);

      const matchPredictions = await db
        .select()
        .from(predictions)
        .where(eq(predictions.matchId, id));

      for (const pred of matchPredictions) {
        const { points, isExactScore, isCorrectOutcome } = calculatePoints(
          pred.predictedHomeScore,
          pred.predictedAwayScore,
          data.homeScore,
          data.awayScore,
          tournament?.pointsForCorrectOutcome ?? 2,
          tournament?.pointsForExactScore ?? 3
        );
        await db
          .update(predictions)
          .set({ points, isExactScore, isCorrectOutcome, updatedAt: new Date() })
          .where(eq(predictions.id, pred.id));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Serverfel" }, { status: 500 });
  }
}
