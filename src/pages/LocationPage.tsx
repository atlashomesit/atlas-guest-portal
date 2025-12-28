import { useEffect, useMemo, useRef, useState } from "react";
import SEO from "../components/SEO";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import OptimizedImage from "../components/ui/OptimizedImage";
import { Typography } from "../components/ui/Typography";
import { GOOGLE_MAPS_API_KEY } from "../config/googleMaps";

type GoogleMapsMapOptions = {
  center: { lat: number; lng: number };
  zoom: number;
  mapTypeControl?: boolean;
  streetViewControl?: boolean;
  fullscreenControl?: boolean;
};

type GoogleMapsMarkerOptions = {
  position: { lat: number; lng: number };
  map: unknown;
  title?: string;
};

declare global {
  interface Window {
    // The global object injected by the Google Maps JS API. We intentionally keep this loose to avoid a heavy type dependency.
    google?: {
      maps?: {
        Map: new (element: HTMLElement, options: GoogleMapsMapOptions) => unknown;
        Marker: new (options: GoogleMapsMarkerOptions) => unknown;
      };
    };
  }
}

const MAP_LOCATION = { lat: 17.4746, lng: 78.3872 } as const;
const MAP_SCRIPT_ID = "atlas-homestays-google-maps-script";
const FALLBACK_STATIC_MAP_URL = "/images/atlas-homestays-static-map.svg";

const transportOptions = [
  {
    title: "Metro",
    details: "Kukatpally and KPHB Colony Metro stations are within a 10-15 minute drive for quick access across the city.",
  },
  {
    title: "Airport",
    details: "Rajiv Gandhi International Airport is about 45 minutes away via ORR, with reliable cab availability day and night.",
  },
  {
    title: "Road connectivity",
    details: "Easy access to Mumbai Highway, JNTU Road, and the ORR for commuting towards Hitech City, Gachibowli, or BHEL.",
  },
];

const nearbyAmenities = [
  {
    title: "Daily essentials",
    details: "Supermarkets, pharmacies, and local bakeries within a 5-10 minute drive for everyday needs.",
  },
  {
    title: "Dining",
    details: "A mix of local eateries and popular chains around Kukatpally, JNTU, and KPHB for quick meals or dine-in plans.",
  },
  {
    title: "Healthcare",
    details: "Multi-specialty hospitals and clinics nearby to handle routine visits and emergencies.",
  },
];

const landmarks = [
  {
    title: "Business hubs",
    details: "Proximity to Hitech City, Gachibowli, and Financial District for tech parks and corporate offices.",
  },
  {
    title: "Education",
    details: "Universities and colleges around Kukatpally and Miyapur, with straightforward commutes by metro or cab.",
  },
  {
    title: "Leisure",
    details: "Shopping streets, malls, and cinemas across KPHB, Miyapur, and Kukatpally for entertainment.",
  },
];

