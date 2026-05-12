import { useMemo } from "react";
import { GOOGLE_MAPS_API_KEY } from "@/config/googleMaps";

export interface GoogleEmbedPlaceByQueryProps {
  /** Street / city / region — geocoded by Google Static Maps `center` / marker. */
  query: string;
  title?: string;
  zoom?: number;
  /** Tailwind classes on the map image (default matches listing detail map frame). */
  frameClassName?: string;
}

/** API default copy when listing has no real location string — not geocodable. */
const NON_MAP_QUERIES = new Set(
  ["location not specified", "location on map", "n/a", "na", "—", "-"].map((s) => s.toLowerCase()),
);

/** True when we should request a map image for this string (avoids useless Static Map calls). */
export function isMappableAddressQuery(q: string | undefined | null): boolean {
  const t = (q ?? "").trim();
  if (t.length < 4) return false;
  if (NON_MAP_QUERIES.has(t.toLowerCase())) return false;
  return true;
}

/**
 * TL-GUEST: Google **Static Maps** image for listing detail when only address text exists.
 * Uses `img` + maps.googleapis.com (allowed by CSP `img-src`) — avoids iframe `frame-src`
 * blocks that show “This content is blocked” for www.google.com embed URLs on strict CSP.
 */
export default function GoogleEmbedPlaceByQuery({
  query,
  title,
  zoom = 15,
  frameClassName = "w-full h-64 sm:h-96 object-cover",
}: GoogleEmbedPlaceByQueryProps) {
  const imageUrl = useMemo(() => {
    const q = query.trim();
    if (!GOOGLE_MAPS_API_KEY || !isMappableAddressQuery(q)) return null;
    const enc = encodeURIComponent(q);
    return `https://maps.googleapis.com/maps/api/staticmap?center=${enc}&zoom=${zoom}&size=800x384&scale=2&markers=color:red%7C${enc}&key=${GOOGLE_MAPS_API_KEY}`;
  }, [query, zoom]);

  if (!imageUrl) return null;

  return (
    <img
      className={frameClassName}
      src={imageUrl}
      alt={title ? `Map preview near ${title}` : "Map preview for this address"}
      loading="lazy"
      decoding="async"
    />
  );
}
