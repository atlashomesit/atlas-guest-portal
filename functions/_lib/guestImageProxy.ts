/**
 * TASK-7821 — allowlist + clamp helpers for the `/img` transform proxy.
 * Kept free of Workers runtime APIs so vitest can cover the security gates.
 */

export const ALLOWED_BLOB_HOSTS = new Set(["atlashomestorage.blob.core.windows.net"]);

export const MIN_TRANSFORM_WIDTH = 160;
export const MAX_TRANSFORM_WIDTH = 1600;
export const DEFAULT_TRANSFORM_WIDTH = 768;

export function isAllowedBlobImageUrl(raw: string): boolean {
  const t = (raw ?? "").trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:") return false;
    if (!ALLOWED_BLOB_HOSTS.has(u.hostname.toLowerCase())) return false;
    if (u.username || u.password) return false;
    return true;
  } catch {
    return false;
  }
}

export function clampTransformWidth(raw: string | null | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TRANSFORM_WIDTH;
  return Math.min(MAX_TRANSFORM_WIDTH, Math.max(MIN_TRANSFORM_WIDTH, Math.round(n)));
}
