/**
 * TASK-102199 — Smart lock PIN reveal countdown.
 *
 * Done-when:
 * 1. PIN card renders blurred placeholder with animated countdown until check-in time.
 * 2. Auto-unmasks PIN + 1-click copy affordance once check-in hour arrives.
 */

export type SmartLockState = 'locked' | 'revealed';

export interface SmartLockStatus {
  state: SmartLockState;
  secondsRemaining: number;
  copyEnabled: boolean;
}

export function getSmartLockStatus(checkInEpochMs: number, nowEpochMs: number): SmartLockStatus {
  const diffMs = checkInEpochMs - nowEpochMs;
  if (diffMs <= 0) {
    return { state: 'revealed', secondsRemaining: 0, copyEnabled: true };
  }
  return { state: 'locked', secondsRemaining: Math.ceil(diffMs / 1000), copyEnabled: false };
}

export function formatSmartLockCountdown(secondsRemaining: number): string {
  const s = Math.max(0, Math.floor(secondsRemaining));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function displaySmartLockPin(pin: string, status: SmartLockStatus): string {
  if (status.state === 'revealed') return pin;
  return '•'.repeat(Math.max(pin.length, 6));
}

// Board marker(s) added by 57608231; kept so anything reading them still resolves.
export const TASK_102199 = true;
