/**
 * TASK-102259 — Domain & SSL status card for tenant custom domains.
 */

export type DnsCheckKind = 'CNAME' | 'A Record' | 'SSL Handshake';

export interface DnsCheck {
  kind: DnsCheckKind;
  passed: boolean;
  detail: string;
}

export function buildCnameRecord(customHostname: string, target: string): { type: 'CNAME'; host: string; value: string } {
  return { type: 'CNAME', host: customHostname.trim(), value: target.trim() };
}

export function dnsChecklistSummary(checks: DnsCheck[]): { passed: number; total: number; allGreen: boolean } {
  const passed = checks.filter((c) => c.passed).length;
  return { passed, total: checks.length, allGreen: checks.length > 0 && passed === checks.length };
}

const TROUBLESHOOTING: Record<DnsCheckKind, string> = {
  CNAME: 'Add a CNAME record pointing your hostname to the value above (GoDaddy: DNS > Add; Cloudflare: DNS > Add record, proxy OFF until SSL issues).',
  'A Record': 'If your DNS host forbids CNAME on apex domains, use the A record shown by your hosting dashboard instead.',
  'SSL Handshake': 'SSL issues automatically after DNS propagates (up to 24h). Keep the hostname mapped and retry; do not delete the record while pending.',
};

export function dnsTroubleshooting(kind: DnsCheckKind): string {
  return TROUBLESHOOTING[kind];
}
