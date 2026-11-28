import { useState } from "react";
import { buildApiUrl, getApiHeaders } from "@/api/client";

export type CleaningPreference = "daily" | "fresh_towels_only" | "skip_cleaning";

export interface DailyCleaningOptOutCardProps {
  bookingToken: string;
  initialPreference?: CleaningPreference;
  onSaved?: (pref: CleaningPreference) => void;
}

const OPTIONS: { value: CleaningPreference; title: string; subtitle: string }[] = [
  { value: "daily", title: "Standard daily cleaning", subtitle: "Full housekeeping refresh each morning" },
  { value: "fresh_towels_only", title: "Fresh towels only", subtitle: "Quick towel swap & bin empty, no room entry" },
  { value: "skip_cleaning", title: "Skip cleaning", subtitle: "Do not disturb — no housekeeping service today" },
];

export default function DailyCleaningOptOutCard({
  bookingToken,
  initialPreference = "daily",
  onSaved,
}: DailyCleaningOptOutCardProps) {
  const [selected, setSelected] = useState<CleaningPreference>(initialPreference);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(next: CleaningPreference) {
    setSelected(next);
    setSaving(true);
    setSavedNotice(null);
    setError(null);
    try {
      const res = await fetch(
        buildApiUrl(`/api/public/bookings/${encodeURIComponent(bookingToken)}/housekeeping-preference`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getApiHeaders() },
          body: JSON.stringify({ cleaningPreference: next }),
        },
      );
      if (!res.ok) {
        setError("Could not update your cleaning preference right now. Please let the host know on WhatsApp.");
        return;
      }
      setSavedNotice("Housekeeping preference saved.");
      onSaved?.(next);
    } catch {
      setError("Could not reach the server. Please try again shortly.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      data-testid="bnb035-daily-cleaning-card"
      aria-label="Daily room cleaning preference"
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 18,
        marginTop: 16,
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>
        Daily room cleaning
      </h3>
      <p style={{ fontSize: 13, color: "#475569", margin: "0 0 12px" }}>
        Choose how you would like housekeeping during your stay.
      </p>
      <div role="radiogroup" aria-label="Cleaning preference" style={{ display: "grid", gap: 8 }}>
        {OPTIONS.map((opt) => {
          const active = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={saving}
              onClick={() => handleSave(opt.value)}
              style={{
                textAlign: "left",
                minHeight: 48,
                padding: "10px 14px",
                borderRadius: 10,
                border: active ? "2px solid #0f172a" : "1px solid #cbd5e1",
                background: active ? "#f8fafc" : "#fff",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>{opt.title}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{opt.subtitle}</div>
            </button>
          );
        })}
      </div>
      {savedNotice && <p role="status" style={{ color: "#15803d", fontSize: 13, margin: "10px 0 0" }}>{savedNotice}</p>}
      {error && <p role="alert" style={{ color: "#b91c1c", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}
    </section>
  );
}
