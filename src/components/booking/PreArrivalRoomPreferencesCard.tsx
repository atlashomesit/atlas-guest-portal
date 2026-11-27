import React, { useState } from "react";

export interface PreArrivalRoomPreferences {
  bedSetup: "default" | "king" | "twin";
  extraPillows: boolean;
  babyCrib: boolean;
  groundFloor: boolean;
  notes: string;
}

export interface PreArrivalRoomPreferencesCardProps {
  value?: Partial<PreArrivalRoomPreferences>;
  onChange?: (next: PreArrivalRoomPreferences) => void;
}

export default function PreArrivalRoomPreferencesCard({ value, onChange }: PreArrivalRoomPreferencesCardProps) {
  const [prefs, setPrefs] = useState<PreArrivalRoomPreferences>({
    bedSetup: value?.bedSetup ?? "default",
    extraPillows: Boolean(value?.extraPillows),
    babyCrib: Boolean(value?.babyCrib),
    groundFloor: Boolean(value?.groundFloor),
    notes: value?.notes ?? "",
  });

  function update(patch: Partial<PreArrivalRoomPreferences>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    onChange?.(next);
  }

  return (
    <section
      data-testid="bnb036-room-preferences-card"
      aria-label="Pre-arrival room preferences"
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 18,
        marginTop: 16,
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>
        Room preferences (subject to availability)
      </h3>
      <p style={{ fontSize: 13, color: "#475569", margin: "0 0 12px" }}>
        Let the host prepare your room before arrival.
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
          Preferred bed setup
          <select
            value={prefs.bedSetup}
            onChange={(e) => update({ bedSetup: e.target.value as PreArrivalRoomPreferences["bedSetup"] })}
            style={{ minHeight: 40, padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
          >
            <option value="default">No preference</option>
            <option value="king">Double / King bed</option>
            <option value="twin">Twin separate beds</option>
          </select>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={prefs.extraPillows}
            onChange={(e) => update({ extraPillows: e.target.checked })}
          />
          Extra pillows
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={prefs.babyCrib}
            onChange={(e) => update({ babyCrib: e.target.checked })}
          />
          Baby crib / cot
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={prefs.groundFloor}
            onChange={(e) => update({ groundFloor: e.target.checked })}
          />
          Ground-floor / step-free access
        </label>

        <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
          Additional room notes (optional)
          <input
            type="text"
            value={prefs.notes}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="e.g. Late arrival around 10 PM"
            style={{ minHeight: 40, padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
          />
        </label>
      </div>
    </section>
  );
}
