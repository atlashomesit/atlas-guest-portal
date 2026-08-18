/**
 * TASK-8055 / TASK-7801 pattern: any module that asserts a payment-processing fee must consult
 * `hasOnlinePaymentRail` (or `directBookingPriceClaim`, which does). Grep-for-the-helper is not
 * enough — this pins the call sites that make the claim.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = join(__dirname, '..');
const FEE_ASSERTION = /3%\s+(?:Razorpay\s+)?payment-processing fee/i;
const GATE_IMPORT = /from ['"][^'"]*tenant\/paymentRail['"]/;
const GATE_USE = /hasOnlinePaymentRail\s*\(|directBookingPriceClaim\s*\(/;

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'coverage') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkTsFiles(full, out);
      continue;
    }
    if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\.(tsx?|jsx?)$/.test(name) && !/\.spec\.(tsx?|jsx?)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe('TASK-8055: payment-processing fee call-site parity', () => {
  it('every fee-asserting module imports and consults the payment-rail helper', () => {
    const offenders: string[] = [];
    for (const file of walkTsFiles(SRC_ROOT)) {
      const content = readFileSync(file, 'utf8');
      if (!FEE_ASSERTION.test(content)) continue;
      // The helper module defines the shared claim string — it is the gate, not a call site.
      if (file.replace(/\\/g, '/').endsWith('/tenant/paymentRail.ts')) continue;
      const ok = GATE_IMPORT.test(content) && GATE_USE.test(content);
      if (!ok) offenders.push(relative(SRC_ROOT, file).replace(/\\/g, '/'));
    }
    expect(offenders).toEqual([]);
  });
});
