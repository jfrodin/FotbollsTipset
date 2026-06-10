import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/db";
import { matches, teams, users, predictions, tournaments } from "@/db/schema";
import { eq, and, gte, isNull, asc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY saknas" }, { status: 500 });
  }

  // Hitta Claude-boten
  const [bot] = await db.select().from(users).where(eq(users.email, "claude@anthropic.com")).limit(1);
  if (!bot) return NextResponse.json({ error: "Claude-boten saknas, kör create-claude-bot.ts" }, { status: 500 });

  // Hitta aktiv turnering
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.status, "active")).limit(1)
    .then(async r => r.length ? r : db.select().from(tournaments).where(eq(tournaments.status, "open")).limit(1));
  if (!tournament) return NextResponse.json({ error: "Ingen aktiv turnering" }, { status: 400 });

  // Hitta alla kommande matcher som Claude inte tippat
  const now = new Date();
  const upcomingMatches = await db
    .select()
    .from(matches)
    .where(and(eq(matches.tournamentId, tournament.id), gte(matches.startsAt, now), eq(matches.status, "scheduled")))
    .orderBy(asc(matches.startsAt));

  const existingPreds = await db
    .select({ matchId: predictions.matchId })
    .from(predictions)
    .where(and(eq(predictions.userId, bot.id), eq(predictions.tournamentId, tournament.id)));

  const tippedMatchIds = new Set(existingPreds.map(p => p.matchId));
  const untipped = upcomingMatches.filter(m => !tippedMatchIds.has(m.id));

  if (untipped.length === 0) {
    return NextResponse.json({ tipped: 0, message: "Claude har redan tippat alla kommande matcher" });
  }

  const allTeams = await db.select().from(teams);
  const teamMap = new Map(allTeams.map(t => [t.id, t]));

  let tipped = 0;
  const results: { match: string; prediction: string; analysis: string }[] = [];

  for (const match of untipped) {
    const homeTeam = match.homeTeamId ? teamMap.get(match.homeTeamId) : null;
    const awayTeam = match.awayTeamId ? teamMap.get(match.awayTeamId) : null;

    if (!homeTeam || !awayTeam) continue;

    const matchDate = new Date(match.startsAt).toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });
    const matchTime = new Date(match.startsAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm" });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `Du är en fotbollsanalytiker som tävlar i ett VM-tipspel. Du ska tippa resultatet i följande match och vill vinna hela tävlingen.

Match: ${homeTeam.name} vs ${awayTeam.name}
Grupp/Runda: ${match.groupName ?? match.roundName ?? "VM 2026"}
Datum: ${matchDate} kl ${matchTime}

Svara EXAKT i detta format (inget annat):
TIPP: X-Y
ANALYS: [Max 2 meningar på svenska om varför du tippat så]`
      }]
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const scoreMatch = text.match(/TIPP:\s*(\d+)-(\d+)/);
    const analysisMatch = text.match(/ANALYS:\s*([\s\S]+)/);

    if (!scoreMatch) continue;

    const homeScore = parseInt(scoreMatch[1]);
    const awayScore = parseInt(scoreMatch[2]);
    const analysis = analysisMatch ? analysisMatch[1].trim() : "";

    await db.insert(predictions).values({
      tournamentId: tournament.id,
      matchId: match.id,
      userId: bot.id,
      predictedHomeScore: homeScore,
      predictedAwayScore: awayScore,
      analysis,
    }).onConflictDoNothing();

    results.push({ match: `${homeTeam.name} vs ${awayTeam.name}`, prediction: `${homeScore}-${awayScore}`, analysis });
    tipped++;
  }

  return NextResponse.json({ tipped, results });
}
