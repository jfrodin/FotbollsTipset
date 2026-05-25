import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tournaments, phases } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, id))
    .limit(1);

  if (!tournament) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tournamentPhases = await db
    .select()
    .from(phases)
    .where(eq(phases.tournamentId, id))
    .orderBy(phases.startsAt);

  return NextResponse.json({ ...tournament, phases: tournamentPhases });
}
