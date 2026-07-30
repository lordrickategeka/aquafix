const nodemailer = require('nodemailer');

const MAIL_DRIVER = process.env.MAIL_DRIVER || 'log';
const MAIL_FROM = process.env.MAIL_FROM || 'No Reply <no-reply@example.com>';

let transport;
function smtpTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
  }
  return transport;
}

// Laravel's Mail facade equivalent: callers always go through this one
// function; MAIL_DRIVER decides whether a message is actually sent over SMTP
// or just printed to the worker's console (the "log" driver, default — same
// zero-config role Laravel's own `log` mailer plays in local dev).
async function sendMail({ to, subject, html, text }) {
  if (MAIL_DRIVER === 'smtp') {
    await smtpTransport().sendMail({ from: MAIL_FROM, to, subject, html, text });
    return;
  }

  console.log(`[mail:log] From: ${MAIL_FROM}\nTo: ${to}\nSubject: ${subject}\n\n${text || html}`);
}

module.exports = { sendMail };
