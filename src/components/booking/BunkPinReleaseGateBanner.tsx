export interface BunkPinReleaseGateBannerProps {
  isCheckedIn: boolean;
  balanceDueInr: number;
  bunkLabel?: string | null;
  doorPin?: string | null;
}

export default function BunkPinReleaseGateBanner({
  isCheckedIn,
  balanceDueInr,
  bunkLabel,
  doorPin,
}: BunkPinReleaseGateBannerProps) {
  const canReveal = isCheckedIn && balanceDueInr <= 0;

  return (
    <section
      data-testid="hsl042-bunk-pin-gate"
      aria-label="Bunk assignment and door PIN"
      style={{
        background: canReveal ? "#f0fdf4" : "#fffbeb",
        border: canReveal ? "1px solid #86efac" : "1px solid #fde68a",
        borderRadius: 12,
        padding: 16,
        marginTop: 14,
      }}
    >
      {canReveal ? (
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#166534", marginBottom: 6 }}>
            Your bunk &amp; door access are ready
          </div>
          {bunkLabel && (
            <div style={{ fontSize: 14, color: "#14532d" }}>
              <strong>Assigned bunk:</strong> {bunkLabel}
            </div>
          )}
          {doorPin && (
            <div style={{ fontSize: 14, color: "#14532d", marginTop: 4 }}>
              <strong>Door PIN:</strong> <code style={{ fontWeight: 700 }}>{doorPin}</code>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#92400e", marginBottom: 4 }}>
            Bunk label &amp; door PIN locked until check-in
          </div>
          <p style={{ fontSize: 13, color: "#92400e", margin: 0 }}>
            {balanceDueInr > 0
              ? `Please settle the remaining ₹${balanceDueInr.toLocaleString("en-IN")} balance and complete check-in to unlock your bunk label and door PIN.`
              : "Complete online or front-desk check-in to unlock your assigned bunk label and door PIN."}
          </p>
        </div>
      )}
    </section>
  );
}
