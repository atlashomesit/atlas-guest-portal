export type BunkPositionPreference = "any" | "lower" | "upper";

export interface BunkPreferenceSelectorProps {
  value: BunkPositionPreference;
  lowerBunkFeeInr?: number;
  onChange: (next: BunkPositionPreference) => void;
}

export default function BunkPreferenceSelector({
  value,
  lowerBunkFeeInr = 0,
  onChange,
}: BunkPreferenceSelectorProps) {
  const options: { id: BunkPositionPreference; label: string; note: string }[] = [
    { id: "any", label: "No preference", note: "Free — assigned at check-in" },
    {
      id: "lower",
      label: "Lower bunk",
      note: lowerBunkFeeInr > 0 ? `+₹${lowerBunkFeeInr.toLocaleString("en-IN")} per stay` : "Free (subject to availability)",
    },
    { id: "upper", label: "Upper bunk", note: "Free (subject to availability)" },
  ];

  return (
    <fieldset
      data-testid="hsl044-bunk-preference"
      style={{ border: "none", padding: 0, margin: "12px 0", display: "grid", gap: 8 }}
    >
      <legend style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
        Bunk position preference
      </legend>
      <div role="radiogroup" aria-label="Bunk position preference" style={{ display: "grid", gap: 8 }}>
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.id)}
              style={{
                textAlign: "left",
                minHeight: 44,
                padding: "10px 14px",
                borderRadius: 10,
                border: active ? "2px solid #0f172a" : "1px solid #cbd5e1",
                background: active ? "#f8fafc" : "#fff",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{opt.note}</div>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
