import { db } from "../src/db";
import { matches } from "../src/db/schema";
import { eq } from "drizzle-orm";

const FIXES = [
  ["Group Stage - 1", "Omgång 1"],
  ["Group Stage - 2", "Omgång 2"],
  ["Group Stage - 3", "Omgång 3"],
  ["Round of 32", "Sextondelar"],
  ["Round of 16", "Åttondelsfinaler"],
  ["Quarter-finals", "Kvartsfinaler"],
  ["Semi-finals", "Semifinaler"],
  ["3rd Place Final", "Bronsmatch"],
];

async function main() {
  for (const [from, to] of FIXES) {
    await db.update(matches).set({ roundName: to }).where(eq(matches.roundName, from));
    console.log(`${from} → ${to}`);
  }
  console.log("Klart!");
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
