import { Navigate, useLocation, useParams } from "react-router-dom";
import { getTenantFilteredHomes } from "../../content/homes";
import { usePropertyListings } from "../../hooks/usePropertyListings";
import { buildHomeUnitPath, getPropertySlug } from "../../utils/navigation";

/**
 * TASK-5193 / TASK-5203: single-segment `/homes/:roomNo` used to render HomeDetails
 * (stock Unsplash hero + dead Reserve without slugs). Redirect to the canonical
 * two-segment property URL so PropertyDetails + UnitBookingWidget own the page.
 */
export default function LegacyHomeRoomRedirect() {
  const { roomNo } = useParams<{ roomNo: string }>();
  const location = useLocation();
  const { homes, listingsById, isLoading } = usePropertyListings();

  if (!roomNo?.trim()) {
    return <Navigate to="/" replace />;
  }

  const key = roomNo.trim();
  const fromApi = homes.find((h) => h.roomNo === key);
  if (fromApi?.href) {
    return <Navigate to={`${fromApi.href}${location.search}`} replace />;
  }

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading listing"
        className="mx-auto max-w-3xl p-8 text-sm text-text-muted"
      >
        Loading…
      </div>
    );
  }

  const listing = listingsById[key];
  if (listing) {
    const propertySlug = getPropertySlug({
      property_name: listing.propertyName,
      name: listing.name,
    });
    return (
      <Navigate
        to={`${buildHomeUnitPath(propertySlug, listing.id)}${location.search}`}
        replace
      />
    );
  }

  const staticHome = getTenantFilteredHomes().find((h) => h.roomNo === key);
  if (staticHome?.href) {
    return <Navigate to={`${staticHome.href}${location.search}`} replace />;
  }

  if (/^\d+$/.test(key)) {
    return (
      <Navigate
        to={`${buildHomeUnitPath("listing", Number(key))}${location.search}`}
        replace
      />
    );
  }

  return <Navigate to="/" replace />;
}
