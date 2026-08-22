/**
 * TASK-7819 — the pre-booking cancellation copy must never promise a refund outcome the
 * server's engine does not implement.
 *
 * Founder ruling 2026-08-11: the ENGINE is correct; the COPY was wrong. So this suite pins
 * the copy to the founder-approved fee table (`LATE_CANCELLATION_FEE_PERCENT`, mirroring
 * `atlas-api/Atlas.Api/appsettings.json` `Booking:LateCancellationFeePercent`) and to the
 * server's null-tier behaviour in `CancellationRefundCalculator.Compute`:
 *
 *   - `tierName = (tier ?? CancellationTier.Flexible)`  → an untiered listing IS Flexible
 *   - `if (feePct <= 0m) return full refund`            → Flexible (fee 0) refunds 100%, always
 *
 * The defect this suite exists to prevent: `inlinePolicySnippets.cancellation` hardcoded
 * "No refunds for no-shows or cancellations within 7 days of check-in" and was injected into
 * the property-detail render chain as `fallbackText`, which returns BEFORE the tier branch —
 * so every untiered listing told the guest they get nothing while the engine paid everything.
 *
 * Both property-detail implementations (classic + the heritage theme fork) must render from
 * `describeCancellationPolicy`, so the fixture below is deliberately shared: a future theme
 * fork that re-types literals fails here instead of silently inheriting stale copy.
 */
import { describe, it, expect } from 'vitest';
import {
  describeCancellationPolicy,
  resolveEffectiveCancellationTier,
  LATE_CANCELLATION_FEE_PERCENT,
  type CancellationTier,
} from './cancellationPolicy';
import { inlinePolicySnippets, termsSections } from '../content/terms';

/** One fixture, driving both the copy and the fee table — the pairing TASK-7432 asked for. */
const TIER_FIXTURE: Array<{ tier: CancellationTier | null; feePercent: number }> = [
  { tier: 'Flexible', feePercent: 0 },
  { tier: 'Moderate', feePercent: 50 },
  { tier: 'Strict', feePercent: 100 },
  // The untiered case: the server resolves null → Flexible, so the copy must too.
  { tier: null, feePercent: 0 },
];

/** Phrases that assert the guest receives NOTHING. */
const DENIES_REFUND = /no refunds?\b|you get nothing|non-refundable/i;
/** Phrases that assert a discretionary, non-monetary remedy. */
const CLAIMS_DISCRETIONARY_CREDIT = /credit .*(discretion|future booking)|at our discretion/i;

describe('TASK-7819 — cancellation copy agrees with the refund engine', () => {
  describe.each(TIER_FIXTURE)('tier=$tier (fee $feePercent%)', ({ tier, feePercent }) => {
    it('fee table matches the founder-approved percentages', () => {
      const effective = resolveEffectiveCancellationTier(tier);
      expect(LATE_CANCELLATION_FEE_PERCENT[effective]).toBe(feePercent);
    });

    it('never denies a refund when the engine charges no fee', () => {
      const { headline, afterWindowCopy } = describeCancellationPolicy(tier);
      const copy = `${headline} ${afterWindowCopy}`.trim();

      if (feePercent === 0) {
        // Engine pays 100% at any time — copy must not gate or deny it.
        expect(copy).not.toMatch(DENIES_REFUND);
        expect(afterWindowCopy).toBe('');
        expect(headline).toMatch(/full refund/i);
      } else {
        // A real fee exists, so the copy is allowed (and expected) to state the limit.
        expect(headline).toMatch(/full refund/i);
        expect(afterWindowCopy).not.toBe('');
      }
    });

    it('states the actual retained percentage when a partial fee applies', () => {
      const { afterWindowCopy } = describeCancellationPolicy(tier);
      if (feePercent > 0 && feePercent < 100) {
        const refundPct = 100 - feePercent;
        expect(afterWindowCopy).toContain(`${refundPct}%`);
      }
    });
  });

  it('an untiered listing reads exactly as Flexible — the server resolves null to Flexible', () => {
    expect(describeCancellationPolicy(null)).toEqual(describeCancellationPolicy('Flexible'));
    expect(describeCancellationPolicy(undefined)).toEqual(describeCancellationPolicy('Flexible'));
    expect(describeCancellationPolicy('not-a-tier')).toEqual(describeCancellationPolicy('Flexible'));
  });

  it('the inline listing-page snippet asserts no refund outcome at all', () => {
    const snippet = inlinePolicySnippets.cancellation;
    expect(snippet).not.toMatch(DENIES_REFUND);
    expect(snippet).not.toMatch(CLAIMS_DISCRETIONARY_CREDIT);
    // Done-when #2: no numeric refund/window claim may be re-typed here.
    expect(snippet).not.toMatch(/\d+\s*%/);
    expect(snippet).not.toMatch(/\d+\s*(day|hour)/i);
  });

  it('the Terms & Conditions cancellation section does not contradict the engine', () => {
    const section = termsSections.find((s) => s.id === 'cancellations');
    expect(section, 'terms.ts must keep a "cancellations" section').toBeTruthy();
    const prose = (section!.paragraphs ?? []).join(' ');
    expect(prose).not.toMatch(DENIES_REFUND);
    expect(prose).not.toMatch(CLAIMS_DISCRETIONARY_CREDIT);
  });

  it('no tier refund percentage is re-typed outside cancellationPolicy.ts', () => {
    // Guards the heritage-fork class of defect: literals drifting from the single source.
    const snippet = inlinePolicySnippets.cancellation;
    for (const pct of Object.values(LATE_CANCELLATION_FEE_PERCENT)) {
      if (pct > 0) expect(snippet).not.toContain(`${pct}%`);
    }
  });
});

/** Phrases that invent refund arithmetic the engine does not implement (TASK-8020). */
const CLAIMS_PRORATION =
  /pro-?rated|nights already stayed|used nights after check-in|per-?night refund/i;

describe('TASK-8020 — FAQ refund copy agrees with the refund engine', () => {
  it('faqHighlights.ts source never claims pro-rating or post-check-in refund arithmetic', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '../content/faqHighlights.ts'), 'utf8');
    expect(src).not.toMatch(CLAIMS_PRORATION);
  });

  it('faq.tsx source never claims pro-rating or nights-stayed refund arithmetic', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '../content/faq.tsx'), 'utf8');
    expect(src).not.toMatch(CLAIMS_PRORATION);
  });

  it('buildRetailFaqSections refund answers defer to listing policy without invented arithmetic', async () => {
    const { buildRetailFaqSections } = await import('../content/faq');
    const sections = buildRetailFaqSections('Atlas');
    const partial = sections.flatMap((s) => s.items).find((i) => i.id === 'partial-refunds');
    expect(partial).toBeTruthy();
    expect(partial!.question).toMatch(/partial refund/i);
    expect((partial!.tags ?? []).join(' ')).not.toMatch(/pro-rated/i);
  });
});
