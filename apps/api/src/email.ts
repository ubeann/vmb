import { Resend } from "resend";
import type { Bindings } from "./bindings.js";

type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
};

// Email clients do not reliably support CSS variables or OKLCH. These hex
// equivalents follow the light palette in apps/web/src/app.css (ADR-0036).
const emailColors = {
  primary: "#087c16",
  foreground: "#0e1b4d",
  mutedForeground: "#565e7e",
  muted: "#eeedea",
  card: "#ffffff",
  border: "#dbdad6"
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[character] ?? character;
  });
}

function emailLayout(preview: string, title: string, content: string) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} — VMB</title></head>
<body style="margin:0;padding:0;background:${emailColors.muted};color:${emailColors.foreground};font-family:Arial,Helvetica,sans-serif">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0">${preview}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${emailColors.muted}"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border-collapse:collapse;background:${emailColors.card};border:1px solid ${emailColors.border};border-radius:12px">
      <tr><td style="padding:28px 32px 16px;color:${emailColors.primary};font-size:18px;font-weight:700;letter-spacing:2px">VMB</td></tr>
      <tr><td style="padding:0 32px 32px">
        <h1 style="margin:0 0 16px;color:${emailColors.foreground};font-size:24px;line-height:1.3">${title}</h1>
        ${content}
        <p style="margin:28px 0 0;color:${emailColors.mutedForeground};font-size:13px;line-height:1.6">If you did not request this, you can ignore this email.</p>
      </td></tr>
    </table>
    <p style="margin:20px 0 0;color:${emailColors.mutedForeground};font-size:12px">VMB Logistics</p>
  </td></tr></table>
</body></html>`;
}

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
  const idempotencyKey = crypto.randomUUID();

  for (let attempt = 1; ; attempt++) {
    const error = await sendOnce(resend, message, idempotencyKey);
    if (!error) return;

    if (!isRetryable(error) || attempt === sendAttempts) {
      console.error("sendEmail: Resend request failed", error);
      throw new Error(`Failed to send email to ${email.to}: ${error.message}`);
    }

    console.warn(`sendEmail: attempt ${attempt} failed, retrying`, error);
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
  }
}

// Every send runs after the reply through `waitUntil` (ADR-0017's amendment),
// so a failed send is only logged and the user never gets the email. A send
// gets three tries, and only for failures a later try can fix: no response (a
// network error, which Resend reports as `application_error` with no status,
// or the timeout below), a rate limit, a 5xx, and a still-running try with the
// same key. One idempotency key spans the tries, so a try that timed out here
// but reached Resend is not delivered twice. That also means a first try still
// running after every retry is logged as failed even if it delivers. The worst
// case, three timeouts and two waits, stays well inside the 30 s `waitUntil`
// allows after the reply.
const sendAttempts = 3;
const sendTimeoutMs = 5_000;
const retryDelayMs = 500;
const retryableNames = new Set([
  "timeout",
  "rate_limit_exceeded",
  "concurrent_idempotent_requests"
]);

type SendError = { name: string; message: string; statusCode: number | null };

// `application_error` is also what the SDK returns for any response it cannot
// parse, a 4xx included, so it is retried only with no status or a 5xx.
function isRetryable({ name, statusCode }: SendError) {
  if (retryableNames.has(name)) return true;
  return statusCode === null ? name === "application_error" : statusCode >= 500;
}

// Resend reports every failure, including a network error, as `error` rather
// than throwing. A try that has not answered by the timeout is abandoned rather
// than aborted, since the typed send options take no abort signal; the shared
// idempotency key makes its late success harmless.
async function sendOnce(
  resend: Resend,
  message: OutboundEmail & { from: string },
  idempotencyKey: string
): Promise<SendError | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<SendError>((resolve) => {
    timer = setTimeout(
      () =>
        resolve({
          name: "timeout",
          message: `no reply within ${sendTimeoutMs} ms`,
          statusCode: null
        }),
      sendTimeoutMs
    );
  });

  try {
    return await Promise.race([
      resend.emails.send(message, { idempotencyKey }).then(({ error }) => error),
      timeout
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function sendVerificationEmail(env: Bindings, to: string, url: string) {
  const safeUrl = escapeHtml(url);
  await sendEmail(env, {
    to,
    subject: "Verify your email — VMB",
    html: emailLayout(
      "Verify your VMB email address.",
      "Verify your email address",
      `<p style="margin:0 0 24px;font-size:16px;line-height:1.6">Confirm your email address to finish setting up your VMB access.</p>
       <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${emailColors.primary};border-radius:8px">
         <a href="${safeUrl}" style="display:inline-block;padding:14px 22px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">Verify email address</a>
       </td></tr></table>
       <p style="margin:24px 0 8px;color:${emailColors.mutedForeground};font-size:13px;line-height:1.6">If the button does not work, copy this link into your browser:</p>
       <p style="margin:0;overflow-wrap:anywhere;font-size:13px;line-height:1.6"><a href="${safeUrl}" style="color:${emailColors.primary}">${safeUrl}</a></p>`
    )
  });
}

// The activation code (ADR-0033): a migrated user proves they own this inbox,
// then sets the password that replaces the legacy one. The announcement copy
// lives here because this is the first email most users get from the new
// platform.
export async function sendOtpEmail(env: Bindings, to: string, otp: string) {
  await sendEmail(env, {
    to,
    subject: "Your VMB password code",
    html: emailLayout(
      "Your code to set a VMB password. It expires in 5 minutes.",
      "Set your password",
      `<p style="margin:0 0 20px;font-size:16px;line-height:1.6">Use this code to set your password, whether this is your first time or you need to reset your password.</p>
       <p style="margin:0 0 20px;padding:16px;background:${emailColors.muted};border:1px solid ${emailColors.border};border-radius:8px;color:${emailColors.foreground};font-size:30px;font-weight:700;letter-spacing:6px;text-align:center">${escapeHtml(otp)}</p>
       <p style="margin:0;color:${emailColors.mutedForeground};font-size:14px;line-height:1.6">This code expires in 5 minutes.</p>`
    )
  });
}
