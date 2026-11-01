import { buildApiUrl, getApiHeaders } from './client';

/**
 * TASK-10299239: the guest-facing security-deposit hold, on the two PUBLIC endpoints TASK-1040109 added to atlas-api.
 * Both are authorised by the booking-link token (`?t=`, the same bearer secret as every other guest route); the amount is the
 * listing's configured deposit, never chosen here.
 *
 *   POST /api/deposit-holds/public-order/{bookingId}?t=   -> auth-only Razorpay order (payment_capture 0: the card is HELD, not charged)
 *   POST /api/deposit-holds/public-verify/{bookingId}?t=  -> verifies Checkout's callback; on success the hold becomes Authorized
 */

export interface PublicDepositOrder {
  depositHoldId: number;
  razorpayOrderId: string;
  razorpayKeyId: string;
  /** PAISE, as Razorpay Checkout wants it (the API says so in DepositHoldOrderResponseDto). */
  amountPaise: number;
  currency: string;
}

export interface PublicDepositStatus {
  depositHoldId: number;
  status: string;
  amountInr: number;
  holdExpiresAtUtc?: string | null;
}

export interface DepositVerifyPayload {
  depositHoldId: number;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

/** Why a call did not succeed, in a form the page can switch on. */
export type DepositFailureKind =
  | 'invalid-link' // 404: unknown booking or a token that does not match
  | 'already-held' // 409 with a hold already Authorized / Captured / Disputed
  | 'not-active' // 409 for a booking that is not a live stay
  | 'not-offered' // 400: no online deposit is configured for this stay (or holds are switched off)
  | 'failed';

export class DepositRequestError extends Error {
  readonly kind: DepositFailureKind;
  readonly status: number;
  /** The hold status the API reported with a 409 (for example "Authorized"). */
  readonly holdStatus?: string;

  constructor(kind: DepositFailureKind, status: number, message: string, holdStatus?: string) {
    super(message);
    this.name = 'DepositRequestError';
    this.kind = kind;
    this.status = status;
    this.holdStatus = holdStatus;
  }
}

const pick = (obj: Record<string, unknown>, camel: string): unknown => {
  const pascal = camel.charAt(0).toUpperCase() + camel.slice(1);
  return obj[camel] ?? obj[pascal];
};

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const body = (await res.json()) as unknown;
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** `action` matters for 400: on public-order it means no online deposit is offered; on public-verify it means the payment could not be verified. */
async function failureFor(res: Response, action: 'public-order' | 'public-verify'): Promise<DepositRequestError> {
  const body = await readJson(res);
  const message = typeof body.message === 'string' && body.message.trim() ? body.message : `Request failed (${res.status})`;
  const holdStatus = typeof body.status === 'string' ? body.status : undefined;
  if (res.status === 404) return new DepositRequestError('invalid-link', 404, message);
  if (res.status === 409) {
    return new DepositRequestError(holdStatus ? 'already-held' : 'not-active', 409, message, holdStatus);
  }
  if (res.status === 400 && action === 'public-order') return new DepositRequestError('not-offered', 400, message);
  return new DepositRequestError('failed', res.status, message);
}

const depositUrl = (action: 'public-order' | 'public-verify', bookingId: string | number, token: string): string =>
  buildApiUrl(`/api/deposit-holds/${action}/${encodeURIComponent(String(bookingId))}?t=${encodeURIComponent(token)}`);

/** Creates the auth-only order for the booking's deposit. Throws {@link DepositRequestError}. */
export async function createPublicDepositOrder(bookingId: string | number, token: string): Promise<PublicDepositOrder> {
  const res = await fetch(depositUrl('public-order', bookingId, token), {
    method: 'POST',
    headers: { Accept: 'application/json', ...getApiHeaders() },
  });
  if (!res.ok) throw await failureFor(res, 'public-order');

  const body = await readJson(res);
  const order: PublicDepositOrder = {
    depositHoldId: Number(pick(body, 'depositHoldId')),
    razorpayOrderId: String(pick(body, 'razorpayOrderId') ?? ''),
    razorpayKeyId: String(pick(body, 'razorpayKeyId') ?? ''),
    amountPaise: Number(pick(body, 'amountPaise')),
    currency: String(pick(body, 'currency') ?? 'INR'),
  };
  if (!Number.isFinite(order.depositHoldId) || !order.razorpayOrderId || !order.razorpayKeyId || !(order.amountPaise > 0)) {
    throw new DepositRequestError('failed', res.status, 'The deposit order was incomplete. Please try again.');
  }
  return order;
}

/** Posts Razorpay Checkout's callback so the hold becomes Authorized. Throws {@link DepositRequestError}. */
export async function verifyPublicDeposit(
  bookingId: string | number,
  token: string,
  payload: DepositVerifyPayload,
): Promise<PublicDepositStatus> {
  const res = await fetch(depositUrl('public-verify', bookingId, token), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...getApiHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await failureFor(res, 'public-verify');

  const body = await readJson(res);
  return {
    depositHoldId: Number(pick(body, 'depositHoldId')),
    status: String(pick(body, 'status') ?? ''),
    amountInr: Number(pick(body, 'amountInr')),
    holdExpiresAtUtc: (pick(body, 'holdExpiresAtUtc') as string | null | undefined) ?? null,
  };
}
