import { db } from "@/db";
import {
  tournaments,
  phases,
  teams,
  tournamentTeams,
  matches,
  predictions,
  syncLogs,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { fetchFixtures, fetchTeams } from "@/lib/football-api/api-football";
import { mapFixtureStatus, roundToPhaseType } from "@/lib/football-api/types";
import { calculatePoints } from "@/lib/scoring";
import { TEAM_NAME_TO_SV } from "@/lib/team-names";


const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  "Mexico": "MX", "South Africa": "ZA", "South Korea": "KR", "Czechia": "CZ", "Czech Republic": "CZ",
  "Canada": "CA", "Bosnia and Herzegovina": "BA", "Qatar": "QA", "Switzerland": "CH",
  "Brazil": "BR", "Morocco": "MA", "Scotland": "GB-SCT", "Haiti": "HT",
  "USA": "US", "United States": "US", "Paraguay": "PY", "Australia": "AU", "Turkey": "TR",
  "Germany": "DE", "Ivory Coast": "CI", "Ecuador": "EC", "Curacao": "CW", "Curaçao": "CW",
  "Netherlands": "NL", "Japan": "JP", "Sweden": "SE", "Tunisia": "TN",
  "Belgium": "BE", "Egypt": "EG", "Iran": "IR", "New Zealand": "NZ",
  "Spain": "ES", "Cape Verde": "CV", "Saudi Arabia": "SA", "Uruguay": "UY",
  "France": "FR", "Senegal": "SN", "Iraq": "IQ", "Norway": "NO",
  "Argentina": "AR", "Algeria": "DZ", "Austria": "AT", "Jordan": "JO",
  "Portugal": "PT", "DR Congo": "CD", "Uzbekistan": "UZ", "Colombia": "CO",
  "England": "GB-ENG", "Croatia": "HR", "Ghana": "GH", "Panama": "PA",
  "Serbia": "RS", "Ukraine": "UA", "Poland": "PL", "Denmark": "DK",
  "Wales": "GB-WLS", "Italy": "IT",
};

export interface SyncResult {
  matchesUpdated: number;
  predictionsScored: number;
  errors: string[];
}

