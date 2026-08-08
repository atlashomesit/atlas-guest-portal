import './Homepage_PropertyDetails.css';
import React from 'react';
import { toast } from 'react-toastify'; // TASK-4288: share fallback feedback
import { getListingDisplayName } from '@/lib/listingDisplayName';
import { getTenantContext as _getTenantCtx } from '@/tenant/tenantContext';
import { hasOnlinePaymentRail } from '@/tenant/paymentRail';
import { getTenantOverrides, shouldHideAtlasBranding } from '@/tenant/tenantOverrides';
import { getTenantBrandName } from '@/tenant/displayBrand';
import { getGuestFacingPhone } from '@/config/contact';
import { REFUND_INITIATED_STEP_DESC, REFUND_SETTLEMENT_STEP_DESC } from '@/config/refundPolicyTimelines';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { FaBed, FaShower, FaSwimmingPool, FaCar, FaWifi, FaTv, FaDumbbell } from "react-icons/fa";
import { TbAirConditioning } from "react-icons/tb";
import { PiElevatorDuotone, PiCoatHangerLight } from "react-icons/pi";
import { RiLuggageCartLine } from "react-icons/ri";
import { TfiBrushAlt } from "react-icons/tfi";
import { LiaNewspaper } from "react-icons/lia";
import { MdOutlineEmojiFoodBeverage, MdOutlineLocalLaundryService, MdOutlineDone } from "react-icons/md";
import { FaCcMastercard } from "react-icons/fa6";
import { X, ShieldCheck, CalendarClock, CreditCard } from 'lucide-react';
import { useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { useTenantListings } from '../../../hooks/useTenantListings';
import { usePropertyListings } from '../../../hooks/usePropertyListings';
import { inlinePolicySnippets } from '../../../content/terms';
import { trackEvent } from '../../../utils/analytics';
import { Button } from '../../ui/Button';
import { calculateNightlyPrice, inferUnitType } from '../../../utils/pricing';
import { buildHomeUnitPath, getPropertySlug } from '../../../utils/navigation';
import { propertySlugMatchesListing } from '../../../utils/propertySlugMatch';
import { useBooking } from '../../../contexts/BookingContext';
import { resolveListing } from '../../../utils/listingResolver';
import { filterGuestImageUrls, sanitizeGuestImageUrl } from '../../../utils/guestImageUrl';
import { describeCancellationPolicy } from '../../../utils/cancellationPolicy';
import type { ListingDetail, PublicListing } from '../../../api/listingClient';
import {
    fetchListingById,
    fetchListingContact,
    parseMaxGuestsFromPayload,
    resolveStaticMaxGuests,
} from '../../../api/listingClient';
import SEO from '../../SEO';
import StateMessage from '../../StateMessage';
import MultiPinMap, { type MapPin } from '../../map/MultiPinMap';
import SinglePinGoogleMap from '../../map/SinglePinGoogleMap';
import { selectPropertyMapMode } from './propertyMapMode';
import { buildApiUrl, getApiHeaders } from '../../../api/client';
import { addRecentlyViewed, isFavorite, toggleFavorite } from '../../../utils/guestHistory';
import { useDailyPricingSummary } from '@/hooks/useDailyPricingSummary';
import SkeletonCard from '../../apartments/SkeletonCard';
import PropertyMobileStickyBar from '@/components/property/PropertyMobileStickyBar';
import HostAboutNote from '@/components/property/HostAboutNote';
import type { BookingStickySummary } from '@/components/availability/UnitBookingWidget';

const UnitBookingWidget = lazy(() => import('../../availability/UnitBookingWidget'));
const AvailabilityCalendar = lazy(() => import('../../AvailabilityCalendar'));
const GuestAssistant = lazy(() => import('../../GuestAssistant')); // TASK-1728
const VirtualTourSection = lazy(() => import('../../VirtualTourSection')); // Task 37
const ReviewSummary = lazy(() => import('../../ReviewSummary')); // TASK-4404

interface PropertyAmenity {
    amenities_icon: string;
}

interface PropertyDetail {
    type: string;
    value: string;
}

// ---- Inline SVG atoms (pp-* design system) ----------------------------------

function PpCheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function PpShieldIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function PpWhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

function PpChevronDown({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// ---- v2 Things-to-know icons -------------------------------------------
function PpV2UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
}
function PpV2ClockInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
    </svg>
  );
}
function PpV2ClockOutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l-3 2"/>
    </svg>
  );
}
function PpV2PinIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  );
}

function PpGridIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

// ---- Cancellation helpers (pp-* design system) ------------------------------

const PP_REFUND_STEPS = [
  { title: 'Cancel from your booking', desc: 'One tap from your booking confirmation. No reason needed.' },
  { title: 'Refund initiated', desc: REFUND_INITIATED_STEP_DESC },
  { title: 'Money in your account', desc: REFUND_SETTLEMENT_STEP_DESC },
  { title: 'Confirmation', desc: 'SMS and WhatsApp when the refund clears. Both.' },
];

interface PpCancellationInfo {
  headline: string;
  description: string;
  steps: Array<{ title: string; desc: string }>;
}

function getPpRefundSteps(hasOnlinePayment: boolean): Array<{ title: string; desc: string }> {
  if (!hasOnlinePayment) {
    return [
      { title: 'Cancel from your booking', desc: 'One tap from your booking confirmation. No reason needed.' },
      { title: 'Refund with your host', desc: 'Your host confirms the refund amount and timing directly with you.' },
      { title: 'Money returned', desc: 'UPI or bank transfer as arranged with the host — timing varies.' },
      { title: 'Confirmation', desc: 'Your host or our team confirms when the refund is complete.' },
    ];
  }
  return PP_REFUND_STEPS;
}

// TASK-7012 (founder ruling, 2026-08-03): this panel deliberately says NOTHING about the universal
// grace window — it takes no `graceHours`. It renders with no selected check-in date, so there is
// nothing to void against, and atlas-api VOIDS the grace window when check-in falls inside it from
// booking time (`CancellationPolicyWindow.ComputeEffectiveFreeCancellationDeadlineUtc`): a same-day
// or next-day booker gets NO grace refund. A listing-level `graceHours` means the FEATURE is enabled
// for that listing, not that this guest's dates qualify — so the TASK-4405 disclosure here, which
// promised a free post-booking window irrespective of the tier policy, was an unconditional promise
// the engine does not keep. The grace window is now disclosed ONLY by the booking widget's grace strip,
// which gates on `resolveApplicableGraceHours` once the guest has picked real dates.
// Do not re-add a grace sentence here without a date-gated value to compute it from.
function getPpCancellationInfo(
  tier: string | null | undefined,
  opts?: { fallbackText?: string; hasOnlinePayment?: boolean },
): PpCancellationInfo {
  const steps = getPpRefundSteps(opts?.hasOnlinePayment !== false);
  const policyInfo = describeCancellationPolicy(tier);

  // TASK-7539: all tiers now read from the single source of truth.
  // Flexible (0% fee): afterWindowCopy is empty, so headline alone suffices.
  // Moderate/Strict: append the after-window sentence for clarity.
  const description =
    tier === 'Flexible'
      ? (opts?.hasOnlinePayment !== false
          ? 'Money returns to the exact UPI or card you paid with. No phone calls needed.'
          : 'Your host arranges the refund directly with you.')
      : policyInfo.afterWindowCopy
        ? `${policyInfo.afterWindowCopy} Check your booking for exact terms.`
        : 'Check your booking for exact terms.';

  if (opts?.fallbackText?.trim()) {
    return {
      headline: 'Cancellation policy',
      description: opts.fallbackText.trim(),
      steps,
    };
  }

  return {
    headline: policyInfo.headline,
    description,
    steps,
  };
}

const PP_REVIEW_BG_COLORS = ['#4a3535', '#f08c71', '#b8472f', '#94755b', '#e9f5ef'];
const PP_REVIEW_TEXT_COLORS = ['#fff8e7', '#4a3535', '#fff8e7', '#fff8e7', '#157046'];

/** Shown while listing data is resolving (incl. API fallback). Matches loaded page layout for perceived performance. */
function PropertyDetailsSkeleton() {
    return (
        <section
            className="w-full pt-28 md:pt-0 tracking-wide"
            data-testid="property-details-skeleton"
            aria-busy="true"
            aria-label="Loading property details"
        >
            <div className="pt-10 pl-32">
                <div className="h-4 w-32 rounded bg-bg-muted" />
            </div>
            <div className="max-w-[85rem] flex flex-col gap-10 mx-auto px-4 sm:px-8 lg:px-16 py-8">
                <div className="space-y-3">
                    <div className="h-9 max-w-xl rounded-lg bg-bg-muted" />
                    <div className="h-4 w-48 rounded bg-bg-muted" />
                    <div className="h-4 w-64 rounded bg-bg-muted" />
                </div>

                <div className="flex gap-2 h-64 md:h-96 lg:h-[450px] overflow-hidden">
                    <div className="flex-1 h-full rounded-md overflow-hidden bg-bg-muted" />
                    <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2 h-full">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-full w-full rounded-md bg-bg-muted" />
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="w-full sm:w-2/3 order-1 space-y-6">
                        <div className="pb-8 border-b border-border-subtle space-y-4">
                            <div className="h-7 w-56 rounded bg-bg-muted" />
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="h-24 rounded-xl bg-bg-muted border border-border-subtle" />
                                ))}
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="h-7 w-48 rounded bg-bg-muted" />
                            <div className="h-4 w-full rounded bg-bg-muted" />
                            <div className="h-4 w-5/6 rounded bg-bg-muted" />
                            <div className="h-4 w-4/6 rounded bg-bg-muted" />
                        </div>
                    </div>
                    <div className="w-full sm:w-1/3 order-1 sm:order-2">
                        <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 space-y-4">
                            <div className="h-40 w-full rounded-xl bg-bg-muted" />
                            <div className="h-6 w-28 rounded bg-bg-muted" />
                            <div className="h-10 w-full rounded-xl bg-bg-muted" />
                            <div className="h-12 w-full rounded-xl bg-bg-muted" />
                        </div>
                    </div>
                </div>

                <div className="flex justify-center sm:justify-start">
                    <Button onClick={() => window.history.back()} className="mt-2" variant="secondary">
                        Go Back
                    </Button>
                </div>
            </div>
        </section>
    );
}

interface Property {
    id: number | string;
    listingId?: number | string;
    property_name: string;
    property_img: string[];
    property_location: string;
    property_neighborhoods?: string[];
    property_amenities: PropertyAmenity[];
    property_description: string;
    property_nearplaces: string[];
    property_mapSrc: string;
    property_policy_details: PropertyDetail[];
    property_rating: number;
    property_reviews: number;
    property_price: number;
    timezoneId?: string;
    // photoCount from API is intentionally not used for display; all counts derive from galleryUrls.length
    maxGuests?: number;
    maxCapacity?: number;
    /** G3-002: from API listing when available */
    checkInTime?: string;
    checkOutTime?: string;
    /** TASK-1676: nested policy times from listing DTO when present */
    unitPolicy?: { checkInTime?: string | null; checkOutTime?: string | null };
    /** AMN-001: amenity codes from API (e.g. ["wifi","ac","parking"]) */
    amenityCodes?: string[];
    /** TASK-355: host/on-site contact phone for WhatsApp CTA */
    hostPhone?: string | null;
    /** TASK-2907: property owner / host display name from listing API */
    hostName?: string | null;
    hostAbout?: string | null;
    /** Street-level address from API (TASK-1896); may be null if host chose not to expose pre-booking */
    propertyAddress?: string | null;
    /** Legacy / alternate JSON key for same */
    property_address?: string | null;
    /** TASK-1359: YouTube / Vimeo virtual tour URL */
    virtualTourUrl?: string | null;
    /** TASK-1385: Cancellation policy tier from listing — Flexible, Moderate, or Strict. */
    cancellationTier?: 'Flexible' | 'Moderate' | 'Strict' | null;
    /** TASK-4356: free-cancellation window hours before check-in (server-resolved). */
    cancellationWindowHours?: number | null;
    /** TASK-4405: server-resolved universal grace-window hours. Null when the flag is off (flag-off parity). */
    graceHours?: number | null;
    /** TASK-5205 / TASK-956: minimum stay nights from listing payload. */
    minStay?: number | null;
    /** TL-GUEST: from GET /listings/{id} or /listings/public — drives same Google Maps JS path as Location page. */
    latitude?: number | null;
    longitude?: number | null;
}

