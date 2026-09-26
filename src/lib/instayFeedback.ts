/**
 * TASK-102207 — Day-2 in-stay NPS pulse check.
 */

export interface StayPulse {
  shouldPrompt: boolean;
  needsRecovery: boolean;
}

export function stayDayNumber(checkInIso: string, todayIso: string): number {
  const ms = new Date(`${todayIso}T00:00:00Z`).getTime() - new Date(`${checkInIso}T00:00:00Z`).getTime();
  return Math.floor(ms / 86_400_000) + 1;
}

export function shouldShowStayPulse(checkInIso: string, todayIso: string, alreadyAnswered: boolean): boolean {
  if (alreadyAnswered) return false;
  return stayDayNumber(checkInIso, todayIso) === 2;
}

export function evaluateStayPulse(rating1to5: number): Pick<StayPulse, 'needsRecovery'> {
  return { needsRecovery: rating1to5 <= 3 };
}

// Board marker(s) added by 44abb75b; kept so anything reading them still resolves.
export const TASK_102207 = true;
