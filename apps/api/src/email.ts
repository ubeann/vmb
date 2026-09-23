import { Resend } from "resend";
import type { Bindings } from "./bindings.js";

type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
};

// `EMAIL_TRANSPORT` is the preview escape hatch (issue #121): a preview URL is
// unlisted but public, so with production's Resend key and sender, anyone who
// finds one could send real mail in the production sender's name. Any value —
// previews set `log` in their secrets file (ADR-0019) — logs the message and
// never hands it to Resend; unset (production, local dev) sends for real. The
// flag is checked for truthiness rather than `=== "log"` so a mis-set value
// fails closed instead of quietly shipping real mail.
//
// The gate lives here — in the only module that talks to Resend (ADR-0017) —
// rather than in each caller, so a sender added later (e.g. password reset) is
// suppressed from previews by construction.
async function sendEmail(env: Bindings, email: OutboundEmail) {
  const message = { from: env.EMAIL_FROM, ...email };

  if (env.EMAIL_TRANSPORT) {
    console.log(`EMAIL_TRANSPORT=${env.EMAIL_TRANSPORT}: suppressed outbound email`, message);
    return;
  }

  const resend = new Resend(env.RESEND_API_KEY);

  const { error } = await resend.emails.send(message);

  if (error) {
    console.error("sendEmail: Resend request failed", error);
    throw new Error(`Failed to send email to ${email.to}: ${error.message}`);
  }
}

export async function sendVerificationEmail(env: Bindings, to: string, url: string) {
  await sendEmail(env, {
    to,
    subject: "Verify your email — VMB",
    html: `<p>Click the link below to verify your email address:</p><p><a href="${url}">${url}</a></p>`
  });
}

// The activation code (ADR-0033): a migrated user proves they own this inbox,
// then sets the password that replaces the legacy one. The announcement copy
// lives here because this is the first email most users get from the new
// platform.
export async function sendOtpEmail(env: Bindings, to: string, otp: string) {
  await sendEmail(env, {
    to,
    subject: "Your VMB sign-in code",
    html: `<p>VMB has moved to a new platform. Use this code to sign in and set your password:</p><p><strong>${otp}</strong></p><p>The code expires in 5 minutes. If you did not request it, you can ignore this email.</p>`
  });
}
