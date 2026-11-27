import React, { useState } from "react";
import { buildApiUrl, getApiHeaders } from "@/api/client";

export interface ExpressCheckoutLineItem {
  id: string;
  label: string;
  amountInr: number;
  category: "room" | "pos" | "extra";
}

export interface ExpressMobileCheckoutCardProps {
  bookingToken: string;
  items: ExpressCheckoutLineItem[];
  paidInr: number;
  enabled?: boolean;
  onPayBalance?: (balanceDueInr: number) => void;
  onCheckedOut?: () => void;
}

export default function ExpressMobileCheckoutCard({
  bookingToken,
  items,
  paidInr,
  enabled = true,
  onPayBalance,
  onCheckedOut,
}: ExpressMobileCheckoutCardProps) {
  const [departureSlot, setDepartureSlot] = useState("10:00");
  const [submitting, setSubmitting] = useState(false);
  const [checkedOut, setCheckedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled) {
    return (
      <section data-testid="htl064-express-checkout-disabled" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginTop: 16 }}>
        Please check out at the front desk.
      </section>
    );
  }

  const totalInr = items.reduce((sum, item) => sum + item.amountInr, 0);
  const balanceDueInr = Math.max(0, totalInr - paidInr);

  async function handleExpressCheckout() {
    if (balanceDueInr > 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        buildApiUrl(`/api/public/bookings/${encodeURIComponent(bookingToken)}/check-out`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getApiHeaders() },
          body: JSON.stringify({ departureTime: departureSlot }),
        },
      );
      if (res.status === 409) {
        setError("A balance is still due on your folio. Please pay the remaining amount before checking out.");
        return;
      }
      if (!res.ok) {
        setError("Could not complete online check-out right now. Please visit the front desk.");
        return;
      }
      setCheckedOut(true);
      onCheckedOut?.();
    } catch {
      setError("Could not reach the check-out service. Please try again shortly.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      data-testid="htl064-express-checkout"
      aria-label="Express mobile check-out"
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 18,
        marginTop: 16,
      }}
    >
      <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: "0 0 10px" }}>
        Check out from your phone
      </h3>

      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", display: "grid", gap: 6 }}>
        {items.map((item) => (
          <li key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#334155" }}>
            <span>{item.label}</span>
            <strong>₹{item.amountInr.toLocaleString("en-IN")}</strong>
          </li>
        ))}
      </ul>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: 10,
          borderTop: "1px solid #e2e8f0",
          fontSize: 15,
          fontWeight: 700,
          color: balanceDueInr > 0 ? "#b91c1c" : "#15803d",
          marginBottom: 14,
        }}
      >
        <span>{balanceDueInr > 0 ? `Left to pay ₹${balanceDueInr.toLocaleString("en-IN")}` : "Nothing left to pay"}</span>
        <span>Total ₹{totalInr.toLocaleString("en-IN")}</span>
      </div>

      {checkedOut ? (
        <div role="status" style={{ color: "#15803d", fontWeight: 600, fontSize: 14 }}>
          Checked out online. Thank you for staying with us!
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600 }}>
            Approximate departure time
            <input
              type="time"
              value={departureSlot}
              onChange={(e) => setDepartureSlot(e.target.value)}
              style={{ minHeight: 44, padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
            />
          </label>

          {balanceDueInr > 0 && (
            <button
              type="button"
              onClick={() => onPayBalance?.(balanceDueInr)}
              style={{
                minHeight: 44,
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: "#2563eb",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Pay ₹{balanceDueInr.toLocaleString("en-IN")} by UPI
            </button>
          )}

          <button
            type="button"
            disabled={balanceDueInr > 0 || submitting}
            onClick={handleExpressCheckout}
            style={{
              minHeight: 44,
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: balanceDueInr > 0 ? "#cbd5e1" : "#16a34a",
              color: balanceDueInr > 0 ? "#64748b" : "#fff",
              fontWeight: 700,
              cursor: balanceDueInr > 0 || submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Checking out…" : "Check out"}
          </button>
        </div>
      )}

      {error && <p role="alert" style={{ color: "#b91c1c", fontSize: 13, marginTop: 10, marginBottom: 0 }}>{error}</p>}
    </section>
  );
}
