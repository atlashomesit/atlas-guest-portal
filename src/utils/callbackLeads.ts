import { logApiError, logUserAction, monitoredFetch } from "../lib/monitoring";
import { buildApiUrl, getApiHeaders } from "@/api/client";

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
  message?: string;
};

const CALLBACK_LEADS_ENDPOINT = import.meta.env.VITE_CALLBACK_LEADS_ENDPOINT || "/api/leads/callback";
const CALLBACK_LEADS_BACKLOG_KEY = "callback_leads_backlog";
const MAX_BACKLOG_ENTRIES = 25;

const resolveCallbackLeadsEndpoint = (): string => {
  // Allow routing to an external service (absolute URL) via env.
  // Otherwise, ensure relative paths are sent to the configured Atlas API origin.
  try {
    const asUrl = new URL(CALLBACK_LEADS_ENDPOINT);
    return asUrl.toString();
  } catch {
    return buildApiUrl(CALLBACK_LEADS_ENDPOINT);
  }
};

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

  logUserAction("callback_lead_submitted", payload);

  try {
    const endpoint = resolveCallbackLeadsEndpoint();
    const response = await monitoredFetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getApiHeaders(),
      },
      body: JSON.stringify({
        phone: payload.phone,
        route: payload.route,
        listingId: payload.listingId,
        unitCode: payload.unitCode,
        context: payload.context,
      }),
      requestName: "callback-lead",
    });

    if (!response.ok) {
      logApiError(new Error("Callback lead submission failed"), {
        url: endpoint,
        status: response.status,
        method: "POST",
        category: "http",
      });
      throw new Error(`Callback lead submission failed (${response.status})`);
    }

    const data = (await response.json().catch(() => ({}))) as T;
    logUserAction("callback_lead_stored", { listingId: payload.listingId, unitCode: payload.unitCode });
    return { ok: true, data, message: "We have received your request and will call you back shortly." };
  } catch (error) {
    persistBacklog(payload);
    logApiError(error, { url: resolveCallbackLeadsEndpoint(), method: "POST", category: "network" });
    return {
      ok: false,
      error,
      storedLocally: true,
      message: "We saved your details and will follow up as soon as we are back online.",
    };
  }
};
