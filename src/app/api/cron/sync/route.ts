import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tournaments } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { syncTournament } from "@/lib/sync";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeTournaments = await db
    .select()
    .from(tournaments)
    .where(inArray(tournaments.status, ["active", "open"]));

  const results = await Promise.allSettled(
    activeTournaments.map((t) => syncTournament(t.id))
  );

  return NextResponse.json({
    synced: activeTournaments.length,
    results: results.map((r) =>
      r.status === "fulfilled" ? r.value : { error: String(r.reason) }
    ),
  });
}
