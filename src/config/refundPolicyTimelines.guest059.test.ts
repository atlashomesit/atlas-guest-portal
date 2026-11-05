/** GUEST-059: every surface that carries the refund wording says who approves refunds (the host). */
import { describe, it, expect } from 'vitest';
import {
  REFUND_APPROVER_SENTENCE,
  REFUND_POLICY_TIMELINE_SENTENCE,
  REFUND_INITIATED_STEP_DESC,
} from './refundPolicyTimelines';
import { policySections } from '@/content/legal/policies';
import { termsSections } from '@/content/legal/terms';
import { faqItems } from '@/content/legal/faqs';
import { withRatePlanCancellation } from '@/utils/cancellationPolicy';

describe('GUEST-059 no refund line says anyone but the host approves', () => {
  it('the shared wording never gives approval to Atlas or our team, and keeps the 24-hour start', async () => {
    const all = await import('./refundPolicyTimelines');
    const lines = Object.values(all).filter((v): v is string => typeof v === 'string');
    for (const line of lines) {
      expect(line).not.toMatch(/Atlas approves|we approve|our team/i);
      expect(line).not.toMatch(/We'll review and approve/i);
    }
    expect(all.REFUND_INITIATED_STEP_DESC).toContain('within 24 hours');
    expect(all.REFUND_POLICY_TIMELINE_SENTENCE).toContain('within 24 hours');
    expect(all.REFUND_CANCELLATION_REQUEST_DISCLOSURE).toMatch(/your host will review it/i);
    expect(all.REFUND_CANCELLATION_RECEIVED_MESSAGE).toMatch(/your host will review it/i);
  });
});

describe('GUEST-059 refunds are approved by the host', () => {
  it('the shared sentence is plain', () => {
    expect(REFUND_APPROVER_SENTENCE).toBe('Refunds are approved by your host.');
  });
  it('listing cancel block, policies and FAQ carry it', () => {
    expect(REFUND_INITIATED_STEP_DESC).toContain(REFUND_APPROVER_SENTENCE);
    expect(REFUND_POLICY_TIMELINE_SENTENCE).toContain(REFUND_APPROVER_SENTENCE);
    const policy = policySections.find((s) => s.id === 'cancellation-refunds')!;
    expect(policy.details.join(' ')).toContain(REFUND_APPROVER_SENTENCE);
    expect(JSON.stringify(faqItems)).toContain(REFUND_APPROVER_SENTENCE);
  });
  it('terms carry it', () => {
    const t = termsSections.find((s) => s.id === 'cancellations-refunds')!;
    expect(t.body.join(' ')).toContain(REFUND_APPROVER_SENTENCE);
  });
  it('a refundable rate plan override keeps the sentence through the steps', () => {
    const base = { headline: 'h', description: 'd', steps: [{ title: 'x', desc: REFUND_INITIATED_STEP_DESC }] };
    const out = withRatePlanCancellation(base, { headline: 'Full refund 3 days', nonRefundable: false }, true);
    expect(JSON.stringify(out.steps)).toContain(REFUND_APPROVER_SENTENCE);
  });
});
