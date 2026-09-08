import { trackEvent } from "../../utils/analytics";
import { buildApiUrl, getApiHeaders } from "../../api/client";

export type CallbackRequestPayload = {
  phone: string;
  name?: string;
  note?: string;
  route?: string;
  listingId?: string | null;
  unitCode?: string | null;
  source?: string;
};

/**
 * TASK-101600: localStorage fallback key, per atlas-guest-portal/docs/callback-leads.md.
 * Populated when the network request fails or `fetch` is unavailable so operators can diagnose
 * issues and the caller is informed the request did not go through (the caller here is
 * `SupportWidget.tsx`'s existing try/catch around `submitCallbackRequest` — throwing on fallback
 * routes into its "error" UI state instead of the misleading "sent" state).
 */
const BACKLOG_KEY = "callback_leads_backlog";
const BACKLOG_MAX_ENTRIES = 25;

function appendToBacklog(payload: CallbackRequestPayload): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const raw = window.localStorage.getItem(BACKLOG_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const existing = Array.isArray(parsed) ? parsed : [];
    const entry = { ...payload, queuedAt: new Date().toISOString() };
    const next = [...existing, entry].slice(-BACKLOG_MAX_ENTRIES);
    window.localStorage.setItem(BACKLOG_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable or full (private browsing, quota) — nothing more we can do
    // client-side; the request is still lost, but this must never throw over the real error.
  }
}

/**
 * TASK-101600: submit a guest "Request a callback" — support drawer form + chatbot inline
 * callback flow both call this. Posts to `POST /api/leads/callback` (contract:
 * atlas-guest-portal/docs/callback-leads.md). On a non-2xx response, a network error, or when
 * `fetch` is unavailable, the payload is appended to the `callback_leads_backlog` localStorage
 * key and the promise rejects so callers' existing failure handling (error toast/copy) fires.
 */
export async function submitCallbackRequest(payload: CallbackRequestPayload) {
  trackEvent(
    "callback_requested",
    {
      surface: payload.source ?? "support_launcher",
      includedNote: Boolean(payload.note?.trim()),
    },
    { route: payload.route, unitCode: payload.unitCode ?? undefined },
  );

  if (typeof fetch !== "function") {
    appendToBacklog(payload);
    throw new Error("callback_request_failed: fetch unavailable");
  }

  const body = {
    phone: payload.phone,
    route: payload.route,
    listingId: payload.listingId ?? payload.unitCode ?? undefined,
    unitCode: payload.unitCode ?? undefined,
    context: {
      source: payload.source ?? "support_launcher",
      note: payload.note,
      name: payload.name,
    },
  };

  let response: Response;
  try {
    response = await fetch(buildApiUrl("/api/leads/callback"), {
      method: "POST",
      headers: {
        ...getApiHeaders(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    // Network-level failure (offline, DNS, CORS, buildApiUrl misconfigured, etc.).
    appendToBacklog(payload);
    throw error instanceof Error ? error : new Error("callback_request_failed: network error");
  }

  if (!response.ok) {
    appendToBacklog(payload);
    throw new Error(`callback_request_failed: status ${response.status}`);
  }

  return { success: true } as const;
}
