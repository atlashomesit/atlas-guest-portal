// Hardening for BUG-ONBOARD-1 (incident 2026-05-02). See atlas-e2e/docs/incidents/2026-05-02-property-registration-failure.md

/**
 * Builds a user-visible message from an API error response (ASP.NET ProblemDetails / ModelState).
 * Uses `res.clone()` so callers can still read the body from `res` if needed.
 */
export async function messageFromApiResponse(res: Response): Promise<string> {
  const raw = (await res.clone().text()).trim();
  let body: Record<string, unknown> | null = null;
  if (raw) {
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      body = null;
    }
  }

  const fieldErrors =
    body?.errors && typeof body.errors === "object"
      ? Object.values(body.errors as Record<string, unknown[]>)
          .flat()
          .map((v) => (typeof v === "string" ? v : v != null ? String(v) : ""))
          .filter(Boolean)
          .join(" ")
      : "";

  const serverMsg =
    (typeof body?.message === "string" && body.message.trim()) ||
    (typeof body?.error === "string" && body.error.trim()) ||
    (fieldErrors && fieldErrors.trim()) ||
    (typeof body?.title === "string" && body.title.trim()) ||
    "";

  if (serverMsg) return serverMsg;
  if (raw) return raw.length > 500 ? `${raw.slice(0, 500)}…` : raw;

  const fallback =
    res.status >= 500
      // eslint-disable-next-line atlas-brand/no-atlas-string-leak -- TODO Task 16: per-tenant support email
      ? `Our servers hit an unexpected error (${res.status}). Try again or contact support@atlashomestays.com.`
      : `Request failed (HTTP ${res.status}). Please check your input and try again.`;
  return fallback;
}
