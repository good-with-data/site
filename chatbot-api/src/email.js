/**
 * email.js
 *
 * Sends two emails when a user submits the contact form:
 *  1. Notification to GWD with the user's details and message
 *  2. Acknowledgement to the user
 */

import nodemailer from "nodemailer";

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: false,       // true for port 465, false for 587 (STARTTLS)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Send contact notification to GWD and acknowledgement to the user.
 *
 * @param {{ name: string, email: string, message: string }} contact
 */
export async function sendContactEmails({ name, email, message }) {
  const transporter = createTransport();
  const gwdAddress = process.env.SMTP_USER; // hello@goodwithdata.org.uk

  // ── 1. Notification to GWD ───────────────────────────────────────────────
  await transporter.sendMail({
    from: `"GWD Chatbot" <${gwdAddress}>`,
    to: gwdAddress,
    subject: `New contact via website chatbot — ${name}`,
    text: [
      "A user has requested to get in touch via the website chatbot.",
      "",
      `Name:    ${name}`,
      `Email:   ${email}`,
      `Message: ${message}`,
      "",
      "Please follow up at your earliest convenience.",
    ].join("\n"),
    html: `
      <p>A user has requested to get in touch via the website chatbot.</p>
      <table>
        <tr><td><strong>Name</strong></td><td>${escapeHtml(name)}</td></tr>
        <tr><td><strong>Email</strong></td><td>${escapeHtml(email)}</td></tr>
        <tr><td><strong>Message</strong></td><td>${escapeHtml(message)}</td></tr>
      </table>
      <p>Please follow up at your earliest convenience.</p>
    `,
  });

  // ── 2. Acknowledgement to user ───────────────────────────────────────────
  await transporter.sendMail({
    from: `"Good With Data CIC" <${gwdAddress}>`,
    to: email,
    subject: "Thanks for getting in touch — Good With Data CIC",
    text: [
      `Hi ${name},`,
      "",
      "Thank you for getting in touch with Good With Data CIC.",
      "We've received your message and will get back to you as soon as possible.",
      "",
      "In the meantime, you can also reach us directly at:",
      "hello@goodwithdata.org.uk",
      "",
      "Best wishes,",
      "The Good With Data team",
    ].join("\n"),
    html: `
      <p>Hi ${escapeHtml(name)},</p>
      <p>Thank you for getting in touch with Good With Data CIC.</p>
      <p>We've received your message and will get back to you as soon as possible.</p>
      <p>In the meantime, you can also reach us directly at:
         <a href="mailto:hello@goodwithdata.org.uk">hello@goodwithdata.org.uk</a>
      </p>
      <p>Best wishes,<br>The Good With Data team</p>
    `,
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
