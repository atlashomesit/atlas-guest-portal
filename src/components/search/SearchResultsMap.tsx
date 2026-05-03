import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import type { LatLngExpression } from "leaflet";

import { HYDERABAD_CENTER, hasMapCoords, fallbackCoordsForListing } from "../../utils/mapCoords";

import "leaflet/dist/leaflet.css";

export type SearchMapUnit = {
  numericId: number;
  title: string;
  pricePerNight: number;
  canonicalPath: string;
  latitude: number;
  longitude: number;
};

function resolvePosition(u: SearchMapUnit): LatLngExpression {
  if (hasMapCoords(u.latitude, u.longitude)) return [u.latitude, u.longitude];
  const fb = fallbackCoordsForListing(u.numericId);
  return [fb.lat, fb.lng];
}

function usedApiCoords(u: SearchMapUnit): boolean {
  return hasMapCoords(u.latitude, u.longitude);
}

function makePriceIcon(price: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:#0f766e;color:#fff;padding:2px 6px;border-radius:12px;font-size:12px;font-weight:600;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.3)">${price}</div>`,
    iconAnchor: [28, 12],
  });
}

function FitBounds({ positions }: { positions: LatLngExpression[] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      const p = positions[0];
      const lat = Array.isArray(p) ? p[0] : (p as { lat: number }).lat;
      const lng = Array.isArray(p) ? p[1] : (p as { lng: number }).lng;
      map.setView([lat, lng], 13);
      return;
    }
    const latLngs = positions.map((p) => {
      if (Array.isArray(p)) return [p[0], p[1]] as [number, number];
      return [(p as { lat: number }).lat, (p as { lng: number }).lng] as [number, number];
    });
    map.fitBounds(latLngs, { padding: [48, 48], maxZoom: 14 });
  }, [map, positions]);
  return null;
}

type SearchResultsMapProps = {
  units: SearchMapUnit[];
  formatPrice: (amount: number) => string;
  querySuffix: string;
  /** True when at least one API-backed listing lacked coordinates (pins use fallback). */
  approximatePinHint?: boolean;
};

const MAX_MARKERS = 100;

/**
 * TASK-1457: OSM map with price-labelled markers.
 * TASK-1713: Marker clustering at low zoom; price labels on each pin.
 * Listings without API coordinates still appear using deterministic fallback pins.
 */
export default function SearchResultsMap({ units, formatPrice, querySuffix }: SearchResultsMapProps) {
  const capped = useMemo(() => units.slice(0, MAX_MARKERS), [units]);
  const positions = useMemo(() => capped.map((u) => resolvePosition(u)), [capped]);
  const withApiCoords = useMemo(() => capped.filter(usedApiCoords).length, [capped]);
  const center: LatLngExpression = [HYDERABAD_CENTER.lat, HYDERABAD_CENTER.lng];

  return (
    <div className="flex flex-col gap-2" data-testid="search-results-map">
      {withApiCoords < capped.length ? (
        <p className="text-xs text-text-muted">
          {withApiCoords === 0
            ? `Showing ${capped.length} homes with approximate map pins (set property coordinates in Atlas for exact locations).`
            : `${withApiCoords} of ${capped.length} with exact coordinates; others use approximate pins.`}
        </p>
      ) : null}
      <div
        className="relative z-0 min-h-[50vh] w-full overflow-hidden rounded-2xl border border-border-subtle md:min-h-[60vh]"
        style={{ height: "min(60vh, 520px)" }}
      >
        <MapContainer
          center={center}
          zoom={12}
          className="h-full w-full [&_.leaflet-container]:h-full [&_.leaflet-container]:min-h-[50vh] [&_.leaflet-container]:rounded-2xl"
          scrollWheelZoom
          aria-label="Search results map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds positions={positions.length ? positions : [center]} />
          <MarkerClusterGroup chunkedLoading>
            {capped.map((u) => (
              <Marker
                key={`m-${u.numericId}`}
                position={resolvePosition(u)}
                icon={makePriceIcon(formatPrice(u.pricePerNight))}
              >
                <Popup>
                  <div className="min-w-[10rem] space-y-1 text-sm text-text-primary">
                    <p className="m-0 font-semibold">{u.title}</p>
                    <p className="m-0 text-text-muted">
                      {formatPrice(u.pricePerNight)}
                      <span className="text-xs"> / night</span>
                    </p>
                    <Link
                      to={`${u.canonicalPath}${querySuffix}`}
                      className="inline-block font-medium text-cta-primary underline"
                    >
                      View home
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>
    </div>
  );
}
