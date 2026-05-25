import { db } from "../src/db";
import { users } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const email = process.env.ADMIN_EMAIL!;
  const [u] = await db.update(users).set({ role: "admin", profileComplete: true }).where(eq(users.email, email)).returning();
  console.log(u ? `✓ ${u.email} är nu admin` : `✗ Hittade ingen användare med ${email}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
