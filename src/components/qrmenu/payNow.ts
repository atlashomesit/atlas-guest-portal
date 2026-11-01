/**
 * POS-067 - the guest QR page's real "Pay now": ask the API to create the Razorpay order for an unsettled order, open Razorpay Checkout with THAT order,
 * and hand what Checkout returns to verify-payment. Every number comes from the API (the amount is the order's balance, read by the server); this file
 * does no money maths. Fail-safe: any refusal is returned in plain words and the order simply stays unpaid.
 */
import { buildApiUrl, getApiHeaders } from "../../api/client";

export interface PayNowOrder {
  /** The Razorpay order id the API created. */
  orderId: string;
  keyId: string;
  amount: number;
  amountInPaise: number;
  currency: string;
  posOrderId?: number | null;
  orderNumber?: string | null;
}

export interface PayNowCheckoutResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/** A refusal with a sentence the guest can read. */
export class PayNowError extends Error {
  readonly code: string | null;
  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = "PayNowError";
    this.code = code;
  }
}

const SETTLED_OR_CLOSED = new Set(["Settled", "PostedToRoom", "Voided"]);

/**
 * True when the order can take an online payment: the API says something is still owed (`amountDue`), it is not settled / voided / posted to a room folio.
 * An older API that does not send `amountDue` never shows the button.
 */
export function canPayNow(order: { status?: string | null; settlementMethod?: string | null; amountDue?: number | null }): boolean {
  if (typeof order.amountDue !== "number" || !Number.isFinite(order.amountDue) || order.amountDue <= 0) return false;
  if (order.status && SETTLED_OR_CLOSED.has(order.status)) return false;
  if (order.settlementMethod === "POST_TO_ROOM") return false;
  return true;
}

const FALLBACK = "We could not start the online payment just now. Nothing was charged. Please try again, or pay at the counter.";

async function readRefusal(res: Response): Promise<PayNowError> {
  const data = await res.json().catch(() => null);
  const message = typeof data?.error === "string" && data.error.trim() ? data.error : FALLBACK;
  return new PayNowError(message, typeof data?.code === "string" ? data.code : null);
}

async function post(tenantSlug: string, path: string, body: unknown): Promise<Response> {
  try {
    return await fetch(buildApiUrl(`/api/public/qr-menu/${encodeURIComponent(tenantSlug)}/${path}`), {
      method: "POST",
      headers: { ...getApiHeaders(tenantSlug), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new PayNowError("We could not reach the server. Check your connection and try again. If money was taken, do not pay again - show this to the staff.");
  }
}

/** POST create-payment-order for the order number; the server decides the amount. */
export async function createPayNowOrder(tenantSlug: string, orderNumber: string): Promise<PayNowOrder> {
  const res = await post(tenantSlug, "create-payment-order", { orderNumber });
  if (!res.ok) throw await readRefusal(res);
  const data = (await res.json().catch(() => null)) as Partial<PayNowOrder> | null;
  if (!data || typeof data.orderId !== "string" || typeof data.keyId !== "string" || typeof data.amountInPaise !== "number") {
    throw new PayNowError(FALLBACK);
  }
  return data as PayNowOrder;
}

/** POST verify-payment with what Razorpay Checkout returned. Resolves only when the API settled the order (or it already was). */
export async function verifyPayNow(tenantSlug: string, order: PayNowOrder, result: PayNowCheckoutResult): Promise<void> {
  const res = await post(tenantSlug, "verify-payment", {
    razorpayOrderId: result.razorpay_order_id,
    razorpayPaymentId: result.razorpay_payment_id,
    razorpaySignature: result.razorpay_signature,
    posOrderId: order.posOrderId ?? undefined,
    orderNumber: order.orderNumber ?? undefined,
  });
  if (!res.ok) throw await readRefusal(res);
  const data = await res.json().catch(() => null);
  if (!data || data.success !== true) throw new PayNowError("We could not confirm your payment yet, so the order is not marked paid. If money was taken, do not pay again - show this to the staff.");
}

/** Loads Razorpay Checkout once. */
export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => (window.Razorpay ? resolve() : reject(new PayNowError("The secure payment window could not start. Please try again.")));
    script.onerror = () => reject(new PayNowError("The secure payment window could not load. Check your connection and try again."));
    document.head.appendChild(script);
  });
}

/**
 * Opens Razorpay Checkout for the order the API created. Resolves with what Checkout returned on payment; rejects with a PayNowError when the guest closes
 * the window (`code: "DISMISSED"`) or the payment fails (`code: "PAYMENT_FAILED"`).
 */
export function openCheckout(order: PayNowOrder, tenantName: string): Promise<PayNowCheckoutResult> {
  return new Promise<PayNowCheckoutResult>((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amountInPaise,
      currency: order.currency,
      name: tenantName,
      description: order.orderNumber ? `Order ${order.orderNumber}` : "Order payment",
      handler: (result: PayNowCheckoutResult) => resolve(result),
      modal: { ondismiss: () => reject(new PayNowError("Payment was not completed. You have not been charged. You can try again.", "DISMISSED")) },
      theme: { color: "#9e402a" },
    });
    checkout.on("payment.failed", () => reject(new PayNowError("The payment did not go through. You have not been charged. Please try again, or pay at the counter.", "PAYMENT_FAILED")));
    checkout.open();
  });
}
