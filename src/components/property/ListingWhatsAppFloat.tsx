/**
 * TASK-102116 — floating "Chat with Host on WhatsApp" bubble for tenant booking pages.
 *
 * Guests with pre-booking questions get a one-tap floating bubble (bottom corner) that
 * opens WhatsApp with a pre-filled room query:
 *   "Hi, I have a question about [Listing Name] on [Tenant Brand]"
 *
 * REPO-HOME: this component is presentational — the host number MUST come from listing/
 * tenant data already on the page (getGuestFacingPhone('business') || listing hostPhone).
 * It NEVER invents or hardcodes a number: with no number supplied it renders nothing
 * (graceful degradation — hidden, never a recipient-less wa.me link).
 */
import React from "react";

import { trackEvent } from "@/utils/analytics";

interface ListingWhatsAppFloatProps {
  /** Guest-facing listing name shown on the page (e.g. getListingDisplayName(...)). */
  listingName: string;
  /** Host digits already resolved on the page (national or international, any punctuation). */
  phoneDigits: string;
  /** Tenant brand for the pre-fill context (getTenantBrandName()) — never hardcoded. */
  brandName: string;
  /** Listing id for analytics context. */
  listingId?: number | string | null;
}

/** Strip a caller-supplied number to digits; wa.me needs the full international form. */
function normalizePhoneDigits(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 0) return "";
  return digits.length === 10 ? `91${digits}` : digits;
}

/**
 * Builds the wa.me link with the URL-encoded pre-filled room query.
 * Returns "" when no host number is available — callers must render nothing in that case.
 */
export function buildListingWhatsAppUrl(
  phoneDigits: string,
  listingName: string,
  brandName: string,
): string {
  const normalized = normalizePhoneDigits(phoneDigits);
  if (!normalized) return "";
  const name = (listingName ?? "").trim() || "this property";
  const brand = (brandName ?? "").trim();
  const text = brand
    ? `Hi, I have a question about ${name} on ${brand}`
    : `Hi, I have a question about ${name}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

function WhatsAppGlyph({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export const ListingWhatsAppFloat: React.FC<ListingWhatsAppFloatProps> = ({
  listingName,
  phoneDigits,
  brandName,
  listingId,
}) => {
  const url = buildListingWhatsAppUrl(phoneDigits, listingName, brandName);
  // Graceful degradation: no host number on the page → hidden, never a blank wa.me link.
  if (!url) return null;

  const label = `Chat with host on WhatsApp about ${(listingName ?? "").trim() || "this property"}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="listing-whatsapp-float"
      aria-label={label}
      title={label}
      onClick={() =>
        trackEvent(
          "whatsapp_cta_click",
          { surface: "listing_float", listingId: listingId ?? undefined },
        )
      }
      className="fixed right-4 md:right-5 bottom-[8.5rem] md:bottom-24 z-[var(--z-floating)] flex h-14 w-14 items-center justify-center rounded-full text-white shadow-level3 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-primary"
      style={{ backgroundColor: "#075e54" }}
    >
      <WhatsAppGlyph />
    </a>
  );
};

export default ListingWhatsAppFloat;
