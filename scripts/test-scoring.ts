import { db } from "../src/db";
import { tournaments, matches, users, predictions } from "../src/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { calculatePoints } from "../src/lib/scoring";

const TEST_USER_ID = "test-scoring-user-tmp";

async function cleanup() {
  await db.delete(predictions).where(eq(predictions.userId, TEST_USER_ID));
  await db.delete(users).where(eq(users.id, TEST_USER_ID));
}

async function main() {
  await cleanup();

  // Get active/open tournament
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.status, "active"))
    .limit(1)
    .then(async (r) => r.length ? r : db.select().from(tournaments).where(eq(tournaments.status, "open")).limit(1));

  if (!tournament) {
    console.error("Ingen aktiv turnering hittades.");
    process.exit(1);
  }

  // Get any scheduled match
  const [match] = await db
    .select()
    .from(matches)
    .where(and(eq(matches.tournamentId, tournament.id), eq(matches.status, "scheduled")))
    .limit(1);

  if (!match) {
    console.error("Inga schemalagda matcher hittades.");
    process.exit(1);
  }

  console.log(`\nAnvänder match: ${match.id} (${match.groupName ?? match.roundName})`);
  console.log(`Turneringspoäng: rätt utfall=${tournament.pointsForCorrectOutcome}p, exakt=${tournament.pointsForExactScore}p\n`);

  // Create temp test user
  await db.insert(users).values({
    id: TEST_USER_ID,
    email: "test-scoring@test.local",
    displayName: "Test Scoring",
    profileComplete: true,
  });

  // Three predictions to test all cases
  const testCases = [
    { label: "Exakt rätt (2-1)",        home: 2, away: 1 },
    { label: "Rätt utfall, fel poäng (3-1)", home: 3, away: 1 },
    { label: "Helt fel (0-2)",           home: 0, away: 2 },
  ];

  const actualHome = 2;
  const actualAway = 1;
  console.log(`Verkligt resultat: ${actualHome}–${actualAway}\n`);

  for (const tc of testCases) {
    const result = calculatePoints(
      tc.home,
      tc.away,
      actualHome,
      actualAway,
      tournament.pointsForCorrectOutcome,
      tournament.pointsForExactScore
    );

    const maxPoints = tournament.pointsForCorrectOutcome + tournament.pointsForExactScore;
    const outcome = result.isExactScore
      ? `✅ Exakt (${result.points}/${maxPoints}p)`
      : result.isCorrectOutcome
      ? `🟡 Rätt utfall (${result.points}/${maxPoints}p)`
      : `❌ Fel (${result.points}/${maxPoints}p)`;

    console.log(`Tipp: ${tc.home}–${tc.away}  →  ${outcome}  [${tc.label}]`);
  }

  // Test DB round-trip: insert a prediction, score it, verify
  console.log("\n--- DB round-trip test ---");
  const [inserted] = await db
    .insert(predictions)
    .values({
      tournamentId: tournament.id,
      matchId: match.id,
      userId: TEST_USER_ID,
      predictedHomeScore: 2,
      predictedAwayScore: 1,
    })
    .returning();

  // Simulate scoring (same logic as scorePredictions in sync/index.ts)
  const { points, isExactScore, isCorrectOutcome } = calculatePoints(
    inserted.predictedHomeScore,
    inserted.predictedAwayScore,
    actualHome,
    actualAway,
    tournament.pointsForCorrectOutcome,
    tournament.pointsForExactScore
  );

  await db
    .update(predictions)
    .set({ points, isExactScore, isCorrectOutcome, updatedAt: new Date() })
    .where(eq(predictions.id, inserted.id));

  const [scored] = await db.select().from(predictions).where(eq(predictions.id, inserted.id));
  const expectedPoints = tournament.pointsForCorrectOutcome + tournament.pointsForExactScore;

  if (scored.points === expectedPoints && scored.isExactScore === true && scored.isCorrectOutcome === true) {
    console.log(`✅ DB-test OK: tipp 2-1, resultat 2-1 → ${scored.points}p (exakt=${scored.isExactScore}, utfall=${scored.isCorrectOutcome})`);
  } else {
    console.error(`❌ DB-test MISSLYCKADES: förväntade ${expectedPoints}p men fick ${scored.points}p`);
  }

  await cleanup();
  console.log("\nTestdata städat bort.\n");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
