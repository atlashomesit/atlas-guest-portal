import React from "react";

export type BedTypeFilter = "" | "twin" | "double";
export type BathroomPrivacyFilter = "" | "private" | "shared";
export type RoomPrivacyFilter = "" | "entire_place" | "private_room" | "shared_dorm";

export interface BedPrivacyFilters {
  bedType: BedTypeFilter;
  bathroomPrivacy: BathroomPrivacyFilter;
  roomPrivacy: RoomPrivacyFilter;
}

export function parseBedPrivacyFromSearch(search: string): BedPrivacyFilters {
  const sp = new URLSearchParams(search);
  const bed = sp.get("bedType");
  const bath = sp.get("bathroomPrivacy");
  const room = sp.get("roomPrivacy");
  return {
    bedType: bed === "twin" || bed === "double" ? bed : "",
    bathroomPrivacy: bath === "private" || bath === "shared" ? bath : "",
    roomPrivacy: room === "entire_place" || room === "private_room" || room === "shared_dorm" ? room : "",
  };
}

export function applyBedPrivacyToSearchParams(params: URLSearchParams, filters: BedPrivacyFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  if (filters.bedType) next.set("bedType", filters.bedType);
  else next.delete("bedType");
  if (filters.bathroomPrivacy) next.set("bathroomPrivacy", filters.bathroomPrivacy);
  else next.delete("bathroomPrivacy");
  if (filters.roomPrivacy) next.set("roomPrivacy", filters.roomPrivacy);
  else next.delete("roomPrivacy");
  return next;
}

export interface BedPrivacyFilterChipsProps {
  value: BedPrivacyFilters;
  onChange: (next: BedPrivacyFilters) => void;
}

export default function BedPrivacyFilterChips({ value, onChange }: BedPrivacyFilterChipsProps) {
  const chipStyle = (active: boolean): React.CSSProperties => ({
    minHeight: 36,
    padding: "6px 12px",
    borderRadius: 999,
    border: active ? "1px solid #0f172a" : "1px solid #cbd5e1",
    background: active ? "#0f172a" : "#fff",
    color: active ? "#fff" : "#334155",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  });

  return (
    <fieldset
      data-testid="mkt074-bed-privacy-filters"
      style={{ border: "none", padding: 0, margin: "12px 0", display: "grid", gap: 8 }}
    >
      <legend style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Bed &amp; privacy</legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          aria-pressed={value.bedType === "twin"}
          onClick={() => onChange({ ...value, bedType: value.bedType === "twin" ? "" : "twin" })}
          style={chipStyle(value.bedType === "twin")}
        >
          Twin beds
        </button>
        <button
          type="button"
          aria-pressed={value.bedType === "double"}
          onClick={() => onChange({ ...value, bedType: value.bedType === "double" ? "" : "double" })}
          style={chipStyle(value.bedType === "double")}
        >
          Double/King bed
        </button>
        <button
          type="button"
          aria-pressed={value.bathroomPrivacy === "private"}
          onClick={() =>
            onChange({ ...value, bathroomPrivacy: value.bathroomPrivacy === "private" ? "" : "private" })
          }
          style={chipStyle(value.bathroomPrivacy === "private")}
        >
          Private bathroom
        </button>
        <button
          type="button"
          aria-pressed={value.bathroomPrivacy === "shared"}
          onClick={() =>
            onChange({ ...value, bathroomPrivacy: value.bathroomPrivacy === "shared" ? "" : "shared" })
          }
          style={chipStyle(value.bathroomPrivacy === "shared")}
        >
          Shared bathroom
        </button>
        <button
          type="button"
          aria-pressed={value.roomPrivacy === "entire_place"}
          onClick={() =>
            onChange({ ...value, roomPrivacy: value.roomPrivacy === "entire_place" ? "" : "entire_place" })
          }
          style={chipStyle(value.roomPrivacy === "entire_place")}
        >
          Entire place
        </button>
        <button
          type="button"
          aria-pressed={value.roomPrivacy === "private_room"}
          onClick={() =>
            onChange({ ...value, roomPrivacy: value.roomPrivacy === "private_room" ? "" : "private_room" })
          }
          style={chipStyle(value.roomPrivacy === "private_room")}
        >
          Private room
        </button>
        <button
          type="button"
          aria-pressed={value.roomPrivacy === "shared_dorm"}
          onClick={() =>
            onChange({ ...value, roomPrivacy: value.roomPrivacy === "shared_dorm" ? "" : "shared_dorm" })
          }
          style={chipStyle(value.roomPrivacy === "shared_dorm")}
        >
          Shared dorm bed
        </button>
      </div>
    </fieldset>
  );
}
