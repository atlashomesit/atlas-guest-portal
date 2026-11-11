/**
 * POS-013 — the guest QR menu's dietary marks and filter chips.
 * The host classifies each dish (VEG, NON_VEG, EGG, VEGAN, JAIN). A dish the host has not classified arrives as "NA" and
 * wears no mark and matches no dietary chip: the menu never claims anything about a dish nobody classified.
 */
export type QrDietary = "VEG" | "NON_VEG" | "EGG" | "VEGAN" | "JAIN" | "NA";
export type DietaryFilterKey = "ALL" | "PURE_VEG" | "JAIN" | "NON_VEG";

export const DIETARY_FILTER_CHIPS: ReadonlyArray<{ key: DietaryFilterKey; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "PURE_VEG", label: "Pure Veg" },
  { key: "JAIN", label: "Jain" },
  { key: "NON_VEG", label: "Non-Veg" },
];

const KNOWN = new Set<string>(["VEG", "NON_VEG", "EGG", "VEGAN", "JAIN"]);

export function normalizeQrDietary(raw: string | null | undefined): QrDietary {
  const key = (raw ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  return KNOWN.has(key) ? (key as QrDietary) : "NA";
}

/** Pure Veg = veg, vegan, jain (egg is not pure veg). Non-Veg = non-veg and egg. Jain = jain only. */
export function matchesDietaryFilter(dietary: string | null | undefined, filter: DietaryFilterKey): boolean {
  if (filter === "ALL") return true;
  const d = normalizeQrDietary(dietary);
  switch (filter) {
    case "PURE_VEG":
      return d === "VEG" || d === "VEGAN" || d === "JAIN";
    case "JAIN":
      return d === "JAIN";
    case "NON_VEG":
      return d === "NON_VEG" || d === "EGG";
    default:
      return true;
  }
}

/** Standard Indian food-label colours; null = no mark. */
export function dietaryMarkColor(dietary: string | null | undefined): string | null {
  switch (normalizeQrDietary(dietary)) {
    case "VEG":
    case "VEGAN":
    case "JAIN":
      return "#16a34a";
    case "NON_VEG":
      return "#dc2626";
    case "EGG":
      return "#d97706";
    default:
      return null;
  }
}

export function dietaryMarkLabel(dietary: string | null | undefined): string {
  switch (normalizeQrDietary(dietary)) {
    case "VEG":
      return "Vegetarian";
    case "VEGAN":
      return "Vegan";
    case "JAIN":
      return "Jain";
    case "NON_VEG":
      return "Non-vegetarian";
    case "EGG":
      return "Contains egg";
    default:
      return "";
  }
}

/** The chips are worth showing only when at least one dish is classified; otherwise every chip but "All" would empty the menu. */
export function hasClassifiedDishes(items: ReadonlyArray<{ dietary?: string | null }>): boolean {
  return items.some((i) => normalizeQrDietary(i.dietary) !== "NA");
}
