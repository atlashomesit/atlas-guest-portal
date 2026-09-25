/**
 * TASK-102419 — custom-domain SSL renewal health check (frontend half).
 *
 * Board defect: Let's Encrypt ACME renewal cron fails silently on DNS-challenge errors,
 * so guests hit "Your connection is not private" with no ops alert.
 *
 * Scope note: the ACME cron itself and DevOps alerting live outside this repo
 * (hosting/Cloudflare + atlas-api ops). This module gives the guest portal a typed
 * renewal-health model it can render (tenant admin banner) and unit-test, fed by a
 * lightweight backend/status endpoint when available. Nothing here performs renewal.
 */

export const SSL_EXPIRY_WARN_DAYS = 14;
export const SSL_EXPIRY_URGENT_DAYS = 3;

export type SslRenewalStatus = 'healthy' | 'warning' | 'urgent' | 'expired' | 'unknown';

export function daysUntilExpiry(expiryUtc: string | Date | null | undefined, now = new Date()): number | null {
  if (!expiryUtc) return null;
  const expiry = expiryUtc instanceof Date ? expiryUtc : new Date(expiryUtc);
  if (Number.isNaN(expiry.getTime())) return null;
  return Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function sslRenewalStatus(
  expiryUtc: string | Date | null | undefined,
  renewalFailed: boolean,
  now = new Date(),
): SslRenewalStatus {
  const days = daysUntilExpiry(expiryUtc, now);
  if (days == null) return renewalFailed ? 'urgent' : 'unknown';
  if (days < 0) return 'expired';
  if (renewalFailed || days <= SSL_EXPIRY_URGENT_DAYS) return 'urgent';
  if (days <= SSL_EXPIRY_WARN_DAYS) return 'warning';
  return 'healthy';
}

export function sslAlertCopy(status: SslRenewalStatus, hostname: string): string | null {
  switch (status) {
    case 'urgent':
      return `SSL renewal needs attention for ${hostname} — guests may soon see a browser privacy warning.`;
    case 'warning':
      return `SSL certificate for ${hostname} expires within ${SSL_EXPIRY_WARN_DAYS} days. Verify auto-renewal.`;
    case 'expired':
      return `SSL certificate for ${hostname} has expired. Guests see a privacy warning until renewal succeeds.`;
    default:
      return null;
  }
}
