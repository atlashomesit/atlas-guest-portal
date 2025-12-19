type CallbackLeadIdentifiers = {
  listingId?: string | number;
  unitCode?: string | number;
  route?: string;
};

export type CallbackLeadPayload = CallbackLeadIdentifiers & {
  phone: string;
  context?: Record<string, unknown>;
};

export type CallbackLeadResponse<T = unknown> = {
  ok: boolean;
  storedLocally?: boolean;
  error?: unknown;
  data?: T;
};

const CALLBACK_LEADS_ENDPOINT = import.meta.env.VITE_CALLBACK_LEADS_ENDPOINT || "/api/leads/callback";
const CALLBACK_LEADS_BACKLOG_KEY = "callback_leads_backlog";
const MAX_BACKLOG_ENTRIES = 25;

const readLocalBacklog = (): CallbackLeadPayload[] => {
  if (typeof localStorage === "undefined") return [];

  try {
    const rawValue = localStorage.getItem(CALLBACK_LEADS_BACKLOG_KEY);
    if (!rawValue) return [];

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persistBacklog = (payload: CallbackLeadPayload) => {
  if (typeof localStorage === "undefined") return;

  const existing = readLocalBacklog();
  existing.push({ ...payload, phone: payload.phone });

  const trimmed = existing.slice(-MAX_BACKLOG_ENTRIES);
  try {
    localStorage.setItem(CALLBACK_LEADS_BACKLOG_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.warn("[callback-leads] failed to persist backlog", error);
  }
};

export const submitCallbackLead = async <T = unknown>(payload: CallbackLeadPayload): Promise<CallbackLeadResponse<T>> => {
  if (typeof fetch === "undefined") {
    persistBacklog(payload);
    return { ok: false, storedLocally: true };
  }

  try {
    const response = await fetch(CALLBACK_LEADS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: payload.phone,
        route: payload.route,
        listingId: payload.listingId,
        unitCode: payload.unitCode,
        context: payload.context,
      }),
    });

    if (!response.ok) {
      throw new Error(`Callback lead submission failed (${response.status})`);
    }

    const data = (await response.json().catch(() => ({}))) as T;
    return { ok: true, data };
  } catch (error) {
    persistBacklog(payload);
    console.warn("[callback-leads] submission failed, stored locally", error);
    return { ok: false, error, storedLocally: true };
  }
};
