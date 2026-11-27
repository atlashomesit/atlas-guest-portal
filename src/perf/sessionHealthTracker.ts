/**
 * PERF-062: Client-side crash-free guest session telemetry tracker per portal release.
 */

export interface SessionHealthSnapshot {
  releaseVersion: string;
  sessionId: string;
  crashFree: boolean;
  errorCount: number;
  lastErrorMessage?: string;
}

export class SessionHealthTracker {
  private errorCount = 0;
  private lastErrorMessage?: string;

  constructor(
    private readonly releaseVersion: string,
    private readonly sessionId: string
  ) {}

  recordUnhandledError(message: string): void {
    this.errorCount += 1;
    this.lastErrorMessage = message.slice(0, 200);
  }

  getSnapshot(): SessionHealthSnapshot {
    return {
      releaseVersion: this.releaseVersion,
      sessionId: this.sessionId,
      crashFree: this.errorCount === 0,
      errorCount: this.errorCount,
      lastErrorMessage: this.lastErrorMessage,
    };
  }
}

export function computeCrashFreeRatePct(snapshots: SessionHealthSnapshot[]): number {
  if (!snapshots.length) return 100;
  const clean = snapshots.filter((s) => s.crashFree).length;
  return Math.round((clean / snapshots.length) * 10000) / 100;
}
