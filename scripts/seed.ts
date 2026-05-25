import { db } from "../src/db";
import { tournaments, phases, users } from "../src/db/schema";

async function seed() {
  console.log("Seeding database...");

  // Create VM 2026 tournament
  const [tournament] = await db
    .insert(tournaments)
    .values({
      name: "VM",
      year: 2026,
      sport: "football",
      status: "draft",
      startsAt: new Date("2026-06-11"),
      endsAt: new Date("2026-07-19"),
      apiProvider: "api-football",
      externalId: "1", // FIFA World Cup league ID on API-Football
      pointsForCorrectOutcome: 2,
      pointsForExactScore: 3,
    })
    .onConflictDoNothing()
    .returning();

  if (!tournament) {
    console.log("Tournament already exists, skipping.");
    process.exit(0);
  }

  console.log(`Created tournament: ${tournament.name} ${tournament.year} (${tournament.id})`);

  // Create phases
  const [groupPhase] = await db
    .insert(phases)
    .values({
      tournamentId: tournament.id,
      name: "Gruppspel",
      type: "group",
      status: "locked",
      startsAt: new Date("2026-06-11"),
      endsAt: new Date("2026-07-02"),
    })
    .returning();

  console.log(`Created phase: ${groupPhase.name}`);

  // Create an admin user (update email to your own)
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const [admin] = await db
    .insert(users)
    .values({
      email: adminEmail,
      displayName: "Admin",
      role: "admin",
    })
    .onConflictDoNothing()
    .returning();

  if (admin) {
    console.log(`Created admin user: ${admin.email}`);
  }

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
