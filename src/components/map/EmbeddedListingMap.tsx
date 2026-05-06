import { useMemo } from "react";
import { GOOGLE_MAPS_API_KEY } from "../../config/googleMaps";

// TL-PROP: Single-pin map for listing detail pages. Uses Google Maps Embed API
// (iframe) to avoid loading the full JS SDK on this lightweight page. Falls back
// to a "View on Google Maps" link when no API key is configured or coordinates
// are missing.

export interface EmbeddedListingMapProps {
  latitude: number;
  longitude: number;
  /** Title of the property/listing — shown in fallback link copy. */
  label?: string;
  /** Optional zoom (1–21). Default 15. */
  zoom?: number;
  /** Map height in CSS units. Default 320px. */
  height?: number;
  className?: string;
}

export default function EmbeddedListingMap({
  latitude,
  longitude,
  label,
  zoom = 15,
  height = 320,
  className,
}: EmbeddedListingMapProps) {
  const embedUrl = useMemo(() => {
    if (!GOOGLE_MAPS_API_KEY) return null;
    const q = encodeURIComponent(`${latitude},${longitude}`);
    return `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${q}&zoom=${zoom}`;
  }, [latitude, longitude, zoom]);

  const directionsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;

  if (!embedUrl) {
    return (
      <div
        className={`rounded-2xl border border-border-subtle bg-bg-surface p-5 text-center ${className ?? ""}`}
        style={{ minHeight: height }}
      >
        <p className="text-text-primary font-semibold">Map not available</p>
        <p className="text-text-muted mt-1 text-sm">
          {label ? `${label} is at ` : "This property is at "}
          {latitude.toFixed(5)}, {longitude.toFixed(5)}.
        </p>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rb-button rb-button--secondary mt-3 inline-flex"
        >
          Open in Google Maps
        </a>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl overflow-hidden border border-border-subtle ${className ?? ""}`}>
      <iframe
        title={label ? `Map of ${label}` : "Property map"}
        src={embedUrl}
        width="100%"
        height={height}
        style={{ border: 0, display: "block" }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  );
}
