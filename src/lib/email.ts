import { env, isEmailConfigured } from "@/lib/env";

/**
 * Transactional email via Resend. When email isn't configured (no RESEND_API_KEY /
 * EMAIL_FROM) we don't throw — in dev we log the link to the server console so
 * magic-link sign-in is still testable locally. Resend is imported dynamically so the
 * dependency never loads on the guest/static path.
 */

export async function sendMagicLinkEmail(to: string, url: string): Promise<void> {
  if (!isEmailConfigured()) {
    console.info(`[klab] magic link for ${to} (email not configured): ${url}`);
    return;
  }
  const { Resend } = await import("resend");
  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({
    from: env.EMAIL_FROM!,
    to,
    subject: "Your klab sign-in link",
    text: `Sign in to klab:\n\n${url}\n\nThis link expires shortly. If you didn't request it, ignore this email.`,
  });
}

export async function sendVerificationEmail(to: string, url: string): Promise<void> {
  if (!isEmailConfigured()) {
    console.info(`[klab] verification link for ${to} (email not configured): ${url}`);
    return;
  }
  const { Resend } = await import("resend");
  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({
    from: env.EMAIL_FROM!,
    to,
    subject: "Verify your klab email",
    text: `Confirm your email for klab:\n\n${url}`,
  });
}
