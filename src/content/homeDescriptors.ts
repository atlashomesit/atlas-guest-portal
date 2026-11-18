/**
 * Hand-written, one-line editorial descriptors for the Atlas homes shown
 * on the guest home "Our Homes" grid (guest-home v2 redesign).
 *
 * Keyed by the property/room id used across propertyData and the listing
 * models. Each line is ~14 words of specific, sensory copy — the card falls
 * back to the listing subtitle / property description and finally the
 * neighbourhood line when no descriptor exists, so partial coverage is safe.
 *
 * GUEST-065: a descriptor must never contradict the home. 101 and 301 are studios; their lines said
 * "Three bright bedrooms" and "a sunlit duplex", so they were removed and those cards use the fallback.
 * Add a line back only after checking it against the listing's own facts.
 */
const HOME_DESCRIPTORS: Record<string, string> = {
  "501": "Top-floor light, a private rooftop deck, and the whole skyline waiting at dusk.",
  "302": "Minimal and airy, made for the long stay where you finally unpack everything.",
  "201": "Room for the family, a quiet study nook, and a kitchen that genuinely cooks.",
  "202": "Open-plan calm with a private patio for slow breakfasts and unhurried late evenings.",
  "102": "A cosy corner suite for work trips, fast wifi, and a desk by the window.",
};

const BUNDLED_PLACEHOLDER_DESCRIPTIONS = new Set([
  "A cozy and comfortable room with modern amenities.",
  "A spacious room with modern amenities and a beautiful view.",
  "A comfortable room with all necessary amenities for a pleasant stay.",
  "A modern and well-equipped room for a comfortable stay.",
  "A comfortable and well-appointed room for your stay.",
  "A cozy room with all the necessary amenities for a comfortable stay.",
  "A luxurious penthouse with stunning views and premium amenities.",
]);

function isHostAuthoredCopy(value: string | undefined | null): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const withoutEllipsis = trimmed.replace(/\.\.\.$/, "");
  for (const placeholder of BUNDLED_PLACEHOLDER_DESCRIPTIONS) {
    if (trimmed === placeholder || placeholder.startsWith(withoutEllipsis)) {
      return false;
    }
  }
  return true;
}

/** Returns the editorial descriptor for a home, or undefined if none is authored. */
export function getHomeDescriptor(id: string | number | undefined | null): string | undefined {
  if (id === undefined || id === null) return undefined;
  return HOME_DESCRIPTORS[String(id)];
}

/**
 * GUEST-065: Resolves the home card's one-line descriptor without overriding host-authored facts
 * or leaking Atlas descriptors onto white-label sites.
 */
export function resolveHomeCardDescriptor(input: {
  id: string | number | undefined | null;
  subtitle?: string | null;
  propertyDescription?: string | null;
  hideAtlasBranding: boolean;
  unitSingular: string;
}): string {
  const hostLine = isHostAuthoredCopy(input.propertyDescription)
    ? input.propertyDescription.trim()
    : isHostAuthoredCopy(input.subtitle)
      ? input.subtitle.trim()
      : undefined;

  if (input.hideAtlasBranding) {
    return (
      hostLine ??
      input.subtitle?.trim() ??
      input.propertyDescription?.trim() ??
      `A calm, owner-run ${input.unitSingular}.`
    );
  }

  return (
    hostLine ??
    getHomeDescriptor(input.id) ??
    input.subtitle?.trim() ??
    input.propertyDescription?.trim() ??
    "A calm, owner-run home in this neighbourhood."
  );
}

export default HOME_DESCRIPTORS;
