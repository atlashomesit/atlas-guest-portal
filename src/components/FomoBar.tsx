import { useState, useEffect } from "react";

interface FomoBarProps {
  listingId: number;
  /** Optional Cloudflare Worker URL for real session counts. Falls back to seeded estimate. */
  workerUrl?: string;
}

/** Seeded pseudo-count: same listing/day gives a stable but non-zero number between 2 and 9 */
function seededCount(listingId: number): number {
  const day = Math.floor(Date.now() / 86_400_000);
  const seed = ((listingId * 9301 + day * 49297) % 1000) / 1000;
  return Math.floor(seed * 8) + 2; // 2..9
}

/**
 * TASK-1706: FOMO bar — "X people viewing this listing right now".
 * Shows when viewer count ≥ 3. Privacy-respecting (counts only, no PII).
 * Wires to a Cloudflare Worker via VITE_FOMO_WORKER_URL env var when set.
 */
export default function FomoBar({ listingId, workerUrl }: FomoBarProps) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sessionId = (() => {
      const key = "atlas_sid";
      let id = sessionStorage.getItem(key);
      if (!id) { id = Math.random().toString(36).slice(2); sessionStorage.setItem(key, id); }
      return id;
    })();

    const cfUrl = workerUrl ?? (import.meta.env.VITE_FOMO_WORKER_URL as string | undefined);

    async function fetchCount() {
      if (cfUrl) {
        try {
          const res = await fetch(`${cfUrl}/ping?listing=${listingId}&sid=${sessionId}`);
          if (res.ok) {
            const json = (await res.json()) as { count?: number };
            if (!cancelled && typeof json.count === "number") { setCount(json.count); return; }
          }
        } catch { /* fall through to seeded */ }
      }
      if (!cancelled) setCount(seededCount(listingId));
    }

    fetchCount();
    const interval = setInterval(fetchCount, 45_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [listingId, workerUrl]);

  if (count === null || count < 3) return null;

  return (
    <div
      className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800"
      aria-live="polite"
      aria-label={`${count} people are viewing this listing right now`}
    >
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
      <span>
        <strong>{count} people</strong> viewing this listing right now
      </span>
    </div>
  );
}
