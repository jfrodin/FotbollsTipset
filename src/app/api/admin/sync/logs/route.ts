import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/db";
import { syncLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tournamentId = req.nextUrl.searchParams.get("tournamentId");

  const logs = await db
    .select()
    .from(syncLogs)
    .where(tournamentId ? eq(syncLogs.tournamentId, tournamentId) : undefined)
    .orderBy(desc(syncLogs.startedAt))
    .limit(50);

  return NextResponse.json(logs);
}
