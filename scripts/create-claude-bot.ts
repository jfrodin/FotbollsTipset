import { db } from "../src/db";
import { users } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const existing = await db.select().from(users).where(eq(users.email, "claude@anthropic.com"));
  if (existing.length > 0) {
    console.log("Claude-boten finns redan:", existing[0].id);
    process.exit(0);
  }

  const [bot] = await db.insert(users).values({
    email: "claude@anthropic.com",
    displayName: "Claude",
    role: "player",
    profileComplete: true,
    hasAcceptedTerms: true,
    isBot: true,
  }).returning();

  console.log("Claude-boten skapad:", bot.id);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
