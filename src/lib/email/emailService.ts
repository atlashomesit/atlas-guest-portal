/**
 * Email service used by Cloudflare Pages Functions (contact form, health/email).
 * Provides sendEmail for contact API and getEmailHealthSnapshot/sendEmailCanary for health checks.
 * In Workers/Pages context, implement via fetch to your email provider or bindings.
 */

export type SendEmailPayload = {
  user_name: string;
  user_email: string;
  user_contactnumber: string;
  destination: string;
  message: string;
  to_email?: string;
};

export type SendEmailResult = {
  provider: string;
  simulated?: boolean;
  providerHealth?: unknown;
};

/**
 * Send contact form email. Stub implementation for Functions build.
 * Wire to EmailJS or your provider via env bindings in the Function handler.
 */
export async function sendEmail(_payload: SendEmailPayload): Promise<SendEmailResult> {
  return { provider: "stub", simulated: true };
}

export type EmailHealthProvider = { healthy: boolean; [key: string]: unknown };

/**
 * Return current email provider health. Used by /api/health/email.
 */
export async function getEmailHealthSnapshot(): Promise<EmailHealthProvider[]> {
  return [{ healthy: true }];
}

/**
 * Optional canary send for health checks.
 */
export async function sendEmailCanary(): Promise<void> {
  // no-op stub
}
