import { db } from "../src/db";
import { matches, predictions } from "../src/db/schema";
import { isNull, eq } from "drizzle-orm";

async function main() {
  const seededMatches = await db.select({ id: matches.id }).from(matches).where(isNull(matches.externalId));
  console.log(`Hittade ${seededMatches.length} seedade matcher`);

  if (seededMatches.length === 0) {
    console.log("Inget att ta bort.");
    process.exit(0);
  }

  for (const m of seededMatches) {
    await db.delete(predictions).where(eq(predictions.matchId, m.id));
  }
  await db.delete(matches).where(isNull(matches.externalId));
  console.log("Klart! Kör sync i adminpanelen nu.");
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
