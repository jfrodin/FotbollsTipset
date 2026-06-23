import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/db";
import { matches, teams } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fetchMatchEvents, fetchFixture } from "@/lib/football-api/api-football";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { matchId } = await params;

  const [match] = await db
    .select({
      status: matches.status,
      externalId: matches.externalId,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (match.status !== "finished" && match.status !== "live") {
    return NextResponse.json({ error: "Match not started" }, { status: 403 });
  }
  if (!match.externalId) return NextResponse.json([]);

  // Get external IDs for home/away teams so we can map event.team.id → side
  const teamRows = await db
    .select({ id: teams.id, externalId: teams.externalId, countryCode: teams.countryCode })
    .from(teams)
    .where(eq(teams.id, match.homeTeamId ?? ""));

  const awayTeamRows = await db
    .select({ id: teams.id, externalId: teams.externalId, countryCode: teams.countryCode })
    .from(teams)
    .where(eq(teams.id, match.awayTeamId ?? ""));

  const homeExternalId = teamRows[0]?.externalId;
  const awayExternalId = awayTeamRows[0]?.externalId;
  const homeCountryCode = teamRows[0]?.countryCode;
  const awayCountryCode = awayTeamRows[0]?.countryCode;

  try {
    // Hämta fixture för att få aktuellt resultat och status
    const fixture = await fetchFixture(match.externalId).catch(() => null);
    if (fixture) {
      const status = fixture.fixture.status.short;
      const isLive = ["1H","HT","2H","ET","BT","P","INT","LIVE"].includes(status);
      const isFinished = ["FT","AET","PEN"].includes(status);
      if (isLive || isFinished) {
        await db.update(matches).set({
          homeScore: fixture.goals.home ?? undefined,
          awayScore: fixture.goals.away ?? undefined,
          status: isFinished ? "finished" : "live",
          updatedAt: new Date(),
        }).where(eq(matches.id, matchId));
      }
    }

    const events = await fetchMatchEvents(match.externalId);

    let homeScore = 0;
    let awayScore = 0;

    const enriched = events
      .filter(e => e.type === "Goal" || e.type === "Card")
      .map(e => {
        const eventTeamExtId = String(e.team.id);
        const isHome = eventTeamExtId === homeExternalId;
        const isAway = eventTeamExtId === awayExternalId;
        const isOwnGoal = e.type === "Goal" && e.detail === "Own Goal";
        // Självmål visas på motståndarsidan (de som fick målet)
        const side: "home" | "away" | null = isOwnGoal
          ? (isHome ? "away" : isAway ? "home" : null)
          : (isHome ? "home" : isAway ? "away" : null);
        const countryCode = isOwnGoal
          ? (isHome ? awayCountryCode : homeCountryCode)
          : (isHome ? homeCountryCode : awayCountryCode);

        let score: { home: number; away: number } | null = null;
        if (e.type === "Goal") {
          if (isOwnGoal) {
            if (isHome) awayScore++;
            else homeScore++;
          } else {
            if (isHome) homeScore++;
            else awayScore++;
          }
          score = { home: homeScore, away: awayScore };
        }

        return { ...e, side, countryCode, score };
      });

    return NextResponse.json(enriched);
  } catch {
    return NextResponse.json({ error: "Could not fetch events" }, { status: 502 });
  }
}
