import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendLoginCode(email: string, code: string) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log(`\n🔑 Inloggningskod för ${email}: ${code}\n`);
    return;
  }

  await transporter.sendMail({
    from: `FotbollsTipset <${process.env.GMAIL_USER}>`,
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
