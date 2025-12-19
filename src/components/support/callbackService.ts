import { trackEvent } from "../../utils/analytics";

export type CallbackRequestPayload = {
  phone: string;
  name?: string;
  note?: string;
  route?: string;
  unitCode?: string | null;
  source?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function submitCallbackRequest(payload: CallbackRequestPayload) {
  trackEvent(
    "callback_requested",
    {
      surface: payload.source ?? "support_launcher",
      includedNote: Boolean(payload.note?.trim()),
    },
    { route: payload.route, unitCode: payload.unitCode ?? undefined },
  );

  await sleep(300);

  if (typeof console !== "undefined") {
    console.info("[callback] request captured", {
      source: payload.source,
      route: payload.route,
      unitCode: payload.unitCode,
    });
  }

  return { success: true } as const;
}
