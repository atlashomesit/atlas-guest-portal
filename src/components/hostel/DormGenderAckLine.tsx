/** HSL-011: calm one-line record that the guest confirmed the dorm gender rule. Nothing when not acknowledged. */
export function DormGenderAckLine({
  ackAtUtc,
  policy,
}: {
  ackAtUtc?: string | null;
  policy?: string | null;
}) {
  if (!ackAtUtc) return null;
  const d = new Date(ackAtUtc);
  if (isNaN(d.getTime())) return null;
  const when = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  const rule = policy === "FemaleOnly" ? "women-only " : policy === "MaleOnly" ? "men-only " : "";
  return (
    <p className="py-3 text-sm text-text-secondary" data-testid="confirmation-dorm-gender-ack">
      You confirmed the {rule}dorm rule on {when}.
    </p>
  );
}
