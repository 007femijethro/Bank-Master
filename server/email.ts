import nodemailer from "nodemailer";

type SecurityEmail = {
  to: string;
  subject: string;
  heading: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  code?: string;
};

function publicUrl() {
  return (process.env.PUBLIC_URL || "https://redbirdfcu.com").replace(/\/$/, "");
}

export function appUrl(path: string) {
  return `${publicUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function sendSecurityEmail(input: SecurityEmail): Promise<void> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;
  if (!host || !user || !pass || !from) {
    throw new Error("Email delivery is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
  const action = input.actionUrl
    ? `<p><a href="${input.actionUrl}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px">${input.actionLabel || "Continue"}</a></p>`
    : "";
  const code = input.code ? `<p style="font-size:28px;font-weight:700;letter-spacing:6px">${input.code}</p>` : "";
  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: `${input.heading}\n\n${input.message}${input.code ? `\n\nCode: ${input.code}` : ""}${input.actionUrl ? `\n\n${input.actionUrl}` : ""}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>${input.heading}</h2><p>${input.message}</p>${code}${action}<p style="color:#64748b;font-size:13px">If you did not request this, contact support immediately.</p></div>`,
  });
}
