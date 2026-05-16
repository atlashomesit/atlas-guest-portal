import axios from 'axios';

/** Guest-facing copy when the browser never reached the API (TASK-2460). */
export const NETWORK_ERROR_MESSAGE = 'Network error. Please check your connection and try again.';

export const PROVIDER_NOT_CONFIGURED_WHATSAPP_HINT =
  'Tap Continue on WhatsApp to message the host directly.';

/** True when there is no HTTP response (TASK-2460: TypeError or axios without `response`). */
export function isTransportLayerFailure(error: unknown): boolean {
  if (error instanceof Error && error.name === 'TypeError') return true;
  return axios.isAxiosError(error) && error.response == null;
}

/**
 * TASK-2460: Prefer `message` from a non-2xx JSON body; append WhatsApp hint for tenant provider gap.
 * Falls back to `fallbackMessage` when the body has no usable message.
 */
export function getOrderCreationGuestErrorMessage(error: unknown, fallbackMessage: string): string {
  if (isTransportLayerFailure(error)) return NETWORK_ERROR_MESSAGE;

  if (axios.isAxiosError(error) && error.response && typeof error.response.data === 'object') {
    const status = error.response.status;
    if (status >= 400) {
      const r = error.response.data as Record<string, unknown>;
      const message = (
        typeof r.message === 'string' ? r.message : typeof r.Message === 'string' ? r.Message : ''
      ).trim();
      const code = (
        typeof r.code === 'string' ? r.code : typeof r.Code === 'string' ? r.Code : ''
      ).trim();
      if (message) {
        const hint =
          code === 'PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT'
            ? `\n${PROVIDER_NOT_CONFIGURED_WHATSAPP_HINT}`
            : '';
        return `${message}${hint}`;
      }
    }
  }

  return fallbackMessage;
}
