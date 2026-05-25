import { db } from "@/db";
import { authCodes } from "@/db/schema";
import { and, eq, gt, isNull } from "drizzle-orm";

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createAuthCode(email: string): Promise<string> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await db.insert(authCodes).values({ email: email.toLowerCase().trim(), code, expiresAt });
  return code;
}

export async function verifyAuthCode(email: string, code: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const [record] = await db
    .select()
    .from(authCodes)
    .where(and(
      eq(authCodes.email, normalizedEmail),
      eq(authCodes.code, code),
      gt(authCodes.expiresAt, new Date()),
      isNull(authCodes.usedAt),
    ))
    .limit(1);

  if (!record) return false;
  await db.update(authCodes).set({ usedAt: new Date() }).where(eq(authCodes.id, record.id));
  return true;
}
