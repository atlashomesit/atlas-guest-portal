/**
 * PAY-016: opens Razorpay Checkout inside the first-party pay page (`/pay/:token`) for the order the API created. This file does no money maths: the order, its
 * amount (paise) and the host's public key id all come from `POST .../order`. What Checkout returns is handed to `POST .../verify`, where the SERVER verifies the
 * signature and the captured payment; nothing here marks anything paid.
 */
import { loadRazorpayCheckout } from '../components/qrmenu/payNow';
import type { RazorpayCheckoutResult } from '../api/payLink';

export type PayLinkCheckoutErrorCode = 'UNAVAILABLE' | 'DISMISSED' | 'PAYMENT_FAILED';

/** A refusal with a sentence the guest can read. `UNAVAILABLE` = the checkout window could not open at all (the page may fall back to the hosted link). */
export class PayLinkCheckoutError extends Error {
  readonly code: PayLinkCheckoutErrorCode;
  constructor(message: string, code: PayLinkCheckoutErrorCode) {
    super(message);
    this.name = 'PayLinkCheckoutError';
    this.code = code;
  }
}

export interface PayLinkCheckoutOrder {
  keyId: string;
  orderId: string;
  amountPaise: number;
}

export async function openPayLinkCheckout(order: PayLinkCheckoutOrder, hostName: string, description: string): Promise<RazorpayCheckoutResult> {
  try {
    await loadRazorpayCheckout();
  } catch (e) {
    throw new PayLinkCheckoutError(
      e instanceof Error && e.message ? e.message : 'The secure payment window could not open. Please try again.',
      'UNAVAILABLE',
    );
  }

  return new Promise<RazorpayCheckoutResult>((resolve, reject) => {
    try {
      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: 'INR',
        name: hostName,
        description,
        handler: (result: RazorpayCheckoutResult) => resolve(result),
        modal: {
          ondismiss: () =>
            reject(new PayLinkCheckoutError('Payment was not completed. You have not been charged. You can try again.', 'DISMISSED')),
        },
        theme: { color: '#047857' },
      });
      checkout.on('payment.failed', () =>
        reject(new PayLinkCheckoutError('The payment did not go through. You have not been charged. Please try again.', 'PAYMENT_FAILED')),
      );
      checkout.open();
    } catch {
      reject(new PayLinkCheckoutError('The secure payment window could not open. Please try again.', 'UNAVAILABLE'));
    }
  });
}
