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
 * The two codes RazorpayController.CreateOrder maps to a 422 when the tenant has no usable payment
 * provider (PaymentRoutingResult.Blocked, or an unresolved routing result). The third sibling,
 * PAYMENT_PROVIDER_NOT_CONFIGURED_PLATFORM, is a 503 platform outage and is deliberately NOT here.
 */
const PROVIDER_NOT_CONFIGURED_422_CODES: ReadonlySet<string> = new Set([
  'PAYMENT_PROVIDER_NOT_CONFIGURED_TENANT',
  'PAYMENT_PROVIDER_NOT_CONFIGURED',
]);

/**
 * True when the order / init-hold call failed because this tenant cannot take an online payment
 * (since TASK-101182 the Reserve step's init-hold fails closed on it, before any hold is created).
 *
 * Matches the API's error CODE on a 422 - never a bare status: 422 is also PAYMENT_VALIDATION_ERROR and
 * INTERNAL_TENANT_PAYMENT_BLOCKED, neither of which is a WhatsApp hand-off situation. The wire body is
 * camelCase (`code`); PascalCase `Code` is tolerated like the rest of this widget.
 */
export function isProviderNotConfiguredError(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: unknown } } | null | undefined)?.response;
  if (response?.status !== 422 || typeof response.data !== 'object' || response.data === null) return false;
  const body = response.data as Record<string, unknown>;
  const code = (typeof body.code === 'string' ? body.code : typeof body.Code === 'string' ? body.Code : '').trim();
  return PROVIDER_NOT_CONFIGURED_422_CODES.has(code);
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
