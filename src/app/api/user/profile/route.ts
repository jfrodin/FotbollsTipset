import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const schema = z.object({
  displayName: z.string().min(1).max(30),
});

export async function PATCH(req: NextRequest) {
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { displayName } = schema.parse(await req.json());
    const [updated] = await db
      .update(users)
      .set({ displayName: displayName.trim(), profileComplete: true, updatedAt: new Date() })
      .where(eq(users.id, session.id))
      .returning();
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Ogiltigt namn" }, { status: 400 });
    return NextResponse.json({ error: "Serverfel" }, { status: 500 });
  }
}
