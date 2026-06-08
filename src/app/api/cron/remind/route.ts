import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { matches, users, predictions } from "@/db/schema";
import { and, eq, gte, lte, inArray } from "drizzle-orm";
import { sendReminderEmail } from "@/lib/email/resend";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Skicka bara påminnelser mellan 07:00 och 22:00 Stockholm-tid
  const hour = new Date().toLocaleString("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "numeric",
    hour12: false,
  });
  const currentHour = parseInt(hour);
  if (currentHour < 7 || currentHour >= 22) {
    return NextResponse.json({ reminded: 0, skipped: "outside-hours" });
  }

  const now = new Date();
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const upcomingMatches = await db
    .select()
    .from(matches)
    .where(and(gte(matches.startsAt, now), lte(matches.startsAt, in2h), eq(matches.status, "scheduled")));

  if (upcomingMatches.length === 0) {
    return NextResponse.json({ reminded: 0 });
  }

  const matchIds = upcomingMatches.map((m) => m.id);
  const allUsers = await db.select().from(users);

  const tippedPreds = await db
    .select({ userId: predictions.userId, matchId: predictions.matchId })
    .from(predictions)
    .where(inArray(predictions.matchId, matchIds));

  const tippedByUser = new Map<string, Set<string>>();
  for (const p of tippedPreds) {
    if (!tippedByUser.has(p.userId)) tippedByUser.set(p.userId, new Set());
    tippedByUser.get(p.userId)!.add(p.matchId);
  }

  let reminded = 0;
  for (const user of allUsers) {
    const tipped = tippedByUser.get(user.id) ?? new Set();
    const missing = matchIds.filter((id) => !tipped.has(id));
    if (missing.length > 0) {
      await sendReminderEmail(user.email, user.displayName, missing.length);
      reminded++;
    }
  }

  return NextResponse.json({ reminded, matches: upcomingMatches.length });
}
