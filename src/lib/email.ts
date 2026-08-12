import { BRAND } from "@/config/brand";
import { env, isEmailConfigured } from "@/lib/env";

/**
 * Transactional auth email via Resend. Email endpoints are only registered when the
 * provider is configured; these helpers still fail closed so sensitive links never
 * fall back to server logs.
 */

async function sendAuthEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error("Transactional email is not configured.");
  }
  const { Resend } = await import("resend");
  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: env.EMAIL_FROM!, to, subject, text });
  if (error) throw new Error(`Resend rejected the authentication email: ${error.message}`);
}

export async function sendMagicLinkEmail(to: string, url: string): Promise<void> {
  await sendAuthEmail({
    to,
    subject: `Your ${BRAND.name} sign-in link`,
    text: `Sign in to ${BRAND.name}:\n\n${url}\n\nThis link expires shortly. If you didn't request it, ignore this email.`,
  });
}

export async function sendVerificationEmail(to: string, url: string): Promise<void> {
  await sendAuthEmail({
    to,
    subject: `Verify your ${BRAND.name} email`,
    text: `Confirm your email for ${BRAND.name}:\n\n${url}\n\nIf you didn't create this account, ignore this email.`,
  });
}

export async function sendAccountDeletionEmail(to: string, url: string): Promise<void> {
  await sendAuthEmail({
    to,
    subject: `Confirm your ${BRAND.name} account deletion`,
    text: `Permanently delete your ${BRAND.name} account and synced progress:\n\n${url}\n\nIf you didn't request this, keep your account by ignoring this email.`,
  });
}
