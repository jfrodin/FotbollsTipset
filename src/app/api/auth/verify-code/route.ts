import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuthCode } from "@/lib/auth/otp";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const schema = z.object({ email: z.string().email(), code: z.string().length(6) });

export async function POST(req: NextRequest) {
  try {
    const { email, code } = schema.parse(await req.json());

    if (!await verifyAuthCode(email, code)) {
      return NextResponse.json({ error: "Ogiltig eller utgången kod" }, { status: 401 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (!user) {
      [user] = await db.insert(users).values({
        email: normalizedEmail,
        displayName: normalizedEmail.split("@")[0],
      }).returning();
    }

    const token = await createSession(user.id);
    await setSessionCookie(token);
    return NextResponse.json({ user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Ogiltig inmatning" }, { status: 400 });
    console.error(err);
    return NextResponse.json({ error: "Serverfel" }, { status: 500 });
  }
}
