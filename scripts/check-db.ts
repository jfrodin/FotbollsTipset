import { db } from "../src/db";
import { tournaments, phases, matches } from "../src/db/schema";

async function main() {
  const ts = await db.select().from(tournaments);
  console.log("Turneringar:", JSON.stringify(ts, null, 2));

  const ps = await db.select().from(phases);
  console.log("Faser:", JSON.stringify(ps, null, 2));

  const ms = await db.select().from(matches).limit(3);
  console.log("Exempel matcher:", JSON.stringify(ms, null, 2));

  const count = await db.select().from(matches);
  console.log("Antal matcher:", count.length);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
