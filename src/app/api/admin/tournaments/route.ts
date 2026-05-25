import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/db";
import { tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";

const createSchema = z.object({
  name: z.string().min(1),
  year: z.number().int().min(2020).max(2050),
  sport: z.string().default("football"),
  apiProvider: z.string().optional(),
  externalId: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  pointsForCorrectOutcome: z.number().int().default(2),
  pointsForExactScore: z.number().int().default(3),
});

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const [tournament] = await db
      .insert(tournaments)
      .values({
        ...data,
        startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
      })
      .returning();

    return NextResponse.json(tournament, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Serverfel" }, { status: 500 });
  }
}

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const all = await db.select().from(tournaments).orderBy(tournaments.startsAt);
  return NextResponse.json(all);
}
