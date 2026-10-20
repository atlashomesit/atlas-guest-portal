/**
 * Founder ruling 2026-10-19: the host's own house rules are shown on the details step and the guest must tick
 * "I accept the house rules" before Pay — only when the host actually wrote rules.
 *
 * Structured rules shape (atlas-api Listing.HouseRulesStructured):
 *   {"smoking":false,"pets":false,"parties":false,"kidsWelcome":true,"quietHoursStart":"22:00","quietHoursEnd":"08:00"}
 */

export interface HouseRuleChip {
  /** Stable key for tests and React lists. */
  key: string;
  /** Guest-facing words, e.g. "No smoking". */
  label: string;
  /** `no` rules are shown as restrictions, `ok` rules as allowances. */
  tone: 'no' | 'ok' | 'info';
}

function asBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  return null;
}

function asClock(v: unknown): string | null {
  return typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v.trim()) ? v.trim() : null;
}

/** Turns the structured-rules JSON into plain-language chips. Malformed or empty input yields no chips. */
export function parseStructuredHouseRules(json: string | null | undefined): HouseRuleChip[] {
  if (!json || !json.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
  const o = parsed as Record<string, unknown>;
  const chips: HouseRuleChip[] = [];

  const smoking = asBool(o.smoking);
  if (smoking !== null) chips.push({ key: 'smoking', label: smoking ? 'Smoking allowed' : 'No smoking', tone: smoking ? 'ok' : 'no' });

  const pets = asBool(o.pets);
  if (pets !== null) chips.push({ key: 'pets', label: pets ? 'Pets allowed' : 'No pets', tone: pets ? 'ok' : 'no' });

  const parties = asBool(o.parties);
  if (parties !== null) chips.push({ key: 'parties', label: parties ? 'Parties allowed' : 'No parties or events', tone: parties ? 'ok' : 'no' });

  const kids = asBool(o.kidsWelcome);
  if (kids !== null) chips.push({ key: 'kids', label: kids ? 'Kids welcome' : 'Not suitable for children', tone: kids ? 'ok' : 'no' });

  const quietStart = asClock(o.quietHoursStart);
  const quietEnd = asClock(o.quietHoursEnd);
  if (quietStart && quietEnd) {
    chips.push({ key: 'quiet', label: `Quiet hours ${quietStart} to ${quietEnd}`, tone: 'info' });
  }

  return chips;
}
