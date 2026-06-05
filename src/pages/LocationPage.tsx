import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SEO from "../components/SEO";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import OptimizedImage from "../components/ui/OptimizedImage";
import { Typography } from "../components/ui/Typography";
import { GOOGLE_MAPS_API_KEY } from "../config/googleMaps";
import { getTenantOverrides } from "../tenant/tenantOverrides";
import { getTenantBrandName } from "../tenant/displayBrand";
import { getTenantContext } from "../tenant/tenantContext";
import MultiPinMap, { type MapPin } from "../components/map/MultiPinMap";
import { usePropertyListings } from "../hooks/usePropertyListings";

const MAP_SCRIPT_ID = "atlas-homestays-google-maps-script";
const FALLBACK_STATIC_MAP_URL = "/images/atlas-homestays-static-map.svg";

type MapStatus = "loading" | "ready" | "failed";

const LocationPage = () => {
  const tenant = getTenantContext();
  const overrides = getTenantOverrides(tenant?.slug);
  // TL-GUEST: API-sourced location (set by host via admin picker) wins over the static override.
  const mapLocation = tenant?.mapLocation ?? overrides.mapLocation;
  const locationContent = useMemo(() => {
    const fallback = overrides.locationContent;
    const fromApi = tenant?.locationContent;
    if (!fallback && !fromApi) return undefined;
    return {
      subtitle: fromApi?.subtitle ?? fallback?.subtitle,
      transport: fromApi?.transport?.length ? fromApi.transport : fallback?.transport,
      nearbyAmenities: fromApi?.nearbyAmenities?.length
        ? fromApi.nearbyAmenities
        : fallback?.nearbyAmenities,
      landmarks: fromApi?.landmarks?.length ? fromApi.landmarks : fallback?.landmarks,
    };
  }, [overrides.locationContent, tenant?.locationContent]);
  const tenantName = getTenantBrandName();

  // TL-PROP: aggregate per-property pins. When the tenant has 2+ properties with lat/lng,
  // we render a multi-pin map; otherwise we fall back to the single tenant pin below.
  const { listingsById } = usePropertyListings();
  const propertyPins = useMemo<MapPin[]>(() => {
    const seen = new Map<number, MapPin>();
    for (const l of Object.values(listingsById)) {
      const lat = typeof l.latitude === "number" ? l.latitude : null;
      const lng = typeof l.longitude === "number" ? l.longitude : null;
      if (lat == null || lng == null) continue;
      const propertyId = l.propertyId;
      if (propertyId == null) continue;
      if (seen.has(propertyId)) continue;
      seen.set(propertyId, {
        id: `property-${l.propertyId}`,
        lat,
        lng,
        title: l.propertyName?.trim() || `Property ${l.propertyId}`,
        subtitle: l.propertyAddress ?? undefined,
      });
    }
    return Array.from(seen.values());
  }, [listingsById]);
  const useMultiPin = propertyPins.length >= 2;

  const [mapStatus, setMapStatus] = useState<MapStatus>("loading");
  const [, setErrorDetails] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedMap = useRef(false);
  const apiKey = GOOGLE_MAPS_API_KEY;

  const staticMapUrl = useMemo(() => {
    if (!mapLocation) return FALLBACK_STATIC_MAP_URL;
    return apiKey
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${mapLocation.lat},${mapLocation.lng}&zoom=${mapLocation.zoom ?? 15}&size=800x420&scale=2&markers=color:red%7C${mapLocation.lat},${mapLocation.lng}&key=${apiKey}`
      : FALLBACK_STATIC_MAP_URL;
  }, [apiKey, mapLocation]);

  const logMapFailure = (message: string, detail?: unknown) => {
    console.error(`[LocationPage] ${message}`, detail);
  };

  const initializeMap = useCallback(() => {
    if (hasInitializedMap.current) return;
    if (!mapLocation) throw new Error("No map coordinates configured for this tenant");

    const mapContainer = mapContainerRef.current;
    if (!window.google?.maps?.Map || !window.google.maps.Marker) {
      throw new Error("Google Maps library unavailable after script load");
    }
    if (!mapContainer) {
      throw new Error("Map container missing during initialization");
    }

    mapContainer.innerHTML = "";

    const map = new window.google.maps.Map(mapContainer, {
      center: { lat: mapLocation.lat, lng: mapLocation.lng },
      zoom: mapLocation.zoom ?? 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    new window.google.maps.Marker({
      position: { lat: mapLocation.lat, lng: mapLocation.lng },
      map,
      title: mapLocation.markerLabel ?? tenantName,
    });

    hasInitializedMap.current = true;
    setMapStatus("ready");
  }, [mapLocation, tenantName]);

  useEffect(() => {
    setMapStatus("loading");
    setErrorDetails(null);
    hasInitializedMap.current = false;

    // TL-PROP: when MultiPinMap is rendering, the single-pin container is unmounted —
    // skip the legacy script-loading path entirely.
    if (useMultiPin) return;

    if (!mapLocation) {
      setMapStatus("failed");
      return;
    }

    if (!apiKey) {
      logMapFailure("Google Maps API key is missing");
      setMapStatus("failed");
      return;
    }

    if (window.google?.maps) {
      try {
        initializeMap();
      } catch (err) {
        logMapFailure("Failed to initialize Google Maps with an existing library", err);
        setMapStatus("failed");
      }
      return;
    }

    const existingScript = document.getElementById(MAP_SCRIPT_ID);
    if (existingScript) existingScript.remove();

    const script = document.createElement("script");
    script.id = MAP_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;

    const handleLoad = () => {
      try {
        initializeMap();
      } catch (err) {
        logMapFailure("Google Maps library loaded but initialization failed", err);
        setMapStatus("failed");
      }
    };

    const handleError = (event: ErrorEvent | Event) => {
      if (import.meta.env.DEV) console.log("[LocationPage] Map script failed, switching to static preview");
      logMapFailure("Failed to load Google Maps script", event);
      setMapStatus("failed");
    };

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    document.head.appendChild(script);

    return () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, [apiKey, retryCount, mapLocation, useMultiPin, initializeMap]);

  return (
    <div className="px-4 md:px-10 lg:px-20 py-16 bg-bg-muted">
      <SEO
        title={`Location & Neighborhood | ${tenantName}`}
        description={`Discover the neighborhood, access routes, and nearby essentials for ${tenantName}.`}
      />

      <div className="max-w-6xl mx-auto space-y-12">
        <header className="space-y-3 text-center">
          <Typography as="h1" variant="h1" className="text-text-primary">
            Location & Neighborhood
          </Typography>
          {locationContent?.subtitle && (
            <Typography className="text-text-muted text-lg">
              {locationContent.subtitle}
            </Typography>
          )}
        </header>

        {useMultiPin ? (
          <Card className="p-0 overflow-hidden shadow-level2">
            <div className="p-4 border-b border-border-subtle">
              <Typography as="p" className="text-text-primary font-semibold">
                Our properties ({propertyPins.length})
              </Typography>
              <Typography className="text-text-muted text-sm">
                Click a pin for details. Each marker is a separate property.
              </Typography>
            </div>
            <MultiPinMap pins={propertyPins} height={420} />
          </Card>
        ) : mapLocation ? (
          <Card className="p-0 overflow-hidden shadow-level2">
            <div className="relative bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden">
              <div className="relative h-[280px] md:h-[420px]">
                <div
                  aria-busy={mapStatus === "loading"}
                  aria-live="polite"
                  className={`absolute inset-0 ${mapStatus === "failed" ? "pointer-events-none opacity-0" : "opacity-100"}`}
                  ref={mapContainerRef}
                />

                {mapStatus === "loading" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[color:color-mix(in_srgb,var(--bg-surface)_90%,transparent)]">
                    <div className="h-24 w-24 rounded-full bg-[color:color-mix(in_srgb,var(--border-subtle)_70%,transparent)]" aria-hidden />
                    <div className="space-y-2 text-center px-6">
                      <Typography as="p" className="text-text-primary font-semibold">
                        Loading map
                      </Typography>
                      <Typography className="text-text-muted">
                        Fetching directions and landmarks around {tenantName}.
                      </Typography>
                    </div>
                  </div>
                )}

                {mapStatus === "failed" && (
                  <div className="absolute inset-0 flex flex-col gap-4 items-center justify-center bg-bg-surface text-center p-6">
                    {staticMapUrl !== FALLBACK_STATIC_MAP_URL && (
                      <OptimizedImage
                        alt={`Static map preview of ${tenantName}`}
                        className="h-[180px] w-full object-cover md:h-[240px]"
                        src={staticMapUrl}
                        wrapperClassName="w-full max-w-2xl rounded-xl overflow-hidden border border-border-subtle"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                          logMapFailure("Static map preview failed to load", event);
                        }}
                      />
                    )}

                    <div className="space-y-2 max-w-xl">
                      <Typography as="p" className="text-text-primary font-semibold">
                        View on Google Maps
                      </Typography>
                      <Typography className="text-text-muted">
                        Click below to open our location in Google Maps for directions and nearby landmarks.
                      </Typography>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                      <Button onClick={() => setRetryCount((c) => c + 1)}>Retry loading map</Button>
                      <a
                        className="rb-button rb-button--secondary"
                        href={`https://maps.google.com/?q=${mapLocation.lat},${mapLocation.lng}`}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Open in Google Maps
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="flex items-center justify-center py-16 text-center">
            <Typography className="text-text-muted">
              Map location not configured for this property.
            </Typography>
          </Card>
        )}

        {locationContent && (
          <>
            {(locationContent.transport?.length || locationContent.nearbyAmenities?.length) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {locationContent.transport?.length ? (
                  <Card className="space-y-3 h-full">
                    <Typography as="h2" variant="h2" className="text-text-primary">
                      Transport options
                    </Typography>
                    <div className="space-y-3">
                      {locationContent.transport.map((item) => (
                        <div key={item.title} className="space-y-1">
                          <Typography as="h3" variant="h3" className="text-text-primary">
                            {item.title}
                          </Typography>
                          <Typography className="text-text-muted">{item.details}</Typography>
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : null}

                {locationContent.nearbyAmenities?.length ? (
                  <Card className="space-y-3 h-full">
                    <Typography as="h2" variant="h2" className="text-text-primary">
                      Nearby amenities
                    </Typography>
                    <div className="space-y-3">
                      {locationContent.nearbyAmenities.map((item) => (
                        <div key={item.title} className="space-y-1">
                          <Typography as="h3" variant="h3" className="text-text-primary">
                            {item.title}
                          </Typography>
                          <Typography className="text-text-muted">{item.details}</Typography>
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : null}
              </div>
            ) : null}

            {locationContent.landmarks?.length ? (
              <Card className="space-y-3">
                <Typography as="h2" variant="h2" className="text-text-primary">
                  Landmarks & proximity
                </Typography>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {locationContent.landmarks.map((item) => (
                    <div key={item.title} className="space-y-1">
                      <Typography as="h3" variant="h3" className="text-text-primary">
                        {item.title}
                      </Typography>
                      <Typography className="text-text-muted">{item.details}</Typography>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};

export default LocationPage;
