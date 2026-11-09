import nodemailer from "nodemailer";

// With no SMTP_HOST configured, mail is written to the server log instead.
// That is the intended local-development path — the magic link is read from
// the terminal. On a deployed host it means links land in the deploy logs,
// so SMTP must be configured before real use.
export async function sendMail({ to, subject, text, html }) {
  if (!process.env.SMTP_HOST) {
    console.log(`\n--- email to ${to} ---\n${subject}\n${text}\n`);
    return { delivered: false, loggedToConsole: true };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });

  return { delivered: true };
}
