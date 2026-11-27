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
  /** Optional href — when set, preview card / info-window links to this URL. */
  href?: string;
  /** Optional subtitle/address shown in the preview card / info window. */
  subtitle?: string;
  /** MKT-070: live all-in price label displayed inside the map pin pill and preview card. */
  priceLabel?: string;
  /** MKT-070: cover photo shown in the compact tap-to-preview card. */
  coverImageUrl?: string;
  /** MKT-070: average rating (only shown when >= 4.0 and reviewCount > 0). */
  rating?: number | null;
  /** MKT-070: review count paired with rating. */
  reviewCount?: number | null;
  /** MKT-070: property type label (e.g. Villa, Homestay, Hotel). */
  propertyType?: string;
  /** MKT-070: optional controlled selected state. */
  isSelected?: boolean;
}

export interface MapBounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

export interface MultiPinMapProps {
  pins: MapPin[];
  height?: number;
  className?: string;
  /** Fallback center when no pins (e.g. Hyderabad). */
  fallbackCenter?: { lat: number; lng: number; zoom?: number };
  /** MKT-048: fired when user pans or zooms the map to new visible bounds. */
  onBoundsChanged?: (bounds: MapBounds) => void;
  /** MKT-048: initial bounding box restored from URL on Back navigation. */
  initialBounds?: MapBounds | null;
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
  fallbackCenter = { lat: 17.4948, lng: 78.3996, zoom: 11 },
  onBoundsChanged,
  initialBounds = null,
}: MultiPinMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const programmaticMoveRef = useRef(false);
  const onBoundsChangedRef = useRef(onBoundsChanged);
  onBoundsChangedRef.current = onBoundsChanged;
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

  const apiKey = GOOGLE_MAPS_API_KEY;
  const validPins = useMemo(
    () => pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    [pins],
  );
  const selectedPin = useMemo(
    () => validPins.find((p) => p.id === selectedPinId || p.isSelected) ?? null,
    [validPins, selectedPinId],
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
        if (initialBounds) {
          programmaticMoveRef.current = true;
          const b = new window.google.maps.LatLngBounds(
            { lat: initialBounds.swLat, lng: initialBounds.swLng },
            { lat: initialBounds.neLat, lng: initialBounds.neLng },
          );
          map.fitBounds(b, 0);
        }
        map.addListener("idle", () => {
          if (programmaticMoveRef.current) {
            programmaticMoveRef.current = false;
            return;
          }
          const b = map.getBounds?.();
          if (!b || !onBoundsChangedRef.current) return;
          const sw = b.getSouthWest();
          const ne = b.getNorthEast();
          onBoundsChangedRef.current({
            swLat: Number(sw.lat().toFixed(6)),
            swLng: Number(sw.lng().toFixed(6)),
            neLat: Number(ne.lat().toFixed(6)),
            neLng: Number(ne.lng().toFixed(6)),
          });
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
      const isSelected = pin.id === selectedPinId || Boolean(pin.isSelected);
      let marker: any;

      if (pin.priceLabel && window.google?.maps?.marker?.AdvancedMarkerElement) {
        const pill = document.createElement("button");
        pill.type = "button";
        pill.textContent = pin.priceLabel;
        pill.setAttribute("data-testid", `map-price-pill-${pin.id}`);
        pill.style.cssText = [
          "padding:6px 10px",
          "border-radius:9999px",
          "font-size:12px",
          "font-weight:700",
          "line-height:1",
          "white-space:nowrap",
          "cursor:pointer",
          "box-shadow:0 2px 8px rgba(0,0,0,0.22)",
          "border:1px solid rgba(0,0,0,0.12)",
          isSelected
            ? "background:#111827;color:#ffffff;transform:scale(1.06);"
            : "background:#ffffff;color:#111827;",
        ].join(";");
        marker = new window.google.maps.marker.AdvancedMarkerElement({
          position: pos,
          map,
          title: pin.title,
          content: pill,
        });
        marker.addListener("click", () => {
          setSelectedPinId(pin.id);
        });
      } else {
        marker = new window.google.maps.Marker({
          position: pos,
          map,
          title: pin.priceLabel ? `${pin.title} · ${pin.priceLabel}` : pin.title,
          ...(pin.priceLabel
            ? {
                label: {
                  text: pin.priceLabel,
                  color: isSelected ? "#ffffff" : "#111827",
                  fontSize: "12px",
                  fontWeight: "700",
                },
              }
            : {}),
        });
        marker.addListener("click", () => {
          if (pin.priceLabel || pin.coverImageUrl) {
            setSelectedPinId(pin.id);
            return;
          }
          const linkHtml = pin.href
            ? `<a href="${pin.href}" style="color: var(--cta-primary, #1a73e8); font-weight: 600;">View details →</a>`
            : "";
          const subtitleHtml = pin.subtitle
            ? `<div style="margin-top: 4px; color: #555; font-size: 12px;">${pin.subtitle}</div>`
            : "";
          infoWindow.setContent(
            `<div style="font-family: inherit; min-width: 160px;"><div style="font-weight: 700;">${pin.title}</div>${subtitleHtml}<div style="margin-top: 6px;">${linkHtml}</div></div>`,
          );
          infoWindow.open({ map, anchor: marker });
        });
      }
      markersRef.current.push(marker);
      bounds.extend(pos);
    }

    if (!initialBounds) {
      if (validPins.length >= 2) {
        programmaticMoveRef.current = true;
        map.fitBounds(bounds, 64);
      } else if (validPins.length === 1) {
        programmaticMoveRef.current = true;
        map.setCenter({ lat: validPins[0].lat, lng: validPins[0].lng });
        map.setZoom(15);
      }
    }
  }, [validPins, status, initialBounds, selectedPinId]);

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
      className={`relative rounded-2xl overflow-hidden border border-border-subtle ${className ?? ""}`}
      style={{ height }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} aria-busy={status === "loading"} />
      {/* MKT-070: Compact photo, rating, and live all-in price preview card anchored inside the map */}
      {selectedPin && (
        <div
          data-testid="map-pin-preview-card"
          role="region"
          aria-label={selectedPin.title}
          className="absolute inset-x-3 bottom-3 z-20 mx-auto max-w-md rounded-2xl border border-border bg-bg-surface p-3 shadow-2xl"
        >
          <div className="flex items-center gap-3">
            {selectedPin.coverImageUrl && (
              <img
                src={selectedPin.coverImageUrl}
                alt={selectedPin.title}
                className="h-20 w-24 shrink-0 rounded-xl object-cover bg-bg-muted"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {selectedPin.propertyType && (
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                      {selectedPin.propertyType}
                    </p>
                  )}
                  <h3 className="truncate text-sm font-bold text-text-primary">{selectedPin.title}</h3>
                </div>
                <button
                  type="button"
                  aria-label="Close map preview"
                  data-testid="map-pin-preview-close"
                  onClick={() => setSelectedPinId(null)}
                  className="inline-flex h-11 w-11 -mr-1.5 -mt-1.5 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-bg-muted hover:text-text-primary"
                >
                  ✕
                </button>
              </div>
              {selectedPin.rating != null && selectedPin.rating >= 4 && (selectedPin.reviewCount ?? 0) > 0 && (
                <p className="mt-0.5 text-xs font-semibold text-amber-800" data-testid="map-pin-preview-rating">
                  ★ {selectedPin.rating.toFixed(1)} ({selectedPin.reviewCount})
                </p>
              )}
              <div className="mt-1.5 flex items-center justify-between gap-2">
                {selectedPin.priceLabel && (
                  <span className="text-sm font-bold text-text-primary" data-testid="map-pin-preview-price">
                    {selectedPin.priceLabel}
                  </span>
                )}
                {selectedPin.href && (
                  <a
                    href={selectedPin.href}
                    data-testid="map-pin-preview-link"
                    className="inline-flex min-h-[44px] items-center rounded-xl bg-black px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90"
                  >
                    View home
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
