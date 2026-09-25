/**
 * TASK-102259 — Direct Portal SSL/DNS guide
 * Provides DNS propagation checklist and copyable CNAME records.
 */
export type DnsCheck = { record: string; expected: string; ok: boolean };

export function dnsPropagationChecklist(hostname: string, cnameTarget: string): DnsCheck[] {
  return [
    { record: `CNAME ${hostname}`, expected: cnameTarget, ok: false },
    { record: `A ${hostname}`, expected: '76.76.21.21', ok: false },
    { record: `SSL ${hostname}`, expected: 'valid', ok: false },
  ];
}

export function cnameRecordForHostname(hostname: string, target: string): string {
  return `${hostname} CNAME ${target}`;
}

export function dnsGuideForProvider(provider: 'godaddy' | 'cloudflare', hostname: string, target: string): string {
  if (provider === 'cloudflare') return `Cloudflare: Add CNAME ${hostname} -> ${target} (proxied)`;
  return `GoDaddy: Add CNAME ${hostname} -> ${target}`;
}
