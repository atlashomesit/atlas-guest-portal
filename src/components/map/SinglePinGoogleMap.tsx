import { useEffect, useMemo, useRef, useState } from "react";
import { GOOGLE_MAPS_API_KEY } from "@/config/googleMaps";
import OptimizedImage from "@/components/ui/OptimizedImage";
import { Button } from "@/components/ui/Button";
import { Typography } from "@/components/ui/Typography";
import { loadGoogleMapsJs } from "@/components/map/googleMapsJsLoader";

export interface SinglePinGoogleMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  markerTitle?: string;
  /** Tailwind height classes for the map frame (default matches listing detail layout). */
  heightClassName?: string;
  className?: string;
}

/**
 * TL-GUEST: Google Maps JavaScript API — same stack as LocationPage (single-pin path).
 * Used on listing detail “Where you’ll be” when coordinates exist from tenant or listing API.
 */
export default function SinglePinGoogleMap({
  lat,
  lng,
  zoom = 15,
  markerTitle,
  heightClassName = "h-64 sm:h-96",
  className,
}: SinglePinGoogleMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const hasInit = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [retryCount, setRetryCount] = useState(0);
  const apiKey = GOOGLE_MAPS_API_KEY;

  const staticMapUrl = useMemo(() => {
    if (!apiKey) return "/images/atlas-homestays-static-map.svg";
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=800x420&scale=2&markers=color:red%7C${lat},${lng}&key=${apiKey}`;
  }, [apiKey, lat, lng, zoom]);

  useEffect(() => {
    setStatus("loading");
    hasInit.current = false;
    if (!apiKey) {
      setStatus("failed");
      return;
    }
    let cancelled = false;
    loadGoogleMapsJs(apiKey)
      .then(() => {
        if (cancelled || hasInit.current) return;
        const el = mapRef.current;
        if (!el || !window.google?.maps?.Map || !window.google.maps.Marker) {
          if (!cancelled) setStatus("failed");
          return;
        }
        el.innerHTML = "";
        const map = new window.google.maps.Map(el, {
          center: { lat, lng },
          zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        new window.google.maps.Marker({
          position: { lat, lng },
          map,
          title: markerTitle,
        });
        hasInit.current = true;
        if (!cancelled) setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey, lat, lng, zoom, retryCount, markerTitle]);

  return (
    <div className={`relative bg-bg-muted ${className ?? ""}`}>
      <div
        ref={mapRef}
        aria-busy={status === "loading"}
        aria-live="polite"
        className={`w-full ${heightClassName} ${status === "failed" ? "pointer-events-none opacity-0 absolute inset-0" : ""}`}
      />

      {status === "loading" && (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg-muted ${heightClassName}`}
        >
          <Typography className="text-text-muted text-sm">Loading map…</Typography>
        </div>
      )}

      {status === "failed" && (
        <div className={`flex flex-col items-center justify-center gap-4 px-4 py-8 text-center ${heightClassName}`}>
          <OptimizedImage
            alt="Map preview"
            className="h-[180px] w-full max-w-2xl object-cover sm:h-[240px]"
            src={staticMapUrl}
            wrapperClassName="w-full max-w-2xl rounded-xl overflow-hidden border border-border-subtle"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <Button type="button" variant="secondary" onClick={() => setRetryCount((c) => c + 1)}>
              Retry loading map
            </Button>
            <a
              className="rb-button rb-button--secondary"
              href={`https://maps.google.com/?q=${lat},${lng}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              Open in Google Maps
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
