/**
 * TASK-102262 — Honest social-proof urgency badges.
 */

export interface UrgencyInput {
  recentViewers: number;
  unitsRemaining: number;
}

export type UrgencyBadgeKind = 'demand' | 'scarcity';

export const MIN_VIEWERS_FOR_DEMAND_BADGE = 3;
export const MAX_UNITS_FOR_SCARCITY_BADGE = 2;

export interface UrgencyBadge {
  kind: UrgencyBadgeKind;
  text: string;
}

export function urgencyBadges(input: UrgencyInput): UrgencyBadge[] {
  const out: UrgencyBadge[] = [];
  const viewers = Math.max(0, Math.floor(input.recentViewers));
  const remaining = Math.max(0, Math.floor(input.unitsRemaining));
  if (viewers >= MIN_VIEWERS_FOR_DEMAND_BADGE) {
    out.push({ kind: 'demand', text: `High demand — ${viewers} guests looking at these dates` });
  }
  if (remaining >= 1 && remaining <= MAX_UNITS_FOR_SCARCITY_BADGE) {
    out.push({
      kind: 'scarcity',
      text: remaining === 1 ? 'Only 1 villa remaining for these dates' : `Only ${remaining} villas remaining for these dates`,
    });
  }
  return out;
}
