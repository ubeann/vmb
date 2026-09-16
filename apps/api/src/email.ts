import { Resend } from "resend";
import type { Bindings } from "./bindings.js";

export async function sendVerificationEmail(env: Bindings, to: string, url: string) {
  const resend = new Resend(env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: "Verify your email — VMB",
    html: `<p>Click the link below to verify your email address:</p><p><a href="${url}">${url}</a></p>`
  });

  if (error) {
    console.error("sendVerificationEmail: Resend request failed", error);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
}
