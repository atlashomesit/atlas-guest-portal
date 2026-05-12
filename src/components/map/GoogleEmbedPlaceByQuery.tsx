import { useMemo } from "react";
import { GOOGLE_MAPS_API_KEY } from "@/config/googleMaps";

export interface GoogleEmbedPlaceByQueryProps {
  /** Street / city / region text — passed to Maps Embed `place` mode `q` (geocoded by Google). */
  query: string;
  title?: string;
  zoom?: number;
  /** Tailwind height / width on the iframe (default matches listing detail map frame). */
  frameClassName?: string;
}

/**
 * TL-GUEST: Maps Embed API when we have an address string but no lat/lng (listing detail fallback).
 * Same key/product family as EmbeddedListingMap; enable "Maps Embed API" on the key if missing.
 */
export default function GoogleEmbedPlaceByQuery({
  query,
  title,
  zoom = 15,
  frameClassName = "w-full h-64 sm:h-96",
}: GoogleEmbedPlaceByQueryProps) {
  const src = useMemo(() => {
    const q = query.trim();
    if (!GOOGLE_MAPS_API_KEY || !q) return null;
    return `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(q)}&zoom=${zoom}`;
  }, [query, zoom]);

  if (!src) return null;

  return (
    <iframe
      className={frameClassName}
      src={src}
      loading="lazy"
      allowFullScreen
      referrerPolicy="no-referrer-when-downgrade"
      title={title ? `Map — ${title}` : "Property location map"}
    />
  );
}
