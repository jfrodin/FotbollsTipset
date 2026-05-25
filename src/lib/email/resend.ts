import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL ?? "noreply@speltorsk.madnuss.com";

export async function sendLoginCode(email: string, code: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`\n🔑 Inloggningskod för ${email}: ${code}\n`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `${code} – din inloggningskod`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="margin:0 0 8px">⚽ FotbollsTipset</h2>
        <p style="color:#555">Din inloggningskod:</p>
        <div style="font-size:48px;font-weight:bold;letter-spacing:8px;margin:24px 0">${code}</div>
        <p style="color:#999;font-size:14px">Koden gäller i 10 minuter.</p>
      </div>`,
  });
}
