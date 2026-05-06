import { useEffect, useMemo, useRef, useState } from "react";
import { GOOGLE_MAPS_API_KEY } from "../../config/googleMaps";

// TL-PROP: Multi-pin map. Used by LocationPage (multi-property tenants) and
// MarketplaceHomepage (all marketplace listings). Loads the Google Maps JS SDK
// once and renders one marker per pin. Auto-fits bounds when 2+ pins.

const MAP_SCRIPT_ID = "atlas-homestays-google-maps-script";

declare global {
  interface Window {
    google?: any;
  }
}

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  title: string;
  /** Optional href — when set, info-window content links to this URL. */
  href?: string;
  /** Optional subtitle/address shown in the info window. */
  subtitle?: string;
}

export interface MultiPinMapProps {
  pins: MapPin[];
  height?: number;
  className?: string;
  /** Fallback center when no pins (e.g. Hyderabad). */
  fallbackCenter?: { lat: number; lng: number; zoom?: number };
}

async function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps) return;
  const existing = document.getElementById(MAP_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Maps script failed")), { once: true });
      if (window.google?.maps) resolve();
    });
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = MAP_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Maps script failed")), { once: true });
    document.head.appendChild(script);
  });
}

export default function MultiPinMap({
  pins,
  height = 420,
  className,
  fallbackCenter = { lat: 17.385, lng: 78.487, zoom: 11 },
}: MultiPinMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  const apiKey = GOOGLE_MAPS_API_KEY;
  const validPins = useMemo(
    () => pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    [pins],
  );

  useEffect(() => {
    if (!apiKey) {
      setStatus("failed");
      return;
    }
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current || !window.google?.maps) return;
        const center = validPins[0]
          ? { lat: validPins[0].lat, lng: validPins[0].lng }
          : { lat: fallbackCenter.lat, lng: fallbackCenter.lng };
        const map = new window.google.maps.Map(containerRef.current, {
          center,
          zoom: validPins.length === 1 ? 15 : (fallbackCenter.zoom ?? 11),
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        mapRef.current = map;
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
    };
    // Boot map exactly once — pins are reflected in the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;

    // Clear previous markers.
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];

    if (validPins.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    const infoWindow = new window.google.maps.InfoWindow();

    for (const pin of validPins) {
      const pos = { lat: pin.lat, lng: pin.lng };
      const marker = new window.google.maps.Marker({
        position: pos,
        map,
        title: pin.title,
      });
      const linkHtml = pin.href
        ? `<a href="${pin.href}" style="color: var(--cta-primary, #1a73e8); font-weight: 600;">View details →</a>`
        : "";
      const subtitleHtml = pin.subtitle
        ? `<div style="margin-top: 4px; color: #555; font-size: 12px;">${pin.subtitle}</div>`
        : "";
      marker.addListener("click", () => {
        infoWindow.setContent(
          `<div style="font-family: inherit; min-width: 160px;"><div style="font-weight: 700;">${pin.title}</div>${subtitleHtml}<div style="margin-top: 6px;">${linkHtml}</div></div>`,
        );
        infoWindow.open({ map, anchor: marker });
      });
      markersRef.current.push(marker);
      bounds.extend(pos);
    }

    if (validPins.length >= 2) {
      map.fitBounds(bounds, 64);
    } else if (validPins.length === 1) {
      map.setCenter({ lat: validPins[0].lat, lng: validPins[0].lng });
      map.setZoom(15);
    }
  }, [validPins, status]);

  if (!apiKey || status === "failed") {
    return (
      <div
        className={`rounded-2xl border border-border-subtle bg-bg-surface p-6 text-center ${className ?? ""}`}
        style={{ minHeight: height }}
      >
        <p className="text-text-primary font-semibold">Map unavailable</p>
        <p className="text-text-muted text-sm mt-1">
          {validPins.length} location{validPins.length === 1 ? "" : "s"} configured.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl overflow-hidden border border-border-subtle ${className ?? ""}`}
      style={{ height }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} aria-busy={status === "loading"} />
    </div>
  );
}
