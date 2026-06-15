import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/db";
import { matches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fetchMatchEvents } from "@/lib/football-api/api-football";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { matchId } = await params;

  const [match] = await db
    .select({ status: matches.status, externalId: matches.externalId })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (match.status !== "finished" && match.status !== "live") {
    return NextResponse.json({ error: "Match not started" }, { status: 403 });
  }
  if (!match.externalId) return NextResponse.json([]);

  try {
    const events = await fetchMatchEvents(match.externalId);
    // Only return goals and cards
    const filtered = events.filter(e => e.type === "Goal" || e.type === "Card");
    return NextResponse.json(filtered);
  } catch {
    return NextResponse.json({ error: "Could not fetch events" }, { status: 502 });
  }
}
