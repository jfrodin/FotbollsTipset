import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/db";
import { users } from "@/db/schema";
import { sendBroadcastEmail } from "@/lib/email/resend";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { subject, body } = await req.json();
  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "Ämne och meddelande krävs" }, { status: 400 });
  }

  const allUsers = await db.select({ email: users.email, displayName: users.displayName }).from(users);

  let sent = 0;
  for (const user of allUsers) {
    await sendBroadcastEmail(user.email, user.displayName, subject.trim(), body.trim());
    sent++;
  }

  return NextResponse.json({ sent });
}
