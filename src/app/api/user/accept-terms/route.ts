import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.update(users).set({ hasAcceptedTerms: true, updatedAt: new Date() }).where(eq(users.id, session.id));
  return NextResponse.json({ ok: true });
}
