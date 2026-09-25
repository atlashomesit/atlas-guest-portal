import { useState } from "react";

export interface ParsedNearPlace {
  /** Display name with any trailing "(distance)" hint stripped. */
  name: string;
  /**
   * Distance hint exactly as listed for the property (e.g. "3 km", "1.2 km"),
   * or null when the source entry carries no distance — never invented.
   */
  distance: string | null;
  /** Original raw entry, kept for React keys. */
  raw: string;
}

export type LocalGuideCategory =
  | "Eat & drink"
  | "Shopping"
  | "Getting around"
  | "Nature & leisure"
  | "Essentials & healthcare"
  | "Also nearby";

/**
 * TASK-102117: split a `property_nearplaces` entry such as
 * "Inorbit Mall (3 km)" into its name and distance parts.
 * Entries without a trailing parenthesized hint (e.g. "Durgam Cheruvu Lake")
 * yield `distance: null` and the caller renders the name alone.
 */
export function parseNearPlace(raw: string): ParsedNearPlace {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (!match) {
    return { name: trimmed, distance: null, raw };
  }
  const name = match[1].trim();
  const distance = match[2].trim();
  if (!name || !distance) {
    return { name: trimmed, distance: null, raw };
  }
  return { name, distance, raw };
}

const CATEGORY_KEYWORDS: Array<{ category: LocalGuideCategory; keywords: string[] }> = [
  {
    category: "Eat & drink",
    keywords: [
      "cafe", "café", "coffee", "restaurant", "food", "eatery", "eateries", "bakery",
      "bar", "pub", "dhaba", "biryani", "pizza", "dining", "dine", "chai", "tea",
      "sweets", "kitchen", "bistro", "hotel restaurant",
    ],
  },
  {
    category: "Shopping",
    keywords: [
      "mall", "market", "markets", "shopping", "bazaar", "store", "supermarket",
      "grocery", "shop", "boutique", "plaza",
    ],
  },
  {
    category: "Getting around",
    keywords: [
      "metro", "station", "airport", "bus", "railway", "highway", "cab", "taxi",
      "road", "orr", "jntu", "ride",
    ],
  },
  {
    category: "Nature & leisure",
    keywords: [
      "beach", "lake", "park", "garden", "temple", "museum", "fort", "cinema",
      "theatre", "theater", "club", "pool", "golf", "zoo", "palace", "church",
      "mosque", "falls", "hill", "viewpoint", "stadium", "resort",
    ],
  },
  {
    category: "Essentials & healthcare",
    keywords: [
      "hospital", "clinic", "pharmacy", "medical", "doctor", "atm", "bank",
      "salon", "laundry", "emergency",
    ],
  },
];

const CATEGORY_ORDER: LocalGuideCategory[] = [
  "Eat & drink",
  "Shopping",
  "Getting around",
  "Nature & leisure",
  "Essentials & healthcare",
  "Also nearby",
];

/**
 * Presentational grouping of host/API-supplied place names by keyword — the
 * category labels are client-side buckets, not host declarations.
 */
export function categorizeNearPlace(name: string): LocalGuideCategory {
  const lowered = name.toLowerCase();
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => lowered.includes(keyword))) {
      return category;
    }
  }
  return "Also nearby";
}

export interface LocalGuideGroup {
  category: LocalGuideCategory;
  spots: ParsedNearPlace[];
}

/** Group non-blank entries, preserving source order within each category. */
export function groupNearPlaces(places: readonly string[]): LocalGuideGroup[] {
  const parsed = places
    .filter((entry) => typeof entry === "string" && entry.trim().length > 0)
    .map(parseNearPlace);
  const byCategory = new Map<LocalGuideCategory, ParsedNearPlace[]>();
  for (const spot of parsed) {
    const category = categorizeNearPlace(spot.name);
    const list = byCategory.get(category);
    if (list) {
      list.push(spot);
    } else {
      byCategory.set(category, [spot]);
    }
  }
  return CATEGORY_ORDER.filter((category) => byCategory.has(category)).map((category) => ({
    category,
    spots: byCategory.get(category)!,
  }));
}

type LocalGuideAccordionProps = {
  /**
   * Raw `property_nearplaces` strings for THIS property (API or static data).
   * Distances render only when embedded in the source entry — nothing is
   * inferred. Renders null (section omitted) when empty.
   */
  places: readonly string[] | undefined | null;
};

/**
 * TASK-102117 [GUEST-PORTAL / LOCAL-GUIDE / ACCORDION]: "Explore the
 * Neighborhood" recommendations accordion for the property page.
 *
 * DATA SOURCE: `property_nearplaces` (API listing field, static `data.ts`
 * fallback). No static sample POIs are embedded here — when the property
 * carries no nearby-places data the whole section is omitted (consistent
 * with DESIGN-031: omit invented prose; never present invented
 * POIs/distances as real host recommendations).
 * TODO(data): when the API gains structured POI fields (per-spot category,
 * numeric distance, host-picked flag), replace the keyword bucketing and the
 * "(distance)" suffix parsing with those fields.
 */
export default function LocalGuideAccordion({ places }: LocalGuideAccordionProps) {
  const groups = groupNearPlaces(places ?? []);
  const [openIndex, setOpenIndex] = useState(0);

  if (groups.length === 0) {
    return null;
  }

  return (
    <section
      className="pp-section"
      aria-label="Explore the Neighborhood"
      data-testid="property-local-guide-section"
    >
      <div className="pp-section-head">
        <h2>Explore the Neighborhood</h2>
      </div>
      <p className="pp-prose" data-testid="local-guide-source-note">
        Spots listed for this property, with distances as listed.
      </p>
      <div className="pp-guide-accordion">
        {groups.map((group, index) => {
          const open = index === openIndex;
          const panelId = `local-guide-panel-${index}`;
          const buttonId = `local-guide-button-${index}`;
          return (
            <div key={group.category} className="pp-guide-group">
              <button
                type="button"
                id={buttonId}
                className="pp-guide-toggle"
                aria-expanded={open}
                aria-controls={panelId}
                data-testid={`local-guide-category-${index}`}
                onClick={() => setOpenIndex(open ? -1 : index)}
              >
                <span>{group.category}</span>
                <span className="pp-guide-count" aria-hidden="true">
                  {group.spots.length}
                </span>
                <svg
                  className={`pp-guide-chevron${open ? " pp-guide-chevron-open" : ""}`}
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {open && (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="pp-guide-panel"
                >
                  <ul className="pp-guide-list">
                    {group.spots.map((spot, spotIndex) => (
                      <li
                        key={`${spot.raw}-${spotIndex}`}
                        className="pp-guide-spot"
                        data-testid="local-guide-spot"
                      >
                        <span className="pp-guide-spot-name">{spot.name}</span>
                        {spot.distance ? (
                          <span className="pp-guide-spot-distance">
                            {spot.distance} away
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
