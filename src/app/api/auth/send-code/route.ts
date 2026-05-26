import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuthCode } from "@/lib/auth/otp";
import { sendLoginCode } from "@/lib/email/resend";

const schema = z.object({ email: z.string().email() });

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(email);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(email, { count: 1, resetAt: now + 5 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const { email } = schema.parse(await req.json());
    if (!checkRateLimit(email.toLowerCase())) {
      return NextResponse.json({ error: "För många försök. Vänta 5 minuter." }, { status: 429 });
    }
    const code = await createAuthCode(email);
    await sendLoginCode(email, code);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Ogiltig e-post" }, { status: 400 });
    console.error(err);
    return NextResponse.json({ error: "Serverfel" }, { status: 500 });
  }
}
