/**
 * TASK-4905: minimal in-isolate TTL cache for the tenant-site-meta Pages Function lookup
 * (ADR-0018 2026-07-16 amendment: "cache the per-host lookup for a short TTL, e.g. 5 minutes, to
 * avoid an API round-trip on every social-crawler hit"). A plain module-scope `Map` — Cloudflare
 * Pages Functions isolates are reused across requests best-effort, so this is a "nice to have"
 * hit-rate optimization, not a correctness guarantee (a cold/recycled isolate just re-fetches,
 * same as a cache miss). No Cloudflare-specific API (Cache/KV) — kept dependency-free and
 * trivially unit-testable under plain Node/vitest.
 *
 * TASK-7207: `maxEntries` caps isolate memory against a spoofed-host flood.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(ttlMs: number, maxEntries = 256) {
    this.ttlMs = ttlMs;
    this.maxEntries = Math.max(1, maxEntries);
  }

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
    if (!this.store.has(key) && this.store.size >= this.maxEntries) {
      for (const [k, entry] of this.store) {
        if (entry.expiresAt <= now) this.store.delete(k);
      }
      while (this.store.size >= this.maxEntries) {
        const oldest = this.store.keys().next().value;
        if (oldest === undefined) break;
        this.store.delete(oldest);
      }
    }
    this.store.set(key, { value, expiresAt: now + this.ttlMs });
  }

  /** Test-only: number of live (non-expired-check) entries currently stored. */
  size(): number {
    return this.store.size;
  }

  /** Test-only: drop every entry (module-scope caches outlive test files under isolate:false). */
  clear(): void {
    this.store.clear();
  }
}