export async function syncTournament(tournamentId: string): Promise<SyncResult> {
  const startedAt = new Date();
  const result: SyncResult = { matchesUpdated: 0, predictionsScored: 0, errors: [] };

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!tournament || !tournament.externalId || !tournament.apiProvider) {
    result.errors.push("Tournament missing externalId or apiProvider");
    await writeSyncLog(tournamentId, tournament?.apiProvider, "error", result, startedAt);
    return result;
  }

  const season = tournament.year;
  const leagueId = tournament.externalId;

  try {
    // Sync teams
    const apiTeams = await fetchTeams(leagueId, season);
    for (const { team } of apiTeams) {
      const countryCode = COUNTRY_NAME_TO_ISO[team.country] ?? team.country;
      const mappedCode = COUNTRY_NAME_TO_ISO[team.country];
      const svName = TEAM_NAME_TO_SV[team.name] ?? team.name;
      await db
        .insert(teams)
        .values({
          name: svName,
          shortName: team.code,
          countryCode,
          logoUrl: team.logo,
          externalId: String(team.id),
        })
        .onConflictDoUpdate({
          target: teams.externalId,
          set: {
            name: svName,
            shortName: team.code,
            ...(mappedCode ? { countryCode: mappedCode } : {}),
            logoUrl: team.logo,
          },
        });

      const [dbTeam] = await db
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.externalId, String(team.id)))
        .limit(1);

      if (dbTeam) {
        await db
          .insert(tournamentTeams)
          .values({ tournamentId, teamId: dbTeam.id })
          .onConflictDoNothing();
      }
    }

    // Sync fixtures
    const fixtures = await fetchFixtures(leagueId, season);
    const existingPhases = await db
      .select()
      .from(phases)
      .where(eq(phases.tournamentId, tournamentId));

    for (const fixture of fixtures) {
      const roundName = fixture.league.round;
      const phaseType = roundToPhaseType(roundName);

      // Find or create phase
      let phase = existingPhases.find(
        (p) => p.type === phaseType && (phaseType === "group" ? p.name === "Gruppspel" : p.name === roundName)
      );

      if (!phase) {
        const phaseName = phaseType === "group" ? "Gruppspel" : roundName;
        const [newPhase] = await db
          .insert(phases)
          .values({
            tournamentId,
            name: phaseName,
            type: phaseType,
            status: "locked",
          })
          .onConflictDoNothing()
          .returning();

        if (newPhase) {
          existingPhases.push(newPhase);
          phase = newPhase;
        }
      }

      if (!phase) continue;

      const homeTeamExtId = String(fixture.teams.home.id);
      const awayTeamExtId = String(fixture.teams.away.id);

      const [homeTeam] = await db
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.externalId, homeTeamExtId))
        .limit(1);

      const [awayTeam] = await db
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.externalId, awayTeamExtId))
        .limit(1);

      const status = mapFixtureStatus(fixture.fixture.status.short);
      const homeScore = fixture.goals.home;
      const awayScore = fixture.goals.away;
      const svRoundName = roundName
        .replace("Group Stage - 1", "Omgång 1")
        .replace("Group Stage - 2", "Omgång 2")
        .replace("Group Stage - 3", "Omgång 3")
        .replace("Round of 32", "Sextondelar")
        .replace("Round of 16", "Åttondelsfinaler")
        .replace("Quarter-finals", "Kvartsfinaler")
        .replace("Semi-finals", "Semifinaler")
        .replace("3rd Place Final", "Bronsmatch")
        .replace("Final", "Final");
      const venue = fixture.fixture.venue.name
        ? `${fixture.fixture.venue.name}, ${fixture.fixture.venue.city ?? ""}`.trim().replace(/,\s*$/, "")
        : null;

      const [existingMatch] = await db
        .select()
        .from(matches)
        .where(eq(matches.externalId, String(fixture.fixture.id)))
        .limit(1);

      if (existingMatch) {
        const changed =
          existingMatch.status !== status ||
          existingMatch.homeScore !== homeScore ||
          existingMatch.awayScore !== awayScore ||
          (venue !== null && existingMatch.venue !== venue);

        if (changed) {
          await db
            .update(matches)
            .set({
              status,
              homeScore,
              awayScore,
              venue,
              updatedAt: new Date(),
            })
            .where(eq(matches.id, existingMatch.id));

          result.matchesUpdated++;

          if (status === "finished" && homeScore !== null && awayScore !== null) {
            result.predictionsScored += await scorePredictions(
              existingMatch.id,
              homeScore,
              awayScore,
              tournament.pointsForCorrectOutcome,
              tournament.pointsForExactScore
            );
          }
        }
      } else {
        await db.insert(matches).values({
          tournamentId,
          phaseId: phase.id,
          externalId: String(fixture.fixture.id),
          homeTeamId: homeTeam?.id,
          awayTeamId: awayTeam?.id,
          startsAt: new Date(fixture.fixture.date),
          status,
          homeScore,
          awayScore,
          venue,
          roundName: svRoundName,
        });
        result.matchesUpdated++;
      }
    }

    await writeSyncLog(tournamentId, tournament.apiProvider, "success", result, startedAt);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(message);
    await writeSyncLog(tournamentId, tournament.apiProvider, "error", result, startedAt, message);
  }

  return result;
}

async function scorePredictions(
  matchId: string,
  homeScore: number,
  awayScore: number,
  pointsForOutcome: number,
  pointsForExact: number
): Promise<number> {
  const matchPredictions = await db
    .select()
    .from(predictions)
    .where(and(eq(predictions.matchId, matchId)));

  let count = 0;
  for (const pred of matchPredictions) {
    const { points, isExactScore, isCorrectOutcome } = calculatePoints(
      pred.predictedHomeScore,
      pred.predictedAwayScore,
      homeScore,
      awayScore,
      pointsForOutcome,
      pointsForExact
    );

    await db
      .update(predictions)
      .set({ points, isExactScore, isCorrectOutcome, updatedAt: new Date() })
      .where(eq(predictions.id, pred.id));

    count++;
  }
  return count;
}

async function writeSyncLog(
  tournamentId: string,
  provider: string | null | undefined,
  status: "success" | "partial" | "error",
  result: SyncResult,
  startedAt: Date,
  message?: string
) {
  await db.insert(syncLogs).values({
    tournamentId,
    provider: provider ?? "unknown",
    status,
    message: message ?? (result.errors.length > 0 ? result.errors.join("; ") : null),
    matchesUpdated: result.matchesUpdated,
    predictionsScored: result.predictionsScored,
    startedAt,
    finishedAt: new Date(),
  });
}
