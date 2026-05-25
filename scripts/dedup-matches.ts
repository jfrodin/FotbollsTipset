import { db } from "../src/db";
import { matches } from "../src/db/schema";
import { asc } from "drizzle-orm";

async function main() {
  const all = await db.select().from(matches).orderBy(asc(matches.createdAt));

  const seen = new Set<string>();
  const toDelete: string[] = [];

  for (const m of all) {
    const key = `${m.tournamentId}-${m.homeTeamId}-${m.awayTeamId}-${m.startsAt.toISOString()}`;
    if (seen.has(key)) {
      toDelete.push(m.id);
    } else {
      seen.add(key);
    }
  }

  console.log(`Hittade ${toDelete.length} dubbletter att ta bort`);

  for (const id of toDelete) {
    await db.delete(matches).where((await import("drizzle-orm")).eq(matches.id, id));
  }

  const remaining = await db.select().from(matches);
  console.log(`✓ Klart. ${remaining.length} matcher kvar.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
