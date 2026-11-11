import React, { useState } from "react";
import { createPayNowOrder, loadRazorpayCheckout, openCheckout, PayNowError, verifyPayNow } from "./payNow";

interface Props {
  tenantSlug: string;
  tenantName: string;
  orderNumber: string;
  /** What the API says is still owed on the order, in rupees (shown on the button). */
  amountDue: number;
  /** Called after verify-payment settled the order, so the page can reload the order. */
  onPaid: () => void;
}

type Phase = "idle" | "starting" | "paying" | "verifying" | "paid";

/** POS-067: "Pay now" for an unsettled QR order. Opens Razorpay Checkout with the order the API created and settles it only through verify-payment. */
const QrPayNow: React.FC<Props> = ({ tenantSlug, tenantName, orderNumber, amountDue, onPaid }) => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const pay = async () => {
    if (phase !== "idle") return;
    setMessage(null);
    setPhase("starting");
    try {
      const order = await createPayNowOrder(tenantSlug, orderNumber);
      await loadRazorpayCheckout();
      setPhase("paying");
      const result = await openCheckout(order, tenantName);
      setPhase("verifying");
      await verifyPayNow(tenantSlug, order, result);
      setPhase("paid");
      onPaid();
    } catch (err) {
      setMessage(err instanceof PayNowError ? err.message : "Something went wrong. If money was taken, do not pay again - show this to the staff.");
      setPhase("idle");
    }
  };

  if (phase === "paid") {
    return (
      <div role="status" data-testid="pos-qr-pay-now-paid" style={{ margin: "0 4px 16px 4px", padding: "10px 12px", borderRadius: "8px", backgroundColor: "#ecfdf5", color: "#065f46", fontSize: "13px", fontWeight: 700 }}>
        Payment received. Thank you!
      </div>
    );
  }

  const busy = phase !== "idle";
  const label = phase === "starting" ? "Starting payment..." : phase === "paying" ? "Complete the payment in the window" : phase === "verifying" ? "Confirming your payment..." : `Pay now ₹${amountDue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  return (
    <div style={{ margin: "0 4px 16px 4px" }} data-testid="pos-qr-pay-now">
      <button
        type="button"
        onClick={() => void pay()}
        disabled={busy}
        data-testid="pos-qr-pay-now-btn"
        style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "none", backgroundColor: busy ? "#c9b3a8" : "#9e402a", color: "#fff", fontWeight: 800, fontSize: "14px", cursor: busy ? "default" : "pointer" }}
      >
        {label}
      </button>
      {message && (
        <div role="alert" data-testid="pos-qr-pay-now-message" style={{ marginTop: "8px", padding: "8px 10px", borderRadius: "8px", backgroundColor: "#fef2f2", color: "#991b1b", fontSize: "13px" }}>
          {message}
        </div>
      )}
    </div>
  );
};

export default QrPayNow;
