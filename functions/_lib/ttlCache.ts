/**
 * TASK-4905: minimal in-isolate TTL cache for the tenant-site-meta Pages Function lookup
 * (ADR-0018 2026-07-16 amendment: "cache the per-host lookup for a short TTL, e.g. 5 minutes, to
 * avoid an API round-trip on every social-crawler hit"). A plain module-scope `Map` — Cloudflare
 * Pages Functions isolates are reused across requests best-effort, so this is a "nice to have"
 * hit-rate optimization, not a correctness guarantee (a cold/recycled isolate just re-fetches,
 * same as a cache miss). No Cloudflare-specific API (Cache/KV) — kept dependency-free and
 * trivially unit-testable under plain Node/vitest.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string, now: number = Date.now()): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, now: number = Date.now()): void {
    this.store.set(key, { value, expiresAt: now + this.ttlMs });
  }

  /** Test-only: number of live (non-expired-check) entries currently stored. */
  size(): number {
    return this.store.size;
  }
}
