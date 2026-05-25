import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournaments } from "@/db/schema";
import { ne } from "drizzle-orm";

export async function GET() {
  const all = await db
    .select()
    .from(tournaments)
    .where(ne(tournaments.status, "draft"))
    .orderBy(tournaments.startsAt);

  return NextResponse.json(all);
}
