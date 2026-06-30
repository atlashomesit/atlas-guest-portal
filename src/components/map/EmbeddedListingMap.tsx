import { useEffect, useMemo, useState } from "react";
import { GOOGLE_MAPS_API_KEY } from "../../config/googleMaps";
import { isMapsAuthFailed, MAPS_AUTH_FAILURE_EVENT } from "./googleMapsJsLoader";

// TL-PROP: Single-pin map for listing detail pages. Uses Google Maps Embed API
// (iframe) to avoid loading the full JS SDK on this lightweight page. Falls back
// to a static address text + "View on Google Maps" link when no API key is
// configured, coordinates are missing, or the Maps key has billing disabled
// (BillingNotEnabledMapError).

export interface EmbeddedListingMapProps {
  latitude: number;
  longitude: number;
  /** Title of the property/listing — shown in fallback link copy. */
  label?: string;
  /** Human-readable address shown in the graceful fallback. */
  address?: string;
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
  address,
  zoom = 15,
  height = 320,
  className,
}: EmbeddedListingMapProps) {
  // Switch to graceful fallback if gm_authFailure fires (billing not enabled).
  const [authFailed, setAuthFailed] = useState<boolean>(() => isMapsAuthFailed());

  useEffect(() => {
    if (authFailed) return;
    const handler = () => setAuthFailed(true);
    window.addEventListener(MAPS_AUTH_FAILURE_EVENT, handler);
    return () => window.removeEventListener(MAPS_AUTH_FAILURE_EVENT, handler);
  }, [authFailed]);

  const embedUrl = useMemo(() => {
    if (!GOOGLE_MAPS_API_KEY || authFailed) return null;
    const q = encodeURIComponent(`${latitude},${longitude}`);
    return `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${q}&zoom=${zoom}`;
  }, [latitude, longitude, zoom, authFailed]);

  const directionsUrl = address
    ? `https://maps.google.com/?q=${encodeURIComponent(address)}`
    : `https://maps.google.com/?q=${latitude},${longitude}`;

  if (!embedUrl) {
    return (
      <div
        className={`rounded-2xl border border-border-subtle bg-bg-surface p-5 text-center ${className ?? ""}`}
        style={{ minHeight: height }}
      >
        <p className="text-text-primary font-semibold">
          {label ?? "This property"}
        </p>
        {address ? (
          <p className="text-text-muted mt-1 text-sm">{address}</p>
        ) : (
          <p className="text-text-muted mt-1 text-sm">
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </p>
        )}
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rb-button rb-button--secondary mt-3 inline-flex"
        >
          View on Google Maps
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
