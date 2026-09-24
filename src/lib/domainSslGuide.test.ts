import { describe, it, expect } from 'vitest';
import { buildCnameRecord, dnsChecklistSummary, dnsTroubleshooting } from './domainSslGuide';

describe('TASK-102259 domain & SSL status card', () => {
  it('generates a copyable CNAME record', () => {
    expect(buildCnameRecord('stays.royaloakvillas.com', 'sites.atlashomestays.com')).toEqual({
      type: 'CNAME', host: 'stays.royaloakvillas.com', value: 'sites.atlashomestays.com',
    });
  });

  it('summarizes the propagation checklist', () => {
    const s = dnsChecklistSummary([
      { kind: 'CNAME', passed: true, detail: 'ok' },
      { kind: 'A Record', passed: true, detail: 'ok' },
      { kind: 'SSL Handshake', passed: false, detail: 'pending' },
    ]);
    expect(s).toEqual({ passed: 2, total: 3, allGreen: false });
  });

  it('provides per-check troubleshooting guidance', () => {
    expect(dnsTroubleshooting('CNAME')).toContain('CNAME record');
    expect(dnsTroubleshooting('SSL Handshake')).toContain('24h');
  });
});