function coerceProperty(item: Partial<Property> & { id?: number | string }): Property {
    return {
        id: item.id ?? 0,
        listingId: item.listingId,
        property_name: item.property_name ?? "",
        property_img: item.property_img ?? [],
        property_location: item.property_location ?? "",
        property_neighborhoods: item.property_neighborhoods ?? [],
        property_amenities: item.property_amenities ?? [],
        property_description: item.property_description ?? "",
        property_nearplaces: item.property_nearplaces ?? [],
        property_mapSrc: item.property_mapSrc ?? "",
        property_policy_details: item.property_policy_details ?? [],
        property_rating: item.property_rating ?? 0,
        property_reviews: item.property_reviews ?? 0,
        property_price: item.property_price ?? 0,
        timezoneId: item.timezoneId,
        maxGuests: item.maxGuests,
        maxCapacity: item.maxCapacity,
        checkInTime: item.checkInTime,
        checkOutTime: item.checkOutTime,
        unitPolicy: item.unitPolicy,
        amenityCodes: item.amenityCodes,
        hostPhone: item.hostPhone,
        hostName: item.hostName,
        propertyAddress: item.propertyAddress,
        property_address: item.property_address,
        virtualTourUrl: item.virtualTourUrl,
        cancellationTier: item.cancellationTier,
        cancellationWindowHours: item.cancellationWindowHours,
        graceHours: item.graceHours,
        minStay: item.minStay,
        latitude: item.latitude,
        longitude: item.longitude,
    };
}

/** TASK-1664: row shape from `GET /api/listings/{id}/reviews` (camelCase JSON). */
type ListingReviewRow = {
    id: number;
    guestName?: string | null;
    rating: number;
    title?: string | null;
    body?: string | null;
    createdAt: string;
    hostResponse?: string | null;
    hostResponseAt?: string | null;
    photoUrls?: string[] | null;
    isVerifiedStay?: boolean;
    ratingCleanliness?: number | null;
    ratingValue?: number | null;
    ratingCheckin?: number | null;
    ratingCommunication?: number | null;
};