const createStaticMapUrl = (apiKey?: string) =>
  apiKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${MAP_LOCATION.lat},${MAP_LOCATION.lng}&zoom=15&size=800x420&scale=2&markers=color:red%7C${MAP_LOCATION.lat},${MAP_LOCATION.lng}&key=${apiKey}`
    : FALLBACK_STATIC_MAP_URL;

type MapStatus = "loading" | "ready" | "failed";

const LocationPage = () => {
  const [mapStatus, setMapStatus] = useState<MapStatus>("loading");
  const [, setErrorDetails] = useState<string | null>(null);
  const [, setMapHealth] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedMap = useRef(false);
  const apiKey = GOOGLE_MAPS_API_KEY;
  const staticMapUrl = useMemo(() => createStaticMapUrl(apiKey), [apiKey]);

  const logMapFailure = (message: string, detail?: unknown) => {
    // Surface detailed failure information for monitoring.
    console.error(`[LocationPage] ${message}`, detail);
  };

  const initializeMap = () => {
    if (hasInitializedMap.current) return;

    const mapContainer = mapContainerRef.current;

    if (!window.google?.maps?.Map || !window.google.maps.Marker) {
      throw new Error("Google Maps library unavailable after script load");
    }

    if (!mapContainer) {
      throw new Error("Map container missing during initialization");
    }

    // Clear any previous map nodes before re-initializing.
    mapContainer.innerHTML = "";

    const map = new window.google.maps.Map(mapContainer, {
      center: MAP_LOCATION,
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    new window.google.maps.Marker({
      position: MAP_LOCATION,
      map,
      title: "Atlas Homestays",
    });

    hasInitializedMap.current = true;
    setMapStatus("ready");
    setMapHealth(null);
  };

  useEffect(() => {
    setMapStatus("loading");
    setErrorDetails(null);
    setMapHealth(null);
    hasInitializedMap.current = false;

    if (!apiKey) {
      const message = "Google Maps API key is missing";
      logMapFailure(message);
      setErrorDetails(null); // Don't expose technical details to users
      setMapHealth("missing-api-key");
      setMapStatus("failed");
      return;
    }

    if (window.google?.maps) {
      try {
        initializeMap();
      } catch (initializationError) {
        logMapFailure("Failed to initialize Google Maps with an existing library", initializationError);
        setErrorDetails("We could not load the interactive map just yet.");
        setMapStatus("failed");
        setMapHealth("initialization-failed");
      }
      return;
    }

    const existingScript = document.getElementById(MAP_SCRIPT_ID);
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement("script");
    script.id = MAP_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;

    const handleLoad = () => {
      try {
        initializeMap();
      } catch (initializationError) {
        logMapFailure("Google Maps library loaded but initialization failed", initializationError);
        setErrorDetails("We could not load the interactive map just yet.");
        setMapStatus("failed");
        setMapHealth("initialization-failed");
      }
    };

    const handleError = (event: ErrorEvent | Event) => {
      console.log("[LocationPage] Map script failed, switching to static preview");
      logMapFailure("Failed to load Google Maps script", event);
      setErrorDetails("Google Maps could not be reached right now.");
      setMapStatus("failed");
      setMapHealth("script-failed");
    };

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    document.head.appendChild(script);

    return () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, [apiKey, retryCount]);

  return (
    <div className="px-4 md:px-10 lg:px-20 py-16 bg-bg-muted">
      <SEO
        title="Location & Neighborhood | Atlas Homestays"
        description="Discover the Kukatpally neighborhood, access routes, and nearby essentials for Atlas Homestays."
      />

      <div className="max-w-6xl mx-auto space-y-12">
        <header className="space-y-3 text-center">
          <Typography variant="subtitle" className="uppercase tracking-[0.2em] text-primary font-semibold">
            Atlas Homestays
          </Typography>
          <Typography as="h1" variant="h1" className="text-text-primary">
            Location & Neighborhood
          </Typography>
          <Typography className="text-text-muted text-lg">
            Find transport options, nearby dining, shopping, and corporate hubs close to Atlas Homestays so you can plan your
            arrival and daily commute with ease.
          </Typography>
        </header>

        <Card className="p-0 overflow-hidden shadow-level2">
          <div className="relative bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden">
            <div className="relative h-[280px] md:h-[420px]">
              {/* Map health indicator removed - no need to show technical status to guests */}

              <div
                aria-busy={mapStatus === "loading"}
                aria-live="polite"
                className={`absolute inset-0 ${mapStatus === "failed" ? "pointer-events-none opacity-0" : "opacity-100"}`}
                ref={mapContainerRef}
              />

              {mapStatus === "loading" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[color:color-mix(in_srgb,var(--bg-surface)_90%,transparent)]">
                  <div className="h-24 w-24 rounded-full bg-[color:color-mix(in_srgb,var(--border-subtle)_70%,transparent)] animate-pulse" aria-hidden />
                  <div className="space-y-2 text-center px-6">
                    <Typography as="p" className="text-text-primary font-semibold">
                      Loading map
                    </Typography>
                    <Typography className="text-text-muted">
                      Fetching directions and landmarks around Atlas Homestays.
                    </Typography>
                  </div>
                </div>
              )}

              {mapStatus === "failed" && (
                <div className="absolute inset-0 flex flex-col gap-4 items-center justify-center bg-bg-surface text-center p-6">
                  {staticMapUrl ? (
                    <OptimizedImage
                      alt="Static map preview of Atlas Homestays"
                      className="h-[180px] w-full object-cover md:h-[240px]"
                      src={staticMapUrl}
                      wrapperClassName="w-full max-w-2xl rounded-xl overflow-hidden border border-border-subtle"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                        logMapFailure("Static map preview failed to load", event);
                      }}
                    />
                  ) : null}

                  <div className="space-y-2 max-w-xl">
                    <Typography as="p" className="text-text-primary font-semibold">
                      View on Google Maps
                    </Typography>
                    <Typography className="text-text-muted">
                      Click below to open our location in Google Maps for directions and nearby landmarks.
                    </Typography>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 items-center">
                    <Button onClick={() => setRetryCount((count) => count + 1)}>Retry loading map</Button>
                    <a
                      className="rb-button rb-button--secondary"
                      href={`https://maps.google.com/?q=${MAP_LOCATION.lat},${MAP_LOCATION.lng}`}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="space-y-3 h-full">
            <Typography as="h2" variant="h2" className="text-text-primary">
              Transport options
            </Typography>
            <div className="space-y-3">
              {transportOptions.map((option) => (
                <div key={option.title} className="space-y-1">
                  <Typography as="h3" variant="h3" className="text-text-primary">
                    {option.title}
                  </Typography>
                  <Typography className="text-text-muted">{option.details}</Typography>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-3 h-full">
            <Typography as="h2" variant="h2" className="text-text-primary">
              Nearby amenities
            </Typography>
            <div className="space-y-3">
              {nearbyAmenities.map((amenity) => (
                <div key={amenity.title} className="space-y-1">
                  <Typography as="h3" variant="h3" className="text-text-primary">
                    {amenity.title}
                  </Typography>
                  <Typography className="text-text-muted">{amenity.details}</Typography>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="space-y-3">
          <Typography as="h2" variant="h2" className="text-text-primary">
            Landmarks & proximity
          </Typography>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {landmarks.map((landmark) => (
              <div key={landmark.title} className="space-y-1">
                <Typography as="h3" variant="h3" className="text-text-primary">
                  {landmark.title}
                </Typography>
                <Typography className="text-text-muted">{landmark.details}</Typography>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LocationPage;
