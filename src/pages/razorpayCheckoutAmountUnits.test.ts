import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Cross-file source ratchet: EVERY file that constructs a Razorpay checkout must
 * feed it PAISE, converted through `razorpayOrderAmountInrToPaise`.
 *
 * Why this exists as a SEPARATE, file-agnostic ratchet:
 *
 *   `src/pages/booking/razorpayAmountUnits.test.ts` pins the same property, but it
 *   opens exactly one hard-coded path — `readFileSync(resolve(__dirname,
 *   './GuestDetailsPage.tsx'))`. That made it blind by construction to any NEW
 *   checkout call site, and on 2026-09-03 one arrived: `src/pages/EmbedPage.tsx`
 *   (TASK-8093, the embeddable booking widget) passed the order response's RUPEE
 *   `amount` straight into `new window.Razorpay({ amount })`. That is the exact
 *   defect TASK-5362 fixed on 2026-08-29 — reintroduced five days later, in a
 *   second file, past a green ratchet.
 *
 * So this test does not name any file. It DISCOVERS the call sites and holds each
 * one to the boundary rule, which is what makes it able to fail for a third one.
 *
 * Construction discovery (TASK-101132): regex is `new\s+(?:window\.)?[A-Za-z_$][\w$]*\s*\(`
 * so alias forms like `new razorpay(` are not invisible; results are filtered to
 * files that mention Razorpay and whose matched constructor is Razorpay/razorpay.
 *
 * See `src/utils/razorpayOrderAmount.ts` for the unit contract itself:
 * `POST /api/Razorpay/order` returns `amount` in RUPEES while the Razorpay order
 * it created is denominated in PAISE.
 */

const SRC_ROOT = resolve(__dirname, '..');
/** Wide enough for `new window.Razorpay(` and alias forms like `new razorpay(`. */
const CHECKOUT_CONSTRUCTION = /new\s+(?:window\.)?[A-Za-z_$][\w$]*\s*\(/;
const CHECKOUT_CONSTRUCTOR_NAME = /new\s+(?:window\.)?([A-Za-z_$][\w$]*)\s*\(/g;

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    if (/\.test\.tsx?$/.test(entry)) continue;
    out.push(full);
  }
  return out;
}

function isRazorpayCheckoutCallSite(content: string): boolean {
  // TASK-101132: widen construction regex, then keep only Razorpay-mentioning
  // files whose matched constructor is Razorpay/razorpay (direct or alias).
  if (!/Razorpay/i.test(content)) return false;
  if (!CHECKOUT_CONSTRUCTION.test(content)) return false;
  for (const match of content.matchAll(CHECKOUT_CONSTRUCTOR_NAME)) {
    if (/razorpay/i.test(match[1])) return true;
  }
  return false;
}

const checkoutCallSites = collectSourceFiles(SRC_ROOT)
  .map((path) => ({ path, content: readFileSync(path, 'utf-8') }))
  .filter(({ content }) => isRazorpayCheckoutCallSite(content));

describe('Razorpay checkout amount unit boundary — every call site', () => {
  it('finds at least one checkout call site (guards against the regex silently matching nothing)', () => {
    // If this ever hits zero the suite would pass vacuously, which is the failure
    // mode that let the single-file ratchet look healthy while a second call site
    // shipped the bug.
    expect(checkoutCallSites.length).toBeGreaterThan(0);
  });

  it.each(checkoutCallSites.map(({ path }) => relative(SRC_ROOT, path)))(
    '%s converts the API rupee amount to paise before opening Razorpay',
    (relPath) => {
      const site = checkoutCallSites.find((c) => relative(SRC_ROOT, c.path) === relPath);
      const content = site!.content;

      expect(
        content,
        `${relPath} constructs a Razorpay checkout but never imports razorpayOrderAmountInrToPaise. ` +
          'The order response `amount` is RUPEES; Razorpay checkout options are PAISE.',
      ).toContain("from '@/utils/razorpayOrderAmount'");

      expect(
        content,
        `${relPath} constructs a Razorpay checkout but never calls razorpayOrderAmountInrToPaise.`,
      ).toMatch(/razorpayOrderAmountInrToPaise\(/);

      // The raw response field must never reach the checkout options directly.
      expect(
        content,
        `${relPath} passes a raw \`amount\` into the Razorpay checkout options. ` +
          'Pass the converted paise value instead.',
      ).not.toMatch(/amount:\s*(?:order|resp|response)\.amount\b/);
    },
  );
});
