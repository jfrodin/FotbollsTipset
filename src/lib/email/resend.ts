import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendReminderEmail(email: string, name: string, matchCount: number) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log(`Påminnelse till ${email}: ${matchCount} match(er) kvar att tippa`);
    return;
  }

  await transporter.sendMail({
    from: `FotbollsTipset <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Glöm inte tippa – ${matchCount} match${matchCount !== 1 ? "er" : ""} börjar snart!`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="margin:0 0 8px">FotbollsTipset</h2>
        <p>Hej ${name}!</p>
        <p>Du har <strong>${matchCount} match${matchCount !== 1 ? "er" : ""}</strong> att tippa som startar inom 2 timmar.</p>
        <a href="${process.env.APP_URL}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">
          Tippa nu →
        </a>
        <p style="color:#999;font-size:14px;margin-top:24px">Du kan inte tippa efter att matchen startat.</p>
      </div>`,
  });
}

export async function sendBroadcastEmail(email: string, name: string, subject: string, body: string) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log(`Broadcast till ${email}: ${subject}`);
    return;
  }

  await transporter.sendMail({
    from: `FotbollsTipset <${process.env.GMAIL_USER}>`,
    to: email,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="margin:0 0 8px">FotbollsTipset</h2>
        <p>Hej ${name}!</p>
        ${body.split("\n").map(line => line ? `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>` : "<br>").join("")}
        <p style="color:#999;font-size:12px;margin-top:32px;border-top:1px solid #eee;padding-top:16px">
          Du får detta mail eftersom du är registrerad på FotbollsTipset.
        </p>
      </div>`,
  });
}

export async function sendLoginCode(email: string, code: string) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log(`\nInloggningskod for ${email}: ${code}\n`);
    return;
  }

  await transporter.sendMail({
    from: `FotbollsTipset <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `${code} - din inloggningskod`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="margin:0 0 8px">FotbollsTipset</h2>
        <p style="color:#555">Din inloggningskod:</p>
        <div style="font-size:48px;font-weight:bold;letter-spacing:8px;margin:24px 0">${code}</div>
        <p style="color:#999;font-size:14px">Koden galler i 10 minuter.</p>
      </div>`,
  });
}
