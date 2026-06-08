import { db } from "../src/db";
import { teams } from "../src/db/schema";

async function main() {
  const rows = await db.select({ name: teams.name, countryCode: teams.countryCode }).from(teams).orderBy(teams.name);
  for (const r of rows) console.log(`${r.name} | ${r.countryCode}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