/** TASK-1359: Convert YouTube/Vimeo watch URL to embed URL, or return null if unrecognised. */
function toEmbedUrl(url: string): string | null {
    try {
        const u = new URL(url);
        // YouTube: https://www.youtube.com/watch?v=ID or https://youtu.be/ID
        if (u.hostname === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
        if (u.hostname.includes('youtube.com')) {
            const v = u.searchParams.get('v');
            return v ? `https://www.youtube.com/embed/${v}` : null;
        }
        // Vimeo: https://vimeo.com/ID
        if (u.hostname === 'vimeo.com') {
            const id = u.pathname.slice(1).split('/')[0];
            return id ? `https://player.vimeo.com/video/${id}` : null;
        }
        return null;
    } catch { return null; }
}

/** Avoid `new Date(x).toISOString()` on invalid URL params — throws RangeError and trips the route error boundary. */
function isoFromUrlDateParam(value: string | null): string | undefined {
    if (value == null) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const d = new Date(trimmed);
    if (!Number.isFinite(d.getTime())) return undefined;
    try {
        return d.toISOString();
    } catch {
        return undefined;
    }
}

const PropertyDetails = () => {
    const location = useLocation();
    const { propertySlug: propertySlugParam, unitSlug: unitSlugParam, id: legacyIdParam } = useParams();
    const { properties: apiProperties } = useTenantListings();
    const { listingsById } = usePropertyListings();

    // TL-GUEST: same map data + branching as LocationPage (`/location`).
    const mapTenant = _getTenantCtx();
    const mapTenantSlug = mapTenant?.slug;
    const locationTenantOverrides = useMemo(
        () => getTenantOverrides(mapTenantSlug ?? ''),
        [mapTenantSlug],
    );
    const mapLocation = mapTenant?.mapLocation ?? locationTenantOverrides.mapLocation;
    const tenantNameForMap = mapTenant?.name?.trim() || getTenantBrandName();
    const propertyPins = useMemo<MapPin[]>(() => {
        const seen = new Map<number, MapPin>();
        for (const l of Object.values(listingsById)) {
            const lat = typeof l.latitude === 'number' ? l.latitude : null;
            const lng = typeof l.longitude === 'number' ? l.longitude : null;
            if (lat == null || lng == null) continue;
            const pid = l.propertyId;
            if (pid == null || !Number.isFinite(pid)) continue;
            if (seen.has(pid)) continue;
            seen.set(pid, {
                id: `property-${pid}`,
                lat,
                lng,
                title: l.propertyName?.trim() || `Property ${pid}`,
                subtitle: l.propertyAddress ?? undefined,
            });
        }
        return Array.from(seen.values());
    }, [listingsById]);
    const useMultiPin = propertyPins.length >= 2;

    const normalizedLegacyParts = (legacyIdParam ?? '').split('-');
    const legacyUnitSlug = normalizedLegacyParts.pop();
    const legacyPropertySlug = normalizedLegacyParts.join('-') || undefined;
    const propertySlug = propertySlugParam ?? legacyPropertySlug;
    const listingIdParam = unitSlugParam ?? legacyUnitSlug ?? legacyIdParam;
    const listingId = listingIdParam ? Number(listingIdParam) : NaN;
    const [data, setData] = useState<Property | null>(null);
    const [notFound, setNotFound] = useState(false);
    // TASK-7195 four-state rule: a FAILED listing fetch used to call setNotFound(true), so a
    // network/5xx error rendered "Home not found — please check the link" and told a guest the
    // property does not exist. Absent and unreachable are different states; keep them apart.
    const [loadFailed, setLoadFailed] = useState(false);
    const [listingPropertyId, setListingPropertyId] = useState<string | number | null>(null);
    const [resolvedListingId, setResolvedListingId] = useState<string | number | null>(null);
    // TASK-2739-v1: "Draft" | "Published" (undefined on legacy payloads = treated as live).
    const [publishStatus, setPublishStatus] = useState<string | undefined>(undefined);
    const [, setListingLookupError] = useState<string | null>(null);
    const [isListingLookupPending, setIsListingLookupPending] = useState(false);
    const [showAmenitiesModal, setShowAmenitiesModal] = useState(false);
    const [showAboutMore, setShowAboutMore] = useState(false);
    const [showAllReviews, setShowAllReviews] = useState(false);
    const [stickyBookingSummary, setStickyBookingSummary] = useState<BookingStickySummary | null>(null);
    const unitType = inferUnitType({ id: data?.id, property_name: data?.property_name });
    const { setProperty, updateBooking } = useBooking();
    const [searchParams] = useSearchParams();
    // Build a back-to-results link when the user arrived from /search (params preserved in URL by SearchPage)
    const backToResultsHref = useMemo(() => {
        const searchKeys = ["checkIn", "checkOut", "guests", "minPrice", "maxPrice"];
        const hasSearchParams = searchKeys.some((k) => searchParams.has(k));
        if (!hasSearchParams) return null;
        return `/search?${searchParams.toString()}`;
    }, [searchParams]);
    const showAvailabilityPlaceholder = false;
    const [fav, setFav] = useState(false);
    const [similarFromApi, setSimilarFromApi] = useState<null | { loading: boolean; items: any[] }>(null);
    /** TASK-1726: host response time badge text (e.g. "Replies in <1h"). */
    const [responseTimeBadge, setResponseTimeBadge] = useState<string | null>(null);
    /** TASK-1312: review reply-rate badge text (e.g. "Replies to 95% of reviews"). */
    const [reviewReplyRateBadge, setReviewReplyRateBadge] = useState<string | null>(null);
    /** AMN-001: amenity master code→label map */
    const [amenityMaster, setAmenityMaster] = useState<Map<string, string>>(new Map());

    /** G3-001: live reviews from `GET /api/listings/{id}/reviews` when listing id resolves */
    const [listingReviewsFromApi, setListingReviewsFromApi] = useState<null | {
        loading: boolean;
        averageRating: number;
        totalCount: number;
        reviews: ListingReviewRow[];
    }>(null);

    // AMN-001: Fetch amenity master list once on mount
    useEffect(() => {
        let active = true;
        fetch(buildApiUrl('/listings/amenities/master'), { headers: getApiHeaders() })
            .then((r) => r.ok ? r.json() : Promise.reject())
            .then((items: unknown) => {
                if (!active || !Array.isArray(items)) return;
                const map = new Map<string, string>();
                (items as { code: string; label: string }[]).forEach(({ code, label }) => {
                    if (code && label) map.set(code.toLowerCase(), label);
                });
                setAmenityMaster(map);
            })
            .catch(() => { /* non-critical */ });
        return () => { active = false; };
    }, []);

    // TASK-1726: Fetch host response time badge once per listing load
    useEffect(() => {
        let active = true;
        fetch(buildApiUrl('/listings/response-time'), { headers: getApiHeaders() })
            .then((r) => r.ok ? r.json() : Promise.reject())
            .then((body: { badgeText?: string | null }) => {
                if (active && body?.badgeText) setResponseTimeBadge(body.badgeText);
            })
            .catch(() => { /* non-critical */ });
        return () => { active = false; };
    }, []);

    // TASK-1312: Fetch review reply-rate badge once per listing load
    useEffect(() => {
        let active = true;
        fetch(buildApiUrl('/listings/review-reply-rate'), { headers: getApiHeaders() })
            .then((r) => r.ok ? r.json() : Promise.reject())
            .then((body: { badgeText?: string | null }) => {
                if (active && body?.badgeText) setReviewReplyRateBadge(body.badgeText);
            })
            .catch(() => { /* non-critical */ });
        return () => { active = false; };
    }, []);

    // Hydrate booking context from URL search params (passed from SearchPage or deep-link tests).
    useEffect(() => {
        const checkInIso = isoFromUrlDateParam(searchParams.get('checkIn'));
        const checkOutIso = isoFromUrlDateParam(searchParams.get('checkOut'));
        const guestsRaw = searchParams.get('guests');
        const guestsParsed = guestsRaw != null && guestsRaw.trim() !== '' ? Number(guestsRaw) : NaN;
        const guests = Number.isFinite(guestsParsed) && guestsParsed > 0 ? guestsParsed : null;
        if (checkInIso || checkOutIso || guests) {
            updateBooking({
                ...(checkInIso ? { checkIn: checkInIso } : {}),
                ...(checkOutIso ? { checkOut: checkOutIso } : {}),
                ...(guests ? { guests } : {}),
            });
        }
    }, [searchParams, updateBooking]);
    const nightlyPrice = useMemo(() => {
        if (!data) return null;
        try {
            return calculateNightlyPrice({
                unitType,
                checkInDate: new Date(),
                guests: 2,
            });
        } catch {
            return null;
        }
    }, [data, unitType]);

    const dailyPricing = useDailyPricingSummary();
    const listingNumericForPricing = Number(resolvedListingId ?? data?.listingId ?? NaN);
    const dailyPricingRow = useMemo(() => {
        if (!Number.isFinite(listingNumericForPricing) || listingNumericForPricing <= 0) return undefined;
        return dailyPricing.data?.listings?.find((l) => l.listingId === listingNumericForPricing);
    }, [dailyPricing.data?.listings, listingNumericForPricing]);

    const directBookingNightly = useMemo(() => {
        const fromApi = dailyPricingRow?.finalAmount;
        if (fromApi != null && Number(fromApi) > 0) return Math.round(Number(fromApi));
        return nightlyPrice?.finalNightlyPrice ?? 0;
    }, [dailyPricingRow?.finalAmount, nightlyPrice?.finalNightlyPrice]);


    useEffect(() => {
        const lookupId = listingIdParam;

        if (!lookupId) {
            setListingPropertyId(null);
            setResolvedListingId(null);
            setListingLookupError('Availability temporarily unavailable.');
            setIsListingLookupPending(false);
            return;
        }

        const controller = new AbortController();
        setListingPropertyId(null);
        setResolvedListingId(null);
        setListingLookupError(null);
        setIsListingLookupPending(true);

        const loadListing = async () => {
            try {
                const listing = await resolveListing(String(lookupId), controller.signal);
                if (!listing) {
                    setListingLookupError('Property not available.');
                    return;
                }
                if (!listing.propertyId) {
                    setListingLookupError('Availability temporarily unavailable.');
                    return;
                }
                setListingPropertyId(listing.propertyId);
                setResolvedListingId(listing.id);
                // TASK-2739-v1: resolveListing hits GET /listings/{id} (detail, unfiltered) which
                // returns publishStatus even for Draft listings — drive noindex + the booking notice.
                const psFromResolve = (listing as { publishStatus?: unknown }).publishStatus;
                if (typeof psFromResolve === 'string') setPublishStatus(psFromResolve);
                const mgFromResolve = parseMaxGuestsFromPayload(listing as Record<string, unknown>);
                if (mgFromResolve != null) {
                    // TASK-2635: converge on the largest known capacity so the static-catalog
                    // default (homes.ts `?? 2`) can never clobber the API's real max-occupancy.
                    // Math.max is order-independent, so competing write paths can't make the
                    // displayed "Sleeps" flip between renders of the same URL.
                    setData((prev) =>
                        prev ? { ...prev, maxGuests: Math.max(prev.maxGuests ?? 0, mgFromResolve) } : prev,
                    );
                }
            } catch {
                if (controller.signal.aborted) return;
                setListingLookupError('Availability temporarily unavailable.');
                // Fallback so booking widget still gets a listing ID from static data (e.g. when API tenant is misconfigured)
                const fallbackId = data?.listingId;
                if (typeof fallbackId === 'number' && Number.isFinite(fallbackId)) {
                    setResolvedListingId(fallbackId);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsListingLookupPending(false);
                }
            }
        };

        loadListing();

        return () => {
            controller.abort();
        };
    }, [listingIdParam, data?.listingId]);

    // Public /listings only Includes cover + SortOrder==1, so catalog property_img is incomplete.
    // Hydrate full photoUrls from GET /listings/{id} once per listing for "View gallery".
    const detailPhotosHydratedRef = React.useRef<number | null>(null);
    useEffect(() => {
        const lid = Number(resolvedListingId ?? data?.listingId ?? NaN);
        if (!data || !Number.isFinite(lid) || lid <= 0) return;
        const hasMaxGuests = typeof data.maxGuests === 'number' && data.maxGuests >= 1;
        const hasHostPhone = typeof data.hostPhone === 'string' && data.hostPhone.trim().length > 0;
        const photosHydrated = detailPhotosHydratedRef.current === lid;
        if (hasMaxGuests && hasHostPhone && photosHydrated) return;

        const ac = new AbortController();
        void fetchListingById(lid, ac.signal)
            .then((detail) => {
                const d = detail as Record<string, unknown>;
                // TASK-2739-v1: GET /listings/{id} also carries publishStatus; keep state in sync.
                if (typeof d.publishStatus === 'string') setPublishStatus(d.publishStatus);
                const mg = parseMaxGuestsFromPayload(d);
                const rawPhone = d.hostPhone ?? d.contactPhone;
                const phone = typeof rawPhone === 'string' && rawPhone.trim() ? rawPhone.trim() : null;

                const rawPhotoUrls = Array.isArray(d.photoUrls)
                    ? (d.photoUrls as unknown[])
                          .filter((v): v is string => typeof v === 'string')
                    : [];
                const photoUrls = filterGuestImageUrls(rawPhotoUrls);
                const coverUrl = sanitizeGuestImageUrl(
                    typeof d.coverPhotoUrl === 'string' ? d.coverPhotoUrl : undefined,
                );
                const hydratedImages = photoUrls.length > 0 ? photoUrls : (coverUrl ? [coverUrl] : []);
                detailPhotosHydratedRef.current = lid;

                setData((prev) => {
                    if (!prev) return prev;
                    const updates: Partial<typeof prev> = {};
                    // TASK-2635: raise to the API's max-occupancy when it exceeds what we have
                    // (e.g. the static default of 2); never downgrade. Keeps "Sleeps" stable.
                    if (mg != null && mg > (typeof prev.maxGuests === 'number' ? prev.maxGuests : 0)) {
                        updates.maxGuests = mg;
                    }
                    if (phone !== null && !prev.hostPhone) {
                        updates.hostPhone = phone;
                    }
                    const prevGallery = filterGuestImageUrls(prev.property_img ?? []);
                    if (hydratedImages.length > prevGallery.length) {
                        updates.property_img = hydratedImages;
                    }
                    return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
                });
            })
            .catch(() => {});
        return () => ac.abort();
    }, [resolvedListingId, data]);

    /** TASK-1466: deep links e.g. `/homes/.../123?bookingId=1&t=...` load host phone without exposing it on public catalog. */
    const bookingIdForContact = searchParams.get('bookingId');
    const contactToken = searchParams.get('t');
    const lastListingContactKeyRef = React.useRef<string>('');
    useEffect(() => {
        if (!data) return;
        const bid = Number(bookingIdForContact);
        const tok = contactToken?.trim() ?? '';
        const lid = Number(resolvedListingId ?? data.listingId ?? NaN);
        if (!Number.isFinite(bid) || bid <= 0 || !tok || !Number.isFinite(lid) || lid <= 0) return;
        const dedupeKey = `${lid}:${bid}:${tok}`;
        if (lastListingContactKeyRef.current === dedupeKey) return;
        const ac = new AbortController();
        void fetchListingContact(lid, bid, tok, ac.signal)
            .then((c) => {
                const phone = c?.hostPhone?.trim();
                if (!phone || ac.signal.aborted) return;
                setData((prev) => {
                    if (!prev) return prev;
                    lastListingContactKeyRef.current = dedupeKey;
                    return { ...prev, hostPhone: phone };
                });
            })
            .catch(() => {});
        return () => ac.abort();
    }, [bookingIdForContact, contactToken, resolvedListingId, data]);

    useEffect(() => {
        const lid = resolvedListingId;
        if (lid == null) {
            setListingReviewsFromApi(null);
            return;
        }
        const num = typeof lid === 'number' ? lid : Number(lid);
        if (!Number.isFinite(num) || num <= 0) {
            setListingReviewsFromApi(null);
            return;
        }
        const ac = new AbortController();
        setListingReviewsFromApi({ loading: true, averageRating: 0, totalCount: 0, reviews: [] });
        void (async () => {
            try {
                const res = await fetch(buildApiUrl(`/api/listings/${num}/reviews`), {
                    headers: getApiHeaders(),
                    signal: ac.signal,
                });
                if (!res.ok) {
                    if (!ac.signal.aborted) setListingReviewsFromApi(null);
                    return;
                }
                const j = (await res.json()) as {
                    averageRating?: number;
                    totalCount?: number;
                    reviews?: ListingReviewRow[];
                };
                if (ac.signal.aborted) return;
                setListingReviewsFromApi({
                    loading: false,
                    averageRating: j.averageRating ?? 0,
                    totalCount: j.totalCount ?? 0,
                    reviews: Array.isArray(j.reviews) ? j.reviews : [],
                });
            } catch {
                if (!ac.signal.aborted) setListingReviewsFromApi(null);
            }
        })();
        return () => ac.abort();
    }, [resolvedListingId]);

    useEffect(() => {
        setNotFound(false);
        setLoadFailed(false); // TASK-7195: clear the failure state on every re-resolve, like notFound.
        setData(null);

        if (listingIdParam && !Number.isNaN(listingId) && listingId <= 0) {
            setNotFound(true);
            return;
        }

        const normalizeSlug = (value?: string | number | null) =>
            String(value ?? '')
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '-');

        const stripHyphens = (value: string) => value.replace(/-/g, '');

        const normalizedUnitSlug = normalizeSlug(listingIdParam);
        const normalizedPropertySlug = normalizeSlug(propertySlug);
        const normalizedPropertySlugStripped = stripHyphens(normalizedPropertySlug);

        // TASK-7430: URL property slug must match the listing's canonical property slug (404 otherwise).
        // TASK-7448 (P0 fix): match against the PROPERTY name (`propertyName`) as well as the unit
        // name (`property_name`). The original guard only used `property_name`, which on a
        // TenantPropertyRecord holds the UNIT name — so it rejected the very URLs the link builders
        // generate and 404'd every listing page on every tenant. See utils/propertySlugMatch.ts.
        const urlPropertySlugMatches = (item: {
            propertyName?: string | null;
            property_name?: string;
            id?: string | number;
        }) => propertySlugMatchesListing(normalizedPropertySlug, item);

        // 1) Match by listingId (PK from DB/API) — IDs 1–7 etc.
        const foundByListingId = listingIdParam && Number.isFinite(listingId) && listingId > 0
            ? apiProperties.find((item) => Number(item.listingId) === listingId)
            : null;

        if (import.meta.env.DEV && listingIdParam) {
             
            console.debug('[PropertyDetails] route params:', { propertySlug, unitSlug: listingIdParam, listingId }, 'foundByListingId:', !!foundByListingId);
        }

        if (foundByListingId) {
            if (urlPropertySlugMatches(foundByListingId)) {
                setData(coerceProperty({
                    ...foundByListingId,
                    property_neighborhoods: Array.isArray(foundByListingId.property_neighborhoods)
                        ? foundByListingId.property_neighborhoods
                        : [],
                    property_img: foundByListingId.property_img || [],
                    maxGuests:
                        resolveStaticMaxGuests(foundByListingId as unknown as Record<string, unknown>) ??
                        foundByListingId.maxGuests,
                }));
                return;
            }
            // TASK-7448 / whitelabel E2E: bundled catalog listingId 1–7 can collide with real
            // tenant listing PKs (e.g. e2e-wa-only fixture id=1). Slug mismatch must NOT 404
            // here — fall through to GET /listings/{id} which is tenant-scoped.
        }

        // 2) Match by unit slug / property name (legacy URLs)
        const foundByUnitSlug = apiProperties.find((item) => {
            const idSlug = normalizeSlug(item.id);
            const nameSlug = normalizeSlug(item.property_name);
            const unitMatches = normalizedUnitSlug && (idSlug === normalizedUnitSlug || nameSlug === normalizedUnitSlug);
            const propertySlugMatches =
                !normalizedPropertySlug ||
                nameSlug === normalizedPropertySlug ||
                nameSlug.includes(normalizedPropertySlug) ||
                stripHyphens(nameSlug) === normalizedPropertySlugStripped ||
                stripHyphens(nameSlug).includes(normalizedPropertySlugStripped) ||
                urlPropertySlugMatches(item);

            return unitMatches && propertySlugMatches;
        });

        if (foundByUnitSlug) {
            setData(coerceProperty({
                ...foundByUnitSlug,
                property_neighborhoods: Array.isArray(foundByUnitSlug.property_neighborhoods)
                    ? foundByUnitSlug.property_neighborhoods
                    : [],
                property_img: foundByUnitSlug.property_img || [],
                maxGuests:
                    resolveStaticMaxGuests(foundByUnitSlug as unknown as Record<string, unknown>) ??
                    foundByUnitSlug.maxGuests,
            }));
            return;
        }

        // If not found by slug, try to find by ID (e.g. unitSlug "7" matches item.id 501)
        const propertyId = normalizedUnitSlug || undefined;
        if (propertyId) {
            const foundById = apiProperties.find((item) => String(item.id) === String(propertyId));
            if (foundById && urlPropertySlugMatches(foundById)) {
                setData(coerceProperty({
                    ...foundById,
                    property_neighborhoods: Array.isArray(foundById.property_neighborhoods)
                        ? foundById.property_neighborhoods
                        : [],
                    property_img: foundById.property_img || [],
                    maxGuests:
                        resolveStaticMaxGuests(foundById as unknown as Record<string, unknown>) ?? foundById.maxGuests,
                }));
                return;
            }
            // Slug mismatch (or id collision with bundled catalog) — fall through to API resolve.
        }
        // If still not found, try to get from location state
        if (location.state?.property) {
            const prop = location.state.property;
            const navGallery = (location.state as { galleryImages?: string[] }).galleryImages;
            const images = filterGuestImageUrls(
                navGallery && navGallery.length > 0 ? navGallery : (prop.property_img || []),
            );
            setData({
                ...prop,
                property_neighborhoods: Array.isArray(prop.property_neighborhoods)
                    ? prop.property_neighborhoods
                    : [],
                property_img: images,
                maxGuests:
                    resolveStaticMaxGuests(prop as unknown as Record<string, unknown>) ??
                    (prop as Property).maxGuests,
            });
            return;
        }

        // API fallback: fetch from API when not in static data (handles DB numeric IDs not in propertyData).
        // TASK-1220: legacy slug-style unit params like "invalid-slug-xyz-404" can trigger a
        // failing resolver path and blank error state; only numeric listing ids should call API.
        if (listingIdParam && Number.isFinite(listingId) && listingId > 0) {
            if (import.meta.env.DEV) {
                 
                console.debug('[PropertyDetails] API fallback for listingIdParam:', listingIdParam);
            }
            const controller = new AbortController();
            let cancelled = false;
            resolveListing(String(listingIdParam), controller.signal)
                .then(async (apiListing: ListingDetail | null) => {
                    if (cancelled || !apiListing) {
                        if (import.meta.env.DEV && !cancelled) {
                             
                            console.debug('[PropertyDetails] API returned no listing for:', listingIdParam);
                        }
                        if (!cancelled) setNotFound(true);
                        return;
                    }
                    // TASK-7430: reject when the URL property slug does not match this listing.
                    // TASK-7448: keep property vs unit names distinct — never stuff unit name into
                    // propertyName (that made slug guards accept the wrong candidate).
                    const apiPropertyName =
                        typeof (apiListing as Record<string, unknown>).propertyName === 'string'
                            ? ((apiListing as Record<string, unknown>).propertyName as string)
                            : null;
                    if (
                        normalizedPropertySlug &&
                        !urlPropertySlugMatches({
                            propertyName: apiPropertyName,
                            property_name:
                                typeof apiListing.name === 'string' ? apiListing.name : undefined,
                            id: apiListing.id,
                        })
                    ) {
                        if (!cancelled) setNotFound(true);
                        return;
                    }
                    const coverUrl = sanitizeGuestImageUrl(
                        (apiListing as Record<string, unknown>).coverPhotoUrl as string | undefined,
                    );
                    const photoUrlsRaw = (apiListing as Record<string, unknown>).photoUrls;
                    const photoUrlsList = filterGuestImageUrls(
                        Array.isArray(photoUrlsRaw)
                            ? [...new Set((photoUrlsRaw as string[]).filter(Boolean))]
                            : [],
                    );
                    const pub = apiListing as unknown as Partial<PublicListing>;
                    // TASK-2739-v1: capture publishStatus on the API-fallback render path too.
                    {
                        const psFallback = (apiListing as Record<string, unknown>).publishStatus;
                        if (typeof psFallback === 'string') setPublishStatus(psFallback);
                    }
                    const rawAddr =
                        (apiListing as Record<string, unknown>).propertyAddress ??
                        (apiListing as Record<string, unknown>).property_address;
                    const streetFromApi =
                        typeof rawAddr === 'string' && rawAddr.trim() ? rawAddr.trim() : null;
                    const listingNumericId = Number(apiListing.id) || listingId;
                    const mapped: Property = {
                        id: listingNumericId,
                        listingId: listingNumericId,
                        property_name: (apiListing.name as string) ?? `Listing ${apiListing.id}`,
                        property_img: photoUrlsList.length > 0 ? photoUrlsList : (coverUrl ? [coverUrl] : []),
                        property_location: (apiListing as Record<string, unknown>).property_location as string ?? 'Location not specified',
                        property_neighborhoods: Array.isArray((apiListing as Record<string, unknown>).property_neighborhoods) ? (apiListing as Record<string, unknown>).property_neighborhoods as string[] : [],
                        property_amenities: Array.isArray((apiListing as Record<string, unknown>).property_amenities) ? (apiListing as Record<string, unknown>).property_amenities as PropertyAmenity[] : [],
                        property_description: (apiListing as Record<string, unknown>).property_description as string ?? '',
                        property_nearplaces: Array.isArray((apiListing as Record<string, unknown>).property_nearplaces) ? (apiListing as Record<string, unknown>).property_nearplaces as string[] : [],
                        property_mapSrc: (apiListing as Record<string, unknown>).property_mapSrc as string ?? '',
                        property_policy_details: Array.isArray((apiListing as Record<string, unknown>).property_policy_details) ? (apiListing as Record<string, unknown>).property_policy_details as PropertyDetail[] : [],
                        // TASK-5196: public listing DTO uses baseNightlyRate / propertyRating / reviewCount
                        property_rating: Number(apiListing.propertyRating ?? (apiListing as Record<string, unknown>).property_rating) || 0,
                        property_reviews: Number(apiListing.reviewCount ?? (apiListing as Record<string, unknown>).property_reviews) || 0,
                        property_price: Number(apiListing.baseNightlyRate ?? (apiListing as Record<string, unknown>).property_price) || 0,
                        timezoneId: (apiListing as Record<string, unknown>).timezoneId as string | undefined,
                        maxGuests: parseMaxGuestsFromPayload(apiListing as Record<string, unknown>),
                        checkInTime: pub.checkInTime?.trim() || undefined,
                        checkOutTime: pub.checkOutTime?.trim() || undefined,
                        unitPolicy: (() => {
                          const raw = (apiListing as Record<string, unknown>).unitPolicy;
                          if (!raw || typeof raw !== "object") return undefined;
                          const o = raw as Record<string, unknown>;
                          const cin = o.checkInTime ?? o.CheckInTime;
                          const cout = o.checkOutTime ?? o.CheckOutTime;
                          return {
                            checkInTime: typeof cin === "string" ? cin : null,
                            checkOutTime: typeof cout === "string" ? cout : null,
                          };
                        })(),
                        hostPhone: (() => {
                            const raw = (apiListing as Record<string, unknown>).hostPhone ?? (apiListing as Record<string, unknown>).contactPhone;
                            return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
                        })(),
                        hostName: (() => {
                            const raw = (apiListing as Record<string, unknown>).hostName ?? (apiListing as Record<string, unknown>).HostName;
                            return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
                        })(),
                        hostAbout: (() => {
                            const raw = (apiListing as Record<string, unknown>).hostAbout ?? (apiListing as Record<string, unknown>).HostAbout;
                            return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
                        })(),
                        amenityCodes: (() => {
                            const raw = (apiListing as Record<string, unknown>).amenityCodes;
                            if (Array.isArray(raw)) return raw.filter((c): c is string => typeof c === 'string');
                            if (typeof raw === 'string') {
                                try { const p = JSON.parse(raw); return Array.isArray(p) ? p : undefined; } catch { return undefined; }
                            }
                            return undefined;
                        })(),
                        propertyAddress:
                            streetFromApi ??
                            (typeof pub.propertyAddress === 'string' && pub.propertyAddress.trim()
                                ? pub.propertyAddress.trim()
                                : null),
                        virtualTourUrl: (() => {
                            const raw = (apiListing as Record<string, unknown>).virtualTourUrl;
                            return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
                        })(),
                        cancellationTier: (() => {
                            const raw = (apiListing as Record<string, unknown>).cancellationTier ?? pub.cancellationTier;
                            return (raw === 'Flexible' || raw === 'Moderate' || raw === 'Strict') ? raw : null;
                        })(), // TASK-1385
                        cancellationWindowHours: (() => {
                            const raw =
                                (apiListing as Record<string, unknown>).cancellationWindowHours ??
                                pub.cancellationWindowHours;
                            return typeof raw === 'number' && raw > 0 ? raw : null;
                        })(), // TASK-4356 / TASK-5205
                        graceHours: (() => {
                            const raw = (apiListing as Record<string, unknown>).graceHours ?? pub.graceHours;
                            return typeof raw === 'number' && raw > 0 ? raw : null;
                        })(), // TASK-4405
                        minStay: (() => {
                            const raw = (apiListing as Record<string, unknown>).minStay ?? pub.minStay;
                            const n = raw == null || raw === '' ? NaN : Number(raw);
                            return Number.isFinite(n) && n > 0 ? n : null;
                        })(), // TASK-5205
                        latitude: (() => {
                            const raw =
                                (apiListing as Record<string, unknown>).latitude ??
                                (apiListing as Record<string, unknown>).Latitude;
                            const n = raw == null || raw === '' ? NaN : Number(raw);
                            return Number.isFinite(n) ? n : null;
                        })(),
                        longitude: (() => {
                            const raw =
                                (apiListing as Record<string, unknown>).longitude ??
                                (apiListing as Record<string, unknown>).Longitude;
                            const n = raw == null || raw === '' ? NaN : Number(raw);
                            return Number.isFinite(n) ? n : null;
                        })(),
                    };
                    const images = filterGuestImageUrls(
                        photoUrlsList.length > 0 ? photoUrlsList : (coverUrl ? [coverUrl] : []),
                    );
                    if (cancelled) return;
                    setData({ ...mapped, property_img: images });
                })
                .catch(() => {
                    // TASK-7195: the fetch failed — we do NOT know the listing is absent.
                    if (!cancelled) setLoadFailed(true);
                });
            return () => {
                cancelled = true;
                controller.abort();
            };
        }

        setNotFound(true);
    }, [propertySlug, listingIdParam, listingId, apiProperties, location.state]);
useEffect(() => {
  if (!data?.id) return;

  setProperty(data.id, data.property_name); // ✅ use property_name

  const lid = Number(resolvedListingId ?? data?.listingId ?? listingId);
  if (Number.isFinite(lid) && lid > 0) {
      setFav(isFavorite(lid));
      const path = buildHomeUnitPath(propertySlug ?? String(data.id), lid);
      addRecentlyViewed({
          listingId: lid,
          path,
          name: getListingDisplayName(lid, data.property_name),
          // TASK-4289: store the first *guest-displayable* image (same filter the gallery uses),
          // not the raw property_img[0] — a blocked/non-canonical blob URL would persist and render
          // blank in the Recently-viewed strip on /search.
          coverPhotoUrl: filterGuestImageUrls(data.property_img ?? [])[0],
          location: data.property_location,
          pricePerNight:
              typeof data.property_price === "number" && data.property_price > 0
                  ? data.property_price
                  : undefined,
      });
      updateBooking({ listingDetailPath: path });
  }

}, [data?.id, data?.property_name, data?.listingId, data?.property_img, data?.property_location, data?.property_price, listingId, propertySlug, resolvedListingId, setProperty, updateBooking]);

    // Similar listings: GET /listings/{id}/similar
    useEffect(() => {
        const lid = Number(resolvedListingId ?? data?.listingId ?? listingId);
        if (!Number.isFinite(lid) || lid <= 0) return;
        const ac = new AbortController();
        setSimilarFromApi({ loading: true, items: [] });
        fetch(buildApiUrl(`/listings/${lid}/similar?limit=6`), { headers: { Accept: 'application/json', ...getApiHeaders() }, signal: ac.signal })
            .then(async (res) => (res.ok ? (await res.json()) : []))
            .then((j) => {
                if (ac.signal.aborted) return;
                setSimilarFromApi({ loading: false, items: Array.isArray(j) ? j : [] });
            })
            .catch(() => {
                if (!ac.signal.aborted) setSimilarFromApi(null);
            });
        return () => ac.abort();
    }, [resolvedListingId, data?.listingId, listingId]);

    // TASK-2118: prefetch removed. UnitBookingWidget + AvailabilityCalendar each fetch
    // /availability-calendar on mount; an additional prefetch here pushed the listing
    // detail page to 3 GETs against the same endpoint and broke the duplicate-fetch
    // guard. The "warm" benefit was marginal because both components do their own
    // fetch immediately on render — there is no shared cache to populate.


    useEffect(() => {
        if (!data) return;

        const initFancybox = async () => {
            try {
                // CSS bundled from the installed package (matches the v6 JS) — avoids
                // the CSP style-src violation from the previous cdn.jsdelivr.net link
                // and the v5↔v6 version mismatch.
                const [{ Fancybox }] = await Promise.all([
                    import("@fancyapps/ui"),
                    import("@fancyapps/ui/dist/fancybox/fancybox.css"),
                ]);

                (Fancybox as { bind: (sel: string, opts: object) => void }).bind("[data-fancybox='property-gallery']", {
                    Thumbs: {
                        type: "classic",
                    },
                    Carousel: {
                        transition: "slide",
                    },
                });

                return () => {
                    Fancybox.destroy();
                };
            } catch (err) {
                console.warn('Failed to load Fancybox', err);
            }
        };

        const cleanup = initFancybox();
        return () => {
            cleanup?.then((fn) => fn?.());
        };
    }, [data]);

    useEffect(() => {
        if (!data) return;

        trackEvent(
            'listing_view',
            {
                surface: 'property_details',
                propertyName: data.property_name,
                price: nightlyPrice?.finalNightlyPrice ?? data.property_price,
            },
            { listingId: data.listingId ?? data.id, unitCode: data.id, route: propertySlug && (data.listingId ?? listingId) ? buildHomeUnitPath(propertySlug, Number(data.listingId ?? listingId)) : location.pathname },
        );
    }, [data, location.pathname, nightlyPrice?.finalNightlyPrice, propertySlug, listingIdParam, listingId]);

    /** AMN-001: maps amenity code to a React icon for guest portal display */
    const renderIconForCode = (code: string) => {
        return renderIcon(code);
    };

    const renderIcon = (iconName: string) => {
        const name = iconName.toLowerCase();
        if (name.includes('bed')) return <FaBed />;
        if (name.includes('shower') || name.includes('dryer')) return <FaShower />;
        if (name.includes('pool')) return <FaSwimmingPool />;
        if (name.includes('car') || name.includes('parking')) return <FaCar />;
        if (name.includes('wifi')) return <FaWifi />;
        if (name.includes('ac')) return <TbAirConditioning />;
        if (name.includes('lift') || name.includes('elevator')) return <PiElevatorDuotone />;
        if (name.includes('security')) return <PiCoatHangerLight />;
        if (name.includes('tv')) return <FaTv />;
        if (name.includes('luggage')) return <RiLuggageCartLine />;
        if (name.includes('cleaning') || name.includes('housekeeping')) return <TfiBrushAlt />;
        if (name.includes('newspaper')) return <LiaNewspaper />;
        if (name.includes('breakfast') || name.includes('food')) return <MdOutlineEmojiFoodBeverage />;
        if (name.includes('card') || name.includes('payment')) return <FaCcMastercard />;
        if (name.includes('laundry')) return <MdOutlineLocalLaundryService />;
        if (name.includes('gym') || name.includes('fitness') || name.includes('dumbbell')) return <FaDumbbell />;
        return <MdOutlineDone />;
    };

    const formatAmenityName = (name: string) => {
        return name.charAt(0).toUpperCase() + name.slice(1);
    };

    /** TASK-1357: aggregateRating + Review JSON-LD (before conditional returns — Rules of Hooks). */
    const propertyJsonLd = useMemo(() => {
        if (!data) return undefined;
        const pageUrlForLd = typeof window !== 'undefined' ? window.location.href : '';
        const primaryImageForLd = filterGuestImageUrls(data.property_img ?? [])[0];
        const apiRev = listingReviewsFromApi;
        const useApiRatings = Boolean(apiRev && !apiRev.loading && apiRev.totalCount > 0 && apiRev.averageRating > 0);
        // TASK-2554: only use API-sourced rating; never fall back to static catalog counts for JSON-LD
        const ratingValue = useApiRatings ? apiRev!.averageRating : 0;
        const reviewCount = useApiRatings ? apiRev!.totalCount : 0;
        const reviewNodes = (apiRev?.reviews ?? [])
            .filter((r) => Number(r.rating) >= 1 && Number(r.rating) <= 5)
            .slice(0, 8)
            .map((r) => ({
                '@type': 'Review',
                author: { '@type': 'Person', name: (r.guestName || 'Guest').trim().slice(0, 80) || 'Guest' },
                reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
                reviewBody: String(r.body || r.title || '').trim().slice(0, 800),
                datePublished: r.createdAt,
            }))
            .filter((node) => node.reviewBody.length > 0);

        const displayNightly = directBookingNightly > 0 ? directBookingNightly : (nightlyPrice?.finalNightlyPrice ?? 0);

        return [
            {
                '@context': 'https://schema.org',
                '@type': 'LodgingBusiness',
                name: data.property_name,
                description: data.property_description?.slice(0, 300),
                image: primaryImageForLd,
                url: pageUrlForLd,
                address: {
                    '@type': 'PostalAddress',
                    addressLocality: data.property_location || undefined,
                    addressRegion: 'Telangana',
                    addressCountry: 'IN',
                },
                aggregateRating:
                    ratingValue > 0 && reviewCount > 0
                        ? {
                              '@type': 'AggregateRating',
                              ratingValue,
                              reviewCount,
                          }
                        : undefined,
                review: reviewNodes.length > 0 ? reviewNodes : undefined,
                ...(displayNightly > 0
                    ? {
                          priceRange: `INR ${displayNightly}/night`,
                          makesOffer: {
                              '@type': 'Offer',
                              priceCurrency: 'INR',
                              price: displayNightly,
                              availability: 'https://schema.org/InStock',
                          },
                      }
                    : {}),
            },
            ...(Array.isArray(data.property_policy_details) && data.property_policy_details.length > 0
                ? [
                      {
                          '@context': 'https://schema.org',
                          '@type': 'FAQPage',
                          mainEntity: data.property_policy_details
                              .filter((p: any) => p?.type && p?.value)
                              .slice(0, 6)
                              .map((p: any) => ({
                                  '@type': 'Question',
                                  name: String(p.type),
                                  acceptedAnswer: { '@type': 'Answer', text: String(p.value) },
                              })),
                      },
                  ]
                : []),
            ...(reviewCount === 0
                ? [
                      {
                          '@context': 'https://schema.org',
                          '@type': 'Place',
                          name: data.property_name,
                          description: data.property_description?.slice(0, 300),
                          url: pageUrlForLd,
                      },
                  ]
                : []),
        ];
    }, [
        data,
        listingReviewsFromApi,
        directBookingNightly,
        nightlyPrice?.finalNightlyPrice,
    ]);

    if (!data) {
        // TASK-7195 four-state rule: check the FAILURE state before the absent state. A load that
        // errored tells us nothing about whether this home exists, so saying "not found" (and
        // telling the guest to check their link) is an authoritative claim we have not earned.
        if (loadFailed) {
            return (
                <StateMessage
                    data-testid="listing-load-failed-homepage"
                    icon="⚠️"
                    title="We couldn't load this home"
                    message="Something went wrong on our side — the home is probably still there. Please try again in a moment."
                    primaryAction={{ label: "Try again", onClick: () => window.location.reload() }}
                    secondaryActions={[{ label: "Browse available homes", to: "/" }]}
                />
            );
        }
        if (notFound) {
            return (
                <StateMessage
                    data-testid="listing-not-found-homepage"
                    icon="🏠"
                    title="Home not found"
                    message={`Please check the link and try again, or return to browse available homes on ${getTenantBrandName()}.`}
                    primaryAction={{ label: "Browse available homes", to: "/" }}
                    secondaryActions={[{ label: "Go back", onClick: () => window.history.back() }]}
                />
            );
        }
        return <PropertyDetailsSkeleton />;
    }

    const property = data;

    const resolvedCheckInTime =
      property.checkInTime?.trim() || property.unitPolicy?.checkInTime?.trim() || null;
    const resolvedCheckOutTime =
      data?.checkOutTime?.trim() || data?.unitPolicy?.checkOutTime?.trim() || null;
    const cancellationPolicyText = (() => {
        const policies = data?.property_policy_details ?? [];
        const fromListingPolicy = policies.find((p) =>
            typeof p?.type === 'string' && p.type.toLowerCase().includes('cancellation'),
        )?.value;
        // TASK-4356: honest default when the host hasn't set an explicit tier or custom text —
        // matches the server's 7-day free-cancellation default (CancellationPolicyWindow.cs).
        return fromListingPolicy || inlinePolicySnippets?.cancellation || 'Full refund if cancelled 7+ days before check-in.';
    })();

    // TASK-7539: tier-specific plain-language text now reads from the single source of truth
    // (describeCancellationPolicy). Both this surface and getPpCancellationInfo render the same
    // policy, so they cannot diverge (fixes TASK-7539 Defect 3).
    const buildCancellationTierLabel = (tier: string | null | undefined): string => {
        const policy = describeCancellationPolicy(tier);
        if (!tier) return '';
        // Capitalize tier name for the label
        const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
        // For Flexible (0% fee), afterWindowCopy is empty, so just the headline.
        // For others, append after-window copy.
        return policy.afterWindowCopy
            ? `${tierName} — ${policy.headline}; ${policy.afterWindowCopy}`
            : `${tierName} — ${policy.headline}.`;
    };
    const cancellationTierLabel: Record<string, string> = {
        Flexible: buildCancellationTierLabel('Flexible'),
        Moderate: buildCancellationTierLabel('Moderate'),
        Strict: buildCancellationTierLabel('Strict'),
    };
    const _resolvedCancellationText = data?.cancellationTier
        ? cancellationTierLabel[data.cancellationTier]
        : cancellationPolicyText;

    const pageUrl = typeof window !== 'undefined' ? window.location.href : '';

    // Marketplace tenant: construct full blob URL from relative paths (white-label uses full URLs from API).
    const buildAtlasMediaUrl = (imageUrl: string): string => {
      if (!imageUrl || !resolvedListingId) return imageUrl;
      const ctx = _getTenantCtx();
      const slug = (ctx?.slug ?? "").trim().toLowerCase();
      const useMarketplaceBlobLayout = slug === "atlas" || Boolean(ctx?.isMarketplaceRoot);
      if (!useMarketplaceBlobLayout) return imageUrl;

      // If already a fully-qualified absolute URL (any scheme/host — Azure blob OR a dev/static
      // server like http://127.0.0.1:5120/uploads/...), trust it. Rewriting absolute URLs to
      // Azure blob URLs broke local/dev where blobs don't exist (TASK-2118 console-error fix).
      if (/^https?:\/\//i.test(imageUrl)) return imageUrl;

      // Handle relative paths and filenames
      const cleanPath = imageUrl.replace(/^\/+/, '').trim();
      if (!cleanPath) return imageUrl;

      // Extract filename from path (e.g., "room201.jpg" from "photos/room201.jpg" or just "room201.jpg")
      const filename = cleanPath.split('/').pop() || cleanPath;
      return `https://atlashomestorage.blob.core.windows.net/atlas-media/atlas/${resolvedListingId}/${filename}`;
    };

    const galleryUrls = filterGuestImageUrls(data?.property_img ?? []).map(buildAtlasMediaUrl);
    const primaryImage = galleryUrls[0];
    const mapSrcTrimmed = (data?.property_mapSrc ?? "").trim();

    // ---- hi-fi design derived values ----------------------------------------
    const ppTenantCtx = _getTenantCtx();
    const ppTenantOverrides = getTenantOverrides(ppTenantCtx?.slug ?? '');
    const ppHideAtlasBranding = shouldHideAtlasBranding(ppTenantCtx, ppTenantOverrides);
    const ppBrandName = getTenantBrandName();
    const ppHasRealHost = !!data.hostName?.trim();
    const ppHostAbout = data.hostAbout?.trim() ?? '';
    // TASK-4311: On the marketplace, check for ?tenant=TenantName query param to show the actual listing's tenant
    const tenantNameFromUrl = searchParams.get('tenant')?.trim();
    const ppHostDisplayName = ppHasRealHost
      ? data.hostName!.trim()
      : tenantNameFromUrl ? `Listed by ${tenantNameFromUrl}` : `Listed by ${ppBrandName}`;
    const ppHostInitial = ppHostDisplayName.charAt(0).toUpperCase();
    // TASK-7428: one shared predicate for "an online gateway will actually charge this guest" —
    // drives both the cancellation copy and the Razorpay payment-rail claim below.
    const ppHasOnlinePayment = hasOnlinePaymentRail(ppTenantCtx);
    const ppCancellationInfo = getPpCancellationInfo(data.cancellationTier, {
      fallbackText: _resolvedCancellationText,
      hasOnlinePayment: ppHasOnlinePayment,
    });
    const ppHasLocation =
        (typeof data.latitude === 'number' && Number.isFinite(data.latitude)) ||
        mapSrcTrimmed.length > 0 ||
        useMultiPin ||
        (mapLocation != null && typeof mapLocation.lat === 'number' && Number.isFinite(mapLocation.lat));
    // TASK-7192: guest-facing phone precedence — WhatsApp/booking number wins over listing hostPhone.
    const listingHostDigits = (data.hostPhone?.replace(/\D/g, '') || '').trim();
    const ppHostPhone = getGuestFacingPhone('business') || listingHostDigits;
    const ppHasHostPhone = ppHostPhone.length > 0;
    const ppWaDigits = ppHostPhone.length === 10 ? `91${ppHostPhone}` : ppHostPhone;
    const ppWaBookingUrl = ppHasHostPhone ? `https://wa.me/${ppWaDigits}?text=${encodeURIComponent(`Hi, I'm interested in booking ${data.property_name}`)}` : '';
    const ppWaAskUrl = ppHasHostPhone ? `https://wa.me/${ppWaDigits}?text=${encodeURIComponent(`Hi, I have a question about ${data.property_name}`)}` : '';
    const ppShowRegRow = (ppTenantOverrides.gstin != null) ||
        (ppTenantOverrides.tourismRegNumbers != null && ppTenantOverrides.tourismRegNumbers.length > 0);

    // Derive amenity labels for display
    const ppAmenityLabels: string[] = data.amenityCodes && data.amenityCodes.length > 0
        ? data.amenityCodes.map((code) => amenityMaster.get(code.toLowerCase()) ?? formatAmenityName(code))
        : (data.property_amenities || []).map((a) => a.amenities_icon ? formatAmenityName(a.amenities_icon) : 'Amenity');

    const ppApiReviews = listingReviewsFromApi;
    const ppHasApiReviews = Boolean(ppApiReviews && !ppApiReviews.loading && ppApiReviews.totalCount > 0);
    const ppDisplayedReviews = ppHasApiReviews
        ? (showAllReviews ? ppApiReviews!.reviews : ppApiReviews!.reviews.slice(0, 6))
        : [];
    const ppAmenityDisplay = ppAmenityLabels.slice(0, 12);
    const ppAmenityCodes = data.amenityCodes && data.amenityCodes.length > 0
        ? data.amenityCodes.slice(0, 12)
        : null;

    // TASK-2739-v1: a Draft listing is reachable by direct/preview link but is not yet live —
    // hide it from search engines (noindex) and replace the booking surfaces with a notice.
    // v1.1: scope the "Draft — not yet live" badge to admin viewers (no admin-session detection
    // exists in the guest portal today, so v1 shows it to all viewers of a Draft listing).
    const ppIsDraft = publishStatus === 'Draft';
    // TASK-2888: allow-list — only Published (or legacy undefined) listings are bookable.
    const ppIsBookable = publishStatus == null || publishStatus === 'Published';
    // TASK-4381/4386 / ADR-0068: internal (non-customer) tenants must never be indexed, in
    // addition to the existing Draft-listing noindex — the listing stays fully functional.
    const ppSeoNoIndex = (publishStatus != null && publishStatus !== 'Published') || Boolean(ppTenantCtx?.isInternal);
    const ppHasMapCoordinates =
      typeof data.latitude === 'number' &&
      typeof data.longitude === 'number' &&
      Number.isFinite(data.latitude) &&
      Number.isFinite(data.longitude);
    const ppStickyNightly =
      directBookingNightly > 0 ? directBookingNightly : (nightlyPrice?.finalNightlyPrice ?? 0);
    const directBookingNightlyIsSynthetic =
      !(dailyPricingRow?.finalAmount != null && Number(dailyPricingRow.finalAmount) > 0);

    return (
        <>
        {data && (
            <SEO
                title={`${getListingDisplayName(data.id, data.property_name)} | ${getTenantBrandName()}`}
                description={data.property_description?.slice(0, 160) || `Book ${getListingDisplayName(data.id, data.property_name)}${data.property_location ? ` in ${data.property_location}` : ''} on ${getTenantBrandName()}.`}
                image={primaryImage}
                url={pageUrl}
                type="lodgingBusiness"
                jsonLd={propertyJsonLd}
                robots={ppSeoNoIndex ? 'noindex, nofollow' : undefined}
            />
        )}

        {/* =====================================================================
            HI-FI PROPERTY PAGE — pp-* design system
            All logic preserved; only layout/styling changed.
           ===================================================================== */}
        <div className="pp-root">
          <div className="pp-shell">

            {/* ---- Breadcrumbs ---- */}
            <nav className="pp-crumbs" aria-label="Breadcrumb">
              {backToResultsHref ? (
                <>
                  <Link to={backToResultsHref} data-testid="back-to-results">Search results</Link>
                  <span className="pp-sep" aria-hidden="true">›</span>
                </>
              ) : (
                <>
                  <Link to="/">Home</Link>
                  <span className="pp-sep" aria-hidden="true">›</span>
                  <Link to="/#our-homes">Stays</Link>
                  <span className="pp-sep" aria-hidden="true">›</span>
                </>
              )}
              <span aria-current="page">{getListingDisplayName(data.id, data.property_name)}</span>
            </nav>

            {/* ---- Title row ---- */}
            <div className="pp-title-row">
              <div>
                {!ppHideAtlasBranding && (
                  <p className="pp-eyebrow">{ppBrandName}</p>
                )}
                {/* TASK-2739-v1: "Draft — not yet live" badge. v1 shows it to ALL viewers of a Draft
                    listing; v1.1 will scope it to admin viewers once the guest portal gains an
                    admin-session signal. */}
                {ppIsDraft && (
                  <span
                    className="pp-draft-badge"
                    data-testid="draft-badge"
                    style={{
                      display: 'inline-block',
                      marginBottom: 8,
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: 'var(--brand-soft, #ffe4d6)',
                      color: 'var(--text-primary, #4a3535)',
                      fontSize: 12,
                      fontWeight: 600,
                      border: '1px solid var(--border-strong, #e5cfc0)',
                    }}
                  >
                    Draft — not yet live
                  </span>
                )}
                <h1 className="pp-display">{getListingDisplayName(data.id, data.property_name)}</h1>
                <div className="pp-submeta">
                  {ppHasApiReviews && (
                    <>
                      <span className="pp-rating">
                        ★ {ppApiReviews!.averageRating.toFixed(1)}{' '}
                        <em>({ppApiReviews!.totalCount} {ppApiReviews!.totalCount === 1 ? 'review' : 'reviews'})</em>
                      </span>
                      <span className="pp-submeta-sep" aria-hidden="true">·</span>
                    </>
                  )}
                  {(data.propertyAddress || data.property_address || data.property_location) && (
                    <>
                      <span data-testid="property-street-address">
                        {String(data.propertyAddress || data.property_address || data.property_location).trim()}
                      </span>
                      <span className="pp-submeta-sep" aria-hidden="true">·</span>
                    </>
                  )}
                  {data.maxGuests != null && data.maxGuests > 0 && (
                    <span>Sleeps {data.maxGuests}</span>
                  )}
                </div>
              </div>
              <div className="pp-title-actions">
                <button
                  type="button"
                  className="pp-btn pp-btn-ghost pp-btn-sm"
                  onClick={() => {
                    const url = window.location.href;
                    // TASK-2873: do not advertise a price for a Draft (unpublished) listing.
                    const priceText = !ppIsDraft && directBookingNightly > 0 ? ` from ₹${directBookingNightly.toLocaleString('en-IN')}/night` : '';
                    const text = `Check out ${data.property_name}${priceText} on ${ppBrandName}`;
                    // TASK-4288: navigator.share() rejects on desktop ("Must be handling a user
                    // gesture") with no fallback, spamming monitoring. Guard with canShare, swallow
                    // user-cancel (AbortError), and fall back to clipboard + toast, then wa.me.
                    const shareData = { title: document.title, text, url };
                    const share = async () => {
                      if (typeof navigator.share === 'function' && (navigator.canShare?.(shareData) ?? true)) {
                        try {
                          await navigator.share(shareData);
                          return;
                        } catch (err) {
                          if ((err as Error)?.name === 'AbortError') return; // user dismissed the sheet
                        }
                      }
                      try {
                        if (navigator.clipboard?.writeText) {
                          await navigator.clipboard.writeText(url);
                          toast.success('Link copied to clipboard.');
                          return;
                        }
                      } catch {
                        /* clipboard blocked — fall through to wa.me */
                      }
                      window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank', 'noopener,noreferrer');
                    };
                    void share();
                  }}
                  aria-label={`Share ${data.property_name}`}
                >
                  Share
                </button>
                <button
                  type="button"
                  className="pp-btn pp-btn-ghost pp-btn-sm"
                  onClick={() => {
                    const lid = Number(resolvedListingId ?? data.listingId ?? listingId);
                    if (!Number.isFinite(lid) || lid <= 0) return;
                    setFav(toggleFavorite(lid));
                  }}
                  aria-label={fav ? 'Remove from saved' : 'Save listing'}
                >
                  {fav ? '♥ Saved' : '♡ Save'}
                </button>
              </div>
            </div>

            {/* ---- Gallery mosaic ---- */}
            <div className="pp-gallery" role="region" aria-label="Property photos" data-testid="property-photo-gallery">
              {/* Hero cell */}
              <div
                className={`pp-cell pp-cell-hero${galleryUrls[0] ? ' pp-cell--photo' : ''}`}
                style={galleryUrls[0]
                  ? { backgroundImage: `url(${galleryUrls[0]})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : {}}
                role="img"
                aria-label={galleryUrls[0] ? `${data.property_name} — main photo` : `${data.property_name} — photo coming soon`}
              >
                {!galleryUrls[0] && (
                  <div className="pp-cell-overlay">
                    <span className="pp-dot" aria-hidden="true" />
                    <span>Photos coming soon</span>
                  </div>
                )}
              </div>

              {/* Thumbnail cells */}
              {/* TASK-2889: render only cells that have a real photo — no fabricated
                  "Living/Kitchen/Bedroom/Balcony" placeholder tiles for sparse listings. */}
              {([1, 2, 3, 4] as const).map((i) => {
                const photo = galleryUrls[i];
                if (!photo) return null;
                return (
                  <div
                    key={i}
                    className={`pp-cell pp-cell-${i + 1} pp-cell--photo`}
                    style={{ backgroundImage: `url(${photo})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    role="img"
                    aria-label={`${data.property_name} — photo ${i + 1}`}
                  />
                );
              })}

              <button
                type="button"
                className="pp-gallery-more"
                aria-label="View all photos"
                onClick={() => {
                  if (galleryUrls.length === 0) return;
                  Promise.all([
                    import('@fancyapps/ui'),
                    import('@fancyapps/ui/dist/fancybox/fancybox.css'),
                  ]).then(([{ Fancybox }]) => {
                    (Fancybox as { show: (items: object[]) => void }).show(
                      galleryUrls.map((u) => ({ src: u, type: 'image' })),
                    );
                  }).catch(() => {});
                }}
              >
                <PpGridIcon size={13} />
                {galleryUrls.length > 5 ? `View all ${galleryUrls.length} photos` : 'View gallery'}
              </button>
            </div>

            {/* ---- TASK-1359: Virtual tour ---- */}
            {data.virtualTourUrl && toEmbedUrl(data.virtualTourUrl) && (
              <div style={{ marginTop: 24, borderRadius: 18, overflow: 'hidden', aspectRatio: '16/9', width: '100%' }}>
                <iframe
                  src={toEmbedUrl(data.virtualTourUrl)!}
                  title="Virtual property tour"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ width: '100%', height: '100%', border: 0 }}
                />
              </div>
            )}
            {Number.isFinite(Number(resolvedListingId)) && Number(resolvedListingId) > 0 && (
              <Suspense fallback={null}>
                <VirtualTourSection listingId={Number(resolvedListingId)} />
              </Suspense>
            )}

            {/* ---- v2: Location/Map promoted to upper-third (below gallery) ---- */}
            {ppHasLocation && (
              <div className="pp-v2-location">
                <div className="pp-v2-location-head">
                  <h2>Where you&rsquo;ll be</h2>
                  {(data.propertyAddress || data.property_address || data.property_location) && (
                    <span className="pp-v2-loc-chip">
                      <PpV2PinIcon size={12} />
                      {String(data.propertyAddress || data.property_address || data.property_location).trim()}
                    </span>
                  )}
                </div>
                <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #f0ddd0' }}>
                  {(() => {
                    // Task 3: property's own coords win over custom embed / multi-pin / tenant default.
                    const mapSelection = selectPropertyMapMode({
                      latitude: data.latitude,
                      longitude: data.longitude,
                      mapSrc: mapSrcTrimmed,
                      useMultiPin,
                      mapLocation,
                    });
                    switch (mapSelection.kind) {
                      case 'coords':
                        return (
                          <SinglePinGoogleMap
                            lat={mapSelection.lat}
                            lng={mapSelection.lng}
                            zoom={15}
                            markerTitle={data.property_name}
                          />
                        );
                      case 'iframe':
                        return (
                          <iframe
                            src={mapSrcTrimmed}
                            style={{ width: '100%', height: 300, border: 0, display: 'block' }}
                            loading="lazy"
                            allowFullScreen
                            referrerPolicy="no-referrer-when-downgrade"
                            title="Property Location"
                          />
                        );
                      case 'multipin':
                        return <MultiPinMap pins={propertyPins} height={300} />;
                      case 'tenant':
                        return (
                          <SinglePinGoogleMap
                            lat={mapSelection.lat}
                            lng={mapSelection.lng}
                            zoom={mapLocation && typeof mapLocation.zoom === 'number' && mapLocation.zoom > 0 ? mapLocation.zoom : 15}
                            markerTitle={mapLocation?.markerLabel ?? tenantNameForMap}
                          />
                        );
                      default:
                        return null;
                    }
                  })()}
                </div>
              </div>
            )}

            {/* ---- Two-column main ---- */}
            <div className="pp-main">

              {/* ===== LEFT COLUMN ===== */}
              <div>

                {/* Host strip + trust panel */}
                <section className="pp-section" style={{ paddingTop: 28 }} aria-label="About the host">
                  <div className="pp-host">
                    <div className="pp-host-avatar" aria-hidden="true">{ppHostInitial}</div>
                    <div>
                      <div className="pp-host-name">
                        {ppHostDisplayName}
                      </div>
                      <div className="pp-host-sub">
                        Hosted directly · Responds on WhatsApp · Direct booking
                        {responseTimeBadge ? ` · ${responseTimeBadge}` : ''}
                        {reviewReplyRateBadge ? ` · ${reviewReplyRateBadge}` : ''}
                      </div>
                    </div>
                    <div className="pp-host-actions">
                      {!ppIsDraft && ppHasHostPhone && (
                        <a
                          href={ppWaBookingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pp-btn pp-btn-whatsapp pp-btn-sm"
                          data-testid="chat-with-host-btn"
                          aria-label={`Message host about ${data.property_name} on WhatsApp`}
                          onClick={() => trackEvent('whatsapp_cta_click', { listingId: resolvedListingId })}
                        >
                          <PpWhatsAppIcon size={14} /> Message on WhatsApp
                        </a>
                      )}
                      {ppHasHostPhone && (
                        <a
                          href={ppWaAskUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`pp-btn pp-btn-sm${ppIsDraft ? ' pp-btn-whatsapp' : ' pp-btn-ghost'}`}
                          aria-label="Ask host a question on WhatsApp"
                          data-testid={ppIsDraft ? 'draft-listing-ask-host' : undefined}
                        >
                          {ppIsDraft ? (
                            <><PpWhatsAppIcon size={14} /> Ask a question</>
                          ) : (
                            'Ask a question'
                          )}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* "What verified means" panel — TASK-5181: also the CROSS-LAYOUT canary
                      contract (role="note" + data-testid="pp-host-note") that used to live on the
                      fabricated "A note from your host" quote panel below. TASK-4987's E2E
                      contrast gate needs ONE always-rendered --lavender-soft/--lavender-text
                      surface per layout to corroborate the page actually painted before trusting a
                      zero-violation axe scan. That panel's content is now gated on a real
                      per-listing field (data.hostAbout) and correctly does not render when that
                      field is empty, so it can no longer anchor an unconditional canary. This
                      panel is real, always-rendered, non-fabricated platform copy — founder ruling
                      2026-07-30 re-points the gate here, resolving the TASK-4987 deadlock without
                      depending on content that may legitimately be absent. */}
                  <div
                    className="pp-verified-panel"
                    role="note"
                    data-testid="pp-host-note"
                    aria-label="What verified means"
                    style={{
                      background: 'var(--lavender-soft, #f0eafd)',
                      borderLeft: '4px solid var(--lavender-deep, #8e7cc3)',
                    }}
                  >
                    <div className="pp-verified-panel-head">
                      <span className="pp-shield" aria-hidden="true"><PpShieldIcon size={22} /></span>
                      <h3>
                        What &ldquo;verified&rdquo; means at {ppBrandName}
                        <small style={{ color: 'var(--lavender-text, #6f5aa8)' }}>This isn&rsquo;t a badge we hand out. Here&rsquo;s what we actually checked.</small>
                      </h3>
                    </div>
                    <ul className="pp-verified-list">
                      <li>
                        <PpCheckIcon size={16} />
                        <span>
                          <b>Direct booking — no middlemen.</b>
                          {/* TASK-7428: only claim the Razorpay rail when a gateway will actually
                              take the payment. On a WhatsApp-handoff / pay-on-arrival tenant no
                              payment is taken on this site at all. */}
                          {ppHasOnlinePayment && (
                            <span className="pp-meta">You pay the host directly via Razorpay.</span>
                          )}
                        </span>
                      </li>
                      {ppHasMapCoordinates ? (
                        <li>
                          <PpCheckIcon size={16} />
                          <span>
                            <b>Map location provided by the host.</b>
                          </span>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                </section>

                {/* A note from your host — TASK-5181: renders ONLY when the listing has a real,
                    host-authored note (data.hostAbout). No fallback string, no default copy — an
                    absent/empty field means nothing renders here at all (previously a fabricated
                    first-person quote rendered for every listing, sometimes signed with the real
                    host's name — that fabrication is the defect this task fixes). This panel no
                    longer carries the cross-layout contrast-gate canary; see the "What verified
                    means" panel above for that contract, and HostAboutNote.tsx for the gating
                    rule shared by both layouts. */}
                <HostAboutNote
                  hostAbout={ppHostAbout}
                  hasRealHost={ppHasRealHost}
                  hostDisplayName={ppHostDisplayName}
                  heading="A note from your host"
                  ariaLabel="A note from your host"
                />

                {/* About this home */}
                <section className="pp-section" aria-label="About this home">
                  <h2>About this home</h2>
                  {data.property_description && (
                    <p className="pp-prose">
                      {showAboutMore
                        ? data.property_description
                        : `${data.property_description.slice(0, 300)}${data.property_description.length > 300 ? '…' : ''}`}
                    </p>
                  )}
                  {data.property_description && data.property_description.length > 300 && (
                    <button
                      type="button"
                      className="pp-prose-more"
                      onClick={() => setShowAboutMore((s) => !s)}
                      aria-expanded={showAboutMore}
                    >
                      {showAboutMore ? 'Show less' : 'Read more'}
                      <PpChevronDown size={14} />
                    </button>
                  )}
                  {/* Check-in / Check-out times */}
                  {(resolvedCheckInTime || resolvedCheckOutTime) && (
                    <div
                      style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16 }}
                      data-testid="property-check-in-schedule"
                    >
                      {resolvedCheckInTime && (
                        <span style={{ fontSize: 14, color: 'var(--text-muted, #6b5a55)' }} data-testid="property-check-in-time">
                          <strong style={{ color: 'var(--text-primary, #4a3535)' }}>Check-in:</strong> {resolvedCheckInTime}
                        </span>
                      )}
                      {resolvedCheckOutTime && (
                        <span style={{ fontSize: 14, color: 'var(--text-muted, #6b5a55)' }}>
                          <strong style={{ color: 'var(--text-primary, #4a3535)' }}>Check-out:</strong> {resolvedCheckOutTime}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Neighborhoods */}
                  {(data.property_neighborhoods || []).length > 0 && (
                    <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }} role="list" aria-label="Neighborhoods">
                      {data.property_neighborhoods!.map((n, idx) => (
                        <span key={`${n}-${idx}`} className="pp-chip" role="listitem">
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                </section>

                {/* Amenities */}
                <section className="pp-section" aria-label="Amenities">
                  <div className="pp-section-head">
                    <h2>What&rsquo;s here</h2>
                  </div>
                  <div className="pp-amenities">
                    {ppAmenityCodes
                      ? ppAmenityCodes.map((code) => {
                          const label = amenityMaster.get(code.toLowerCase()) ?? formatAmenityName(code);
                          return (
                            <div key={code} className="pp-amenity">
                              <span style={{ fontSize: 18, color: 'var(--brand-accent, #f08c71)', flexShrink: 0 }} aria-hidden="true">
                                {renderIconForCode(code)}
                              </span>
                              <span>{label}</span>
                            </div>
                          );
                        })
                      : ppAmenityDisplay.map((label, idx) => (
                          <div key={`${label}-${idx}`} className="pp-amenity">
                            <span style={{ fontSize: 18, color: 'var(--brand-accent, #f08c71)', flexShrink: 0 }} aria-hidden="true">
                              {renderIcon(label)}
                            </span>
                            <span>{label}</span>
                          </div>
                        ))
                    }
                  </div>
                  {ppAmenityLabels.length > 12 && (
                    <button
                      type="button"
                      className="pp-prose-more"
                      onClick={() => setShowAmenitiesModal(true)}
                      aria-expanded={showAmenitiesModal}
                    >
                      Show all {ppAmenityLabels.length} amenities
                      <PpChevronDown size={14} />
                    </button>
                  )}
                </section>

                {/* Guest Reviews */}
                {(() => {
                  const api = listingReviewsFromApi;
                  // TASK-2897: API-only reviews — never static marketing snippets or data.ts ratings.
                  if (api?.loading) return (
                    <section className="pp-section" aria-label="Guest reviews">
                      <div className="pp-section-head"><h2>Guest reviews</h2></div>
                      <div style={{ height: 120, borderRadius: 16, background: '#f0ddd0' }} />
                    </section>
                  );
                  if (!api || api.totalCount <= 0) return null;
                  const rating = api.averageRating;
                  const count = api.totalCount;
                  return (
                    <section className="pp-section" aria-label="Guest reviews" data-testid="reviews-section">
                      <div className="pp-section-head">
                        <h2>
                          ★ {rating.toFixed(1)} from {count}{' '}
                          {count === 1 ? 'guest' : 'guests'}
                        </h2>
                      </div>

                      {/* v2 reviews summary: big rating + breakdown bars */}
                      <div className="pp-v2-reviews-summary">
                        <div>
                          <div className="pp-v2-rating-big" aria-label={`${rating.toFixed(1)} out of 5`}>
                            {rating.toFixed(1)}
                          </div>
                          <span className="pp-rating-stars" aria-hidden="true">★★★★★</span>
                          <div className="pp-v2-rating-big-sub">{count} verified {count === 1 ? 'stay' : 'stays'}</div>
                        </div>
                        {/* Sub-rating bars derived from API reviews if available */}
                        {api.reviews.length > 0 && (() => {
                          const rs = api.reviews;
                          const avg = (vals: (number | null | undefined)[]) => {
                            const valid = vals.filter((v): v is number => v != null && v >= 1);
                            return valid.length > 0 ? (valid.reduce((a, b) => a + b, 0) / valid.length) : null;
                          };
                          const cleanliness = avg(rs.map(r => r.ratingCleanliness));
                          const comms = avg(rs.map(r => r.ratingCommunication));
                          const checkin = avg(rs.map(r => r.ratingCheckin));
                          const value = avg(rs.map(r => r.ratingValue));
                          const bars = [
                            { label: 'Cleanliness', v: cleanliness },
                            { label: 'Communication', v: comms },
                            { label: 'Check-in', v: checkin },
                            { label: 'Value', v: value },
                          ].filter(b => b.v != null);
                          if (bars.length === 0) {
                            return (
                              <div style={{ fontSize: 14, color: 'var(--text-muted, #6b5a55)', lineHeight: 1.6 }}>
                                <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--text-primary, #4a3535)' }}>Overall rating</p>
                                <p style={{ margin: 0 }}>
                                  {count} verified {count === 1 ? 'review' : 'reviews'} · all through this platform.
                                </p>
                              </div>
                            );
                          }
                          return (
                            <>
                              <div className="pp-v2-rating-bars">
                                {bars.map(b => (
                                  <div key={b.label} className="pp-v2-rating-bar-row">
                                    <span>{b.label}</span>
                                    <div className="pp-v2-rating-bar">
                                      <span style={{ width: `${Math.round((b.v! / 5) * 100)}%` }} />
                                    </div>
                                    <span className="pp-v2-rating-bar-val">{b.v!.toFixed(1)}</span>
                                  </div>
                                ))}
                              </div>
                              <p style={{ fontSize: 12, color: 'var(--text-muted, #6b5a55)', marginTop: 6 }}>Based on {rs.length} recent review{rs.length !== 1 ? 's' : ''}</p>
                            </>
                          );
                        })()}
                      </div>

                      {api.reviews.length > 0 ? (
                        <>
                          {/* TASK-4404: review summary (sentiment + top keywords) — same id source as the reviews fetch */}
                          <Suspense fallback={null}>
                            <ReviewSummary listingId={Number(resolvedListingId ?? NaN)} />
                          </Suspense>
                          {/* v2: 3-col card layout with quote marks */}
                          <div className="pp-v2-review-grid" data-testid="reviews-grid">
                            {ppDisplayedReviews.map((r, idx) => (
                              <article key={r.id} className="pp-v2-review-card">
                                <span className="pp-v2-review-quote" aria-hidden="true">&ldquo;</span>
                                {r.body && <p className="pp-v2-review-body">{r.body}</p>}
                                {!r.body && r.title && <p className="pp-v2-review-body">{r.title}</p>}
                                {(() => {
                                  const chips: { label: string; v: number }[] = [];
                                  if (r.ratingCleanliness != null && r.ratingCleanliness >= 1) chips.push({ label: 'Cleanliness', v: r.ratingCleanliness });
                                  if (r.ratingValue != null && r.ratingValue >= 1) chips.push({ label: 'Value', v: r.ratingValue });
                                  if (chips.length === 0) return null;
                                  return (
                                    <p style={{ marginBottom: 6, fontSize: 11.5, color: 'var(--text-muted, #6b5a55)' }} data-testid="review-sub-ratings">
                                      {chips.map((c, i) => <span key={c.label}>{i > 0 ? ' · ' : ''}{c.label} {c.v}/5</span>)}
                                    </p>
                                  );
                                })()}
                                {r.isVerifiedStay && (
                                  <span className="pp-review-verified" style={{ marginBottom: 10 }}>
                                    <PpCheckIcon size={10} /> Verified stay
                                  </span>
                                )}
                                <div className="pp-v2-review-foot">
                                  <div
                                    className="pp-v2-review-avatar"
                                    aria-hidden="true"
                                    style={{
                                      background: PP_REVIEW_BG_COLORS[idx % PP_REVIEW_BG_COLORS.length],
                                      color: PP_REVIEW_TEXT_COLORS[idx % PP_REVIEW_TEXT_COLORS.length],
                                    }}
                                  >
                                    {(r.guestName ?? 'G').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="pp-v2-review-name">{r.guestName ?? 'Guest'}</div>
                                    <div className="pp-v2-review-date">
                                      {new Date(r.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                                    </div>
                                  </div>
                                </div>
                                {r.hostResponse && (
                                  <div className="pp-review-host-resp" style={{ marginTop: 10 }}>
                                    <div className="pp-review-host-resp-label">Host response</div>
                                    <p>{r.hostResponse}</p>
                                  </div>
                                )}
                              </article>
                            ))}
                          </div>
                          {api.reviews.length > 6 && (
                            <button
                              type="button"
                              onClick={() => setShowAllReviews((s) => !s)}
                              className="pp-prose-more"
                              style={{ marginTop: 16 }}
                              aria-expanded={showAllReviews}
                            >
                              {showAllReviews
                                ? 'Show fewer reviews'
                                : `View all ${api.totalCount} reviews`}
                              <PpChevronDown size={14} />
                            </button>
                          )}
                        </>
                      ) : (
                        <p style={{ fontSize: 14, color: 'var(--text-muted, #6b5a55)', fontStyle: 'italic' }}>
                          Ratings only — written reviews coming soon.
                        </p>
                      )}
                    </section>
                  );
                })()}

                {/* Cancellation policy */}
                <section className="pp-section" aria-label="Cancellation policy">
                  <h2 style={{ marginBottom: 18 }}>If you need to cancel</h2>
                  <div className="pp-refund">
                    <div className="pp-refund-head">
                      <div>
                        <h3>{ppCancellationInfo.headline}</h3>
                        <p>{ppCancellationInfo.description}</p>
                      </div>
                    </div>
                    <div className="pp-timeline" role="list">
                      {ppCancellationInfo.steps.map((step) => (
                        <div key={step.title} className="pp-timeline-step" role="listitem">
                          <div className="pp-tl-dot" aria-hidden="true" />
                          <h6>{step.title}</h6>
                          <p>{step.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Things to know — v2 3-card structure */}
                <section className="pp-section" aria-label="Things to know">
                  <h2 style={{ marginBottom: 18 }}>Things to know</h2>
                  <div className="pp-v2-knowgrid">
                    {/* Base occupancy card */}
                    <div className="pp-v2-knowcard">
                      <div className="pp-v2-knowicon"><PpV2UsersIcon /></div>
                      <small>Base occupancy</small>
                      <strong>
                        {data.maxGuests != null && data.maxGuests > 0 ? `${data.maxGuests} guest${data.maxGuests === 1 ? '' : 's'}` : 'Ask host'}
                      </strong>
                      <span>
                        {data.maxGuests != null && data.maxGuests > 0
                          ? `Up to ${data.maxGuests} guest${data.maxGuests === 1 ? '' : 's'} welcome.`
                          : 'Contact host for occupancy details.'}
                      </span>
                    </div>
                    {/* Check-in card */}
                    <div className="pp-v2-knowcard" data-testid="property-check-in-card">
                      <div className="pp-v2-knowicon"><PpV2ClockInIcon /></div>
                      <small>Check-in</small>
                      <strong data-testid={resolvedCheckInTime ? 'property-check-in-time' : 'property-check-in-pending'}>
                        {resolvedCheckInTime ?? 'Confirmed after booking'}
                      </strong>
                      {resolvedCheckInTime && <span>Early check-in subject to availability.</span>}
                    </div>
                    {/* Check-out card */}
                    <div className="pp-v2-knowcard">
                      <div className="pp-v2-knowicon"><PpV2ClockOutIcon /></div>
                      <small>Check-out</small>
                      <strong>{resolvedCheckOutTime ?? 'Confirmed after booking'}</strong>
                      {resolvedCheckOutTime && <span>Late check-out subject to availability.</span>}
                    </div>
                  </div>
                </section>

                {/* Similar stays */}
                {(() => {
                  const s = similarFromApi;
                  if (s?.loading) return (
                    <section className="pp-section" aria-label="Similar stays">
                      <div className="pp-section-head"><h2>Similar stays</h2></div>
                      <div style={{ height: 120, borderRadius: 16, background: '#f0ddd0' }} />
                    </section>
                  );
                  if (!s || !Array.isArray(s.items) || s.items.length === 0) return null;
                  return (
                    <section className="pp-section" aria-label="Similar stays">
                      <div className="pp-section-head"><h2>Similar stays</h2></div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                        {s.items.slice(0, 4).map((it: any) => {
                          const id = Number(it.id);
                          const rawName = String(it.name ?? it.propertyName ?? `Listing ${it.id}`);
                          const name = getListingDisplayName(id, rawName);
                          const img = (it.coverPhotoUrl as string | undefined) ?? (Array.isArray(it.photoUrls) ? it.photoUrls[0] : undefined);
                          const path = buildHomeUnitPath(getPropertySlug({ name: it.propertyName, property_name: it.propertyName }), id);
                          return (
                            <Link
                              key={String(it.id)}
                              to={path}
                              style={{ display: 'block', borderRadius: 16, border: '1px solid var(--border-subtle, #f0ddd0)', overflow: 'hidden', textDecoration: 'none', background: '#fff' }}
                            >
                              {img && <img src={img} alt={name} style={{ width: '100%', height: 140, objectFit: 'cover' }} loading="lazy" decoding="async" width={300} height={140} />}
                              <div style={{ padding: '12px 14px' }}>
                                <p style={{ fontWeight: 600, color: 'var(--text-primary, #4a3535)', fontSize: 14, margin: '0 0 4px' }}>{name}</p>
                                <p style={{ fontSize: 12.5, color: 'var(--text-muted, #6b5a55)', margin: 0 }}>{String(it.propertyAddress ?? '').slice(0, 60)}</p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </section>
                  );
                })()}

                {/* Nearby places — standalone section (map promoted to upper-third in v2) */}
                {(data.property_nearplaces || []).length > 0 && (
                  <section className="pp-section" aria-label="Nearby places">
                    <div className="pp-section-head">
                      <h2>Nearby places</h2>
                    </div>
                    <div className="pp-nearby">
                      {data.property_nearplaces!.slice(0, 9).map((place, idx) => (
                        <div key={`place-${idx}`} className="pp-nearby-item">
                          <b>{place}</b>
                          <span>Nearby</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

              </div>
              {/* ===== END LEFT COLUMN ===== */}

              {/* ===== RIGHT COLUMN — sticky booking ===== */}
              <aside className="pp-booking-col" aria-label="Booking">
                {galleryUrls.length > 0 && (
                  <p style={{ fontSize: 13, color: 'var(--text-muted, #6b5a55)', marginBottom: 8 }}>
                    {galleryUrls.length} photo{galleryUrls.length !== 1 ? 's' : ''}
                  </p>
                )}
                {!ppIsBookable ? (
                  <div
                    className="pp-draft-notice"
                    data-testid="draft-booking-notice"
                    aria-label="Listing not yet available for booking"
                    style={{
                      border: '1px solid var(--border-subtle, #f0ddd0)',
                      borderRadius: 12,
                      padding: '20px 18px',
                      background: 'var(--bg-muted, #f5ebe0)',
                      color: 'var(--text-muted, #6b5a55)',
                      textAlign: 'center',
                      opacity: 0.85,
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-primary, #4a3535)', marginBottom: 6 }}>
                      Not yet available for booking
                    </div>
                    <div style={{ fontSize: 13 }}>
                      This listing is still being prepared and isn’t open for reservations yet. Please
                      check back soon.
                    </div>
                  </div>
                ) : (
                  <>
                    <Suspense fallback={<SkeletonCard />}>
                      <UnitBookingWidget
                        listingId={resolvedListingId ?? undefined}
                        propertyId={listingPropertyId ?? undefined}
                        listingName={getListingDisplayName(data.id ?? data.listingId, data.property_name) || 'This property'}
                        timezoneId={data.timezoneId}
                        coverPhotoUrl={primaryImage}
                        maxGuests={data.maxGuests}
                        propertySlug={propertySlugParam}
                        unitSlug={unitSlugParam}
                        reviewRating={ppHasApiReviews ? ppApiReviews!.averageRating : undefined}
                        reviewCount={ppHasApiReviews ? ppApiReviews!.totalCount : undefined}
                        minStayNights={
                          data.minStay != null && Number.isFinite(data.minStay) && data.minStay > 0
                            ? data.minStay
                            : 1
                        }
                        cancellationTier={data.cancellationTier ?? null}
                        cancellationWindowHours={data.cancellationWindowHours ?? null}
                        graceHours={data.graceHours ?? null}
                        onStickySummaryChange={setStickyBookingSummary}
                      />
                    </Suspense>

                    {/* TASK-4015: Save vs OTA delta */}
                    {data.property_price && data.property_price > 0 && (
                      <div style={{
                        marginTop: 16,
                        padding: '12px 14px',
                        borderRadius: 8,
                        background: '#e9f5ef',
                        border: '1px solid #d2ebde',
                      }} data-testid="save-vs-ota-delta">
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#157046', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>💰</span>
                          <span>Save ~₹{Math.round(data.property_price * 2 * 0.155).toLocaleString('en-IN')} by booking directly</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#157046', marginTop: 4 }}>
                          vs OTA platforms that charge 15–18%
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Trust band — consolidates legitimacy, cancellation & payment
                    (DESIGN-003). Absorbs the former standalone verified pill.
                    Each row degrades gracefully on missing data. */}
                <div className="pp-trust" data-testid="property-trust-band" aria-label="Booking trust details">
                  <div className="pp-trust-row">
                    <ShieldCheck className="pp-trust-ic" size={18} aria-hidden="true" />
                    <div>
                      <div className="pp-trust-t">
                        {ppHasOnlinePayment ? `Instant book` : `Host-confirmed booking`}
                      </div>
                    </div>
                  </div>
                  <div className="pp-trust-row">
                    <CalendarClock className="pp-trust-ic" size={18} aria-hidden="true" />
                    <div>
                      <div className="pp-trust-t">{ppCancellationInfo.headline}</div>
                      <div className="pp-trust-s">{ppCancellationInfo.description}</div>
                    </div>
                  </div>
                  <div className="pp-trust-row">
                    <CreditCard className="pp-trust-ic" size={18} aria-hidden="true" />
                    <div>
                      <div className="pp-trust-t">Direct booking · no OTA fees</div>
                      <div className="pp-trust-s">
                        {ppHasOnlinePayment
                          ? 'You pay the host directly. Secure payment via Razorpay (UPI, cards, netbanking).'
                          : 'You pay the host directly — no middle-man fees. The host confirms your dates.'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* WhatsApp CTA (sidebar) — TASK-2873: draft listings are question-only, not book-via-WhatsApp.
                    Guard: only render when ppHasHostPhone — never show a recipient-less wa.me link on a
                    white-label tenant with no configured number (cross-tenant data leak). */}
                {ppHasHostPhone && (
                  <div style={{ marginTop: 12 }}>
                    {!ppIsBookable ? (
                      <>
                        <p className="pp-host-sub" style={{ marginBottom: 8 }}>
                          This home is not open for booking yet. You can still ask a question.
                        </p>
                        <a
                          href={ppWaAskUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pp-btn pp-btn-whatsapp pp-btn-block"
                          data-testid="draft-listing-ask-host-sidebar"
                          aria-label={`Ask about ${data.property_name} on WhatsApp`}
                        >
                          <PpWhatsAppIcon size={16} />
                          Ask a question
                        </a>
                      </>
                    ) : (
                      <a
                        href={ppWaBookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pp-btn pp-btn-whatsapp pp-btn-block"
                        data-testid="chat-with-host-btn"
                        aria-label={`Message host about ${data.property_name} on WhatsApp`}
                        onClick={() => trackEvent('whatsapp_cta_click', { listingId: resolvedListingId })}
                      >
                        <PpWhatsAppIcon size={16} />
                        Chat with host
                      </a>
                    )}
                  </div>
                )}

                {/* Availability Calendar */}
                {resolvedListingId && (
                  <Suspense fallback={
                    <div style={{ borderRadius: 12, border: '1px solid #f0ddd0', background: '#f9f5f0', height: 256, marginTop: 16 }} />
                  }>
                    <AvailabilityCalendar
                      listingId={resolvedListingId}
                      onDateSelect={(ymd) => {
                        const ev = new CustomEvent('atlas:set-checkin', { detail: ymd });
                        window.dispatchEvent(ev);
                      }}
                    />
                  </Suspense>
                )}

                {showAvailabilityPlaceholder && (
                  <div style={{ borderRadius: 18, border: '1px solid #f0ddd0', background: '#fff', padding: 24, marginTop: 16 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: '#4a3535', marginBottom: 8 }}>Check Availability</h3>
                    <p style={{ fontSize: 14, color: 'var(--text-muted, #6b5a55)', marginBottom: 16 }}>
                      Availability check is currently unavailable. Please try again later.
                    </p>
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={() => window.location.reload()}
                      disabled={isListingLookupPending}
                    >
                      {isListingLookupPending ? 'Loading...' : 'Try Again'}
                    </Button>
                  </div>
                )}
              </aside>

            </div>
            {/* ===== END pp-main ===== */}

            {/* Tourism registration row */}
            {ppShowRegRow && (
              <div className="pp-reg-row" aria-label="Operator registration details">
                <b>Registered operator.</b>{' '}
                {ppTenantOverrides.gstin && (
                  <>GSTIN <code>{ppTenantOverrides.gstin}</code>{' '}</>
                )}
                {ppTenantOverrides.tourismRegNumbers?.map((reg) => (
                  <span key={reg}>· Tourism Reg. <code>{reg}</code>{' '}</span>
                ))}
                · {ppBrandName}
              </div>
            )}

          </div>
          {/* ===== END pp-shell ===== */}

          {/* Mobile sticky CTA — TASK-5192: any non-bookable status (Draft/Archived/Unlisted)
              shows a notice instead of price + Reserve (sidebar already uses ppIsBookable). */}
          <PropertyMobileStickyBar
            bookable={ppIsBookable}
            nightlyFallback={ppStickyNightly}
            nightlyIsSynthetic={directBookingNightlyIsSynthetic}
            summary={stickyBookingSummary}
            onReserveClick={() => {
              const widget = document.querySelector('[data-testid="guest-booking-form"]');
              widget?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          />

        </div>
        {/* ===== END pp-root ===== */}

        {/* Amenities Modal — preserved from original */}
        {showAmenitiesModal && (
          <div className="fixed inset-0 bg-[color:color-mix(in_srgb,var(--text-primary)_70%,transparent)] z-[var(--z-modal)] flex items-center justify-center p-4">
            <div className="bg-bg-surface rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-border-subtle">
              <div className="flex items-center justify-between p-6 border-b border-border-subtle">
                <h3 className="text-xl sm:text-2xl font-semibold text-text-primary">All Amenities</h3>
                <button
                  onClick={() => setShowAmenitiesModal(false)}
                  className="p-2 hover:bg-bg-muted rounded-full transition"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
              <div className="overflow-y-auto p-6" role="region" aria-label="List of all amenities">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6" role="list">
                  {data.amenityCodes && data.amenityCodes.length > 0 ? (
                    data.amenityCodes.map((code) => {
                      const label = amenityMaster.get(code.toLowerCase()) ?? formatAmenityName(code);
                      return (
                        <div key={code} className="flex items-center gap-3 sm:gap-4" role="listitem">
                          <span className="text-xl sm:text-2xl text-text-primary" aria-hidden="true">
                            {renderIconForCode(code)}
                          </span>
                          <span className="text-text-primary text-sm sm:text-base">{label}</span>
                        </div>
                      );
                    })
                  ) : (
                    (data.property_amenities || []).map((amenity, idx) => {
                      const icon = amenity?.amenities_icon || '';
                      const displayName = icon ? formatAmenityName(icon) : 'Amenity';
                      return (
                        <div key={`amenity-${idx}-${displayName}`} className="flex items-center gap-3 sm:gap-4" role="listitem">
                          <span className="text-xl sm:text-2xl text-text-primary" aria-hidden="true">
                            {renderIcon(icon) || '•'}
                          </span>
                          <span className="text-text-primary text-sm sm:text-base">{displayName}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="p-6 border-t border-border-subtle">
                <Button onClick={() => setShowAmenitiesModal(false)} fullWidth variant="secondary">Close</Button>
              </div>
            </div>
          </div>
        )}

        {/* TASK-1728: Guest Assistant FAQ widget */}
        <Suspense fallback={null}>
          <GuestAssistant listingId={resolvedListingId ?? data.listingId ?? null} />
        </Suspense>
        </>
    );
};

export default PropertyDetails;
