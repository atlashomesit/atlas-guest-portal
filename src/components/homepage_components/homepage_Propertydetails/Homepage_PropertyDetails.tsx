import './Homepage_PropertyDetails.css';
import React from 'react';
import { getListingDisplayName } from '@/lib/listingDisplayName';
import { getTenantContext as _getTenantCtx } from '@/tenant/tenantContext';
import { getTenantOverrides, shouldHideAtlasBranding } from '@/tenant/tenantOverrides';
import { getTenantBrandName } from '@/tenant/displayBrand';
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
import { useBooking } from '../../../contexts/BookingContext';
import { resolveListing } from '../../../utils/listingResolver';
import { filterGuestImageUrls, sanitizeGuestImageUrl } from '../../../utils/guestImageUrl';
import type { ListingDetail, PublicListing } from '../../../api/listingClient';
import {
    fetchListingById,
    fetchListingContact,
    parseMaxGuestsFromPayload,
    resolveStaticMaxGuests,
} from '../../../api/listingClient';
import SEO from '../../SEO';
import MultiPinMap, { type MapPin } from '../../map/MultiPinMap';
import SinglePinGoogleMap from '../../map/SinglePinGoogleMap';
import { selectPropertyMapMode } from './propertyMapMode';
import { buildApiUrl, getApiHeaders } from '../../../api/client';
import { addRecentlyViewed, isFavorite, toggleFavorite } from '../../../utils/guestHistory';
import { formatCurrency } from '../../../utils/formatting';
import { useDailyPricingSummary } from '@/hooks/useDailyPricingSummary';
import SkeletonCard from '../../apartments/SkeletonCard';

const UnitBookingWidget = lazy(() => import('../../availability/UnitBookingWidget'));
const AvailabilityCalendar = lazy(() => import('../../AvailabilityCalendar'));
const GuestAssistant = lazy(() => import('../../GuestAssistant')); // TASK-1728
const VirtualTourSection = lazy(() => import('../../VirtualTourSection')); // Task 37

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
  { title: 'Refund initiated', desc: 'Automatic within 24 hours. Reference number sent to you.' },
  { title: 'Money in your account', desc: 'UPI: same day. Cards & netbanking: 3–5 working days.' },
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

function getPpCancellationInfo(
  tier: string | null | undefined,
  opts?: { fallbackText?: string; hasOnlinePayment?: boolean },
): PpCancellationInfo {
  const steps = getPpRefundSteps(opts?.hasOnlinePayment !== false);
  if (tier === 'Flexible') return {
    headline: 'Full refund if cancelled 48 hours before check-in',
    description: 'Money returns to the exact UPI or card you paid with. No phone calls needed.',
    steps,
  };
  if (tier === 'Moderate') return {
    headline: 'Full refund if cancelled 5 days before check-in',
    description: 'Partial refund for cancellations after the window. Check your booking for exact terms.',
    steps,
  };
  if (tier === 'Strict') return {
    headline: '50% refund if cancelled 7 days before check-in',
    description: 'No refund within 7 days of check-in. Check your booking for exact terms.',
    steps,
  };
  const fallback = opts?.fallbackText?.trim();
  if (fallback) {
    return {
      headline: fallback.length > 96 ? `${fallback.slice(0, 93)}…` : fallback,
      description: fallback,
      steps,
    };
  }
  return {
    headline: 'Flexible cancellation — full refund 48+ hours before check-in',
    description: 'Standard direct-booking policy. See your booking confirmation for exact cut-off times.',
    steps,
  };
}

const PP_REVIEW_BG_COLORS = ['#1a1a2e', '#ffb347', '#c2410c', '#94755b', '#e9f5ef'];
const PP_REVIEW_TEXT_COLORS = ['#fffaf5', '#1a1a2e', '#fffaf5', '#fffaf5', '#157046'];

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
    id: number;
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
    photoCount?: number;
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
    /** Street-level address from API (TASK-1896); may be null if host chose not to expose pre-booking */
    propertyAddress?: string | null;
    /** Legacy / alternate JSON key for same */
    property_address?: string | null;
    /** TASK-1359: YouTube / Vimeo virtual tour URL */
    virtualTourUrl?: string | null;
    /** TASK-1385: Cancellation policy tier from listing — Flexible, Moderate, or Strict. */
    cancellationTier?: 'Flexible' | 'Moderate' | 'Strict' | null;
    /** TL-GUEST: from GET /listings/{id} or /listings/public — drives same Google Maps JS path as Location page. */
    latitude?: number | null;
    longitude?: number | null;
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
    const [listingPropertyId, setListingPropertyId] = useState<string | number | null>(null);
    const [resolvedListingId, setResolvedListingId] = useState<string | number | null>(null);
    // TASK-2739-v1: "Draft" | "Published" (undefined on legacy payloads = treated as live).
    const [publishStatus, setPublishStatus] = useState<string | undefined>(undefined);
    const [, setListingLookupError] = useState<string | null>(null);
    const [isListingLookupPending, setIsListingLookupPending] = useState(false);
    const [showAmenitiesModal, setShowAmenitiesModal] = useState(false);
    const [showAboutMore, setShowAboutMore] = useState(false);
    const [showAllReviews, setShowAllReviews] = useState(false);
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

    useEffect(() => {
        const lid = Number(resolvedListingId ?? data?.listingId ?? NaN);
        if (!data || !Number.isFinite(lid) || lid <= 0) return;
        const hasMaxGuests = typeof data.maxGuests === 'number' && data.maxGuests >= 1;
        const hasGalleryImages = filterGuestImageUrls(data.property_img ?? []).length > 0;
        const hasHostPhone = typeof data.hostPhone === 'string' && data.hostPhone.trim().length > 0;
        if (hasMaxGuests && hasGalleryImages && hasHostPhone) return;

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
                    if (filterGuestImageUrls(prev.property_img ?? []).length === 0 && hydratedImages.length > 0) {
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

    /** TASK-2068: hero quote only from live API reviews (never static marketing snippets). */
    const _heroReviewQuote = useMemo(() => {
        const api = listingReviewsFromApi;
        if (!api || api.loading || api.reviews.length === 0) return null;
        const r = api.reviews[0];
        const text = String(r.body || r.title || '').trim();
        return text ? text.slice(0, 280) : null;
    }, [listingReviewsFromApi]);

    useEffect(() => {
        setNotFound(false);
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

        // 1) Match by listingId (PK from DB/API) — IDs 1–7 etc.
        const foundByListingId = listingIdParam && Number.isFinite(listingId) && listingId > 0
            ? apiProperties.find((item: Property) => Number(item.listingId) === listingId)
            : null;

        if (import.meta.env.DEV && listingIdParam) {
             
            console.debug('[PropertyDetails] route params:', { propertySlug, unitSlug: listingIdParam, listingId }, 'foundByListingId:', !!foundByListingId);
        }

        // 2) Match by unit slug / property name (legacy URLs)
        const foundByUnitSlug = foundByListingId ?? apiProperties.find((item: Property) => {
            const idSlug = normalizeSlug(item.id);
            const nameSlug = normalizeSlug(item.property_name);
            const unitMatches = normalizedUnitSlug && (idSlug === normalizedUnitSlug || nameSlug === normalizedUnitSlug);
            const propertySlugMatches =
                !normalizedPropertySlug ||
                nameSlug === normalizedPropertySlug ||
                nameSlug.includes(normalizedPropertySlug) ||
                stripHyphens(nameSlug) === normalizedPropertySlugStripped ||
                stripHyphens(nameSlug).includes(normalizedPropertySlugStripped);

            return unitMatches && propertySlugMatches;
        });

        if (foundByUnitSlug) {
            setData({
                ...foundByUnitSlug,
                property_neighborhoods: Array.isArray(foundByUnitSlug.property_neighborhoods)
                    ? foundByUnitSlug.property_neighborhoods
                    : [],
                property_img: foundByUnitSlug.property_img || [],
                maxGuests:
                    resolveStaticMaxGuests(foundByUnitSlug as unknown as Record<string, unknown>) ??
                    foundByUnitSlug.maxGuests,
            });
            return;
        }

        // If not found by slug, try to find by ID (e.g. unitSlug "7" matches item.id 501)
        const propertyId = normalizedUnitSlug || undefined;
        if (propertyId) {
            const foundById = apiProperties.find((item: Property) => String(item.id) === String(propertyId));
            if (foundById) {
                setData({
                    ...foundById,
                    property_neighborhoods: Array.isArray(foundById.property_neighborhoods)
                        ? foundById.property_neighborhoods
                        : [],
                    property_img: foundById.property_img || [],
                    maxGuests:
                        resolveStaticMaxGuests(foundById as unknown as Record<string, unknown>) ?? foundById.maxGuests,
                });
                return;
            }
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
                    const coverUrl = sanitizeGuestImageUrl(
                        (apiListing as Record<string, unknown>).coverPhotoUrl as string | undefined,
                    );
                    const photoUrlsRaw = (apiListing as Record<string, unknown>).photoUrls;
                    const photoUrlsList = filterGuestImageUrls(
                        Array.isArray(photoUrlsRaw)
                            ? [...new Set((photoUrlsRaw as string[]).filter(Boolean))]
                            : [],
                    );
                    const photoCount = Number((apiListing as Record<string, unknown>).photoCount) || 0;
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
                        property_rating: Number((apiListing as Record<string, unknown>).property_rating) || 0,
                        property_reviews: Number((apiListing as Record<string, unknown>).property_reviews) || 0,
                        property_price: Number((apiListing as Record<string, unknown>).property_price) || 0,
                        timezoneId: (apiListing as Record<string, unknown>).timezoneId as string | undefined,
                        photoCount: photoCount || (coverUrl ? 1 : 0),
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
                    if (!cancelled) setNotFound(true);
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
          coverPhotoUrl: Array.isArray(data.property_img) ? data.property_img[0] : undefined,
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
                    addressLocality: data.property_location || 'Hyderabad',
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

    if (!data && !notFound) {
        return <PropertyDetailsSkeleton />;
    }

    if (!data && notFound) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center max-w-xl px-4">
                    <h1 className="text-2xl font-semibold text-text-primary mb-4">Home Not Found</h1>
                    <div className="text-text-muted">
                        Please check the link and try again, or head back to our homes catalog to continue browsing.
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3 justify-center">
                        <Button onClick={() => window.history.back()} className="w-full sm:w-auto">
                            Go Back
                        </Button>
                        <Link
                            to="/"
                            className="inline-flex items-center justify-center rounded-full border border-border-subtle px-5 py-3 text-sm font-semibold text-text-primary transition hover:border-[color:var(--cta-primary)] hover:text-[color:var(--cta-primary)]"
                        >
                            Return to homepage
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const resolvedCheckInTime =
      data?.checkInTime?.trim() || data?.unitPolicy?.checkInTime?.trim() || null;
    const resolvedCheckOutTime =
      data?.checkOutTime?.trim() || data?.unitPolicy?.checkOutTime?.trim() || null;
    const cancellationPolicyText = (() => {
        const policies = data?.property_policy_details ?? [];
        const fromListingPolicy = policies.find((p) =>
            typeof p?.type === 'string' && p.type.toLowerCase().includes('cancellation'),
        )?.value;
        return fromListingPolicy || inlinePolicySnippets?.cancellation || 'Standard cancellation policy applies.';
    })();

    // TASK-1385: tier-specific plain-language text overrides generic policy copy when set
    const cancellationTierLabel: Record<string, string> = {
        Flexible: 'Flexible — full refund if cancelled 24+ hours before check-in.',
        Moderate: 'Moderate — full refund if cancelled 5+ days before check-in.',
        Strict: 'Strict — 50% refund if cancelled 7+ days before check-in; no refund after.',
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
    const ppHostDisplayName = ppTenantCtx?.name?.trim() || data.property_name || ppBrandName;
    const ppHostInitial = ppHostDisplayName.charAt(0).toUpperCase();
    const ppHasOnlinePayment =
      typeof _getTenantCtx()?.paymentProvider === 'string' && _getTenantCtx()?.paymentProvider !== 'MANUAL';
    const ppCancellationInfo = getPpCancellationInfo(data.cancellationTier, {
      fallbackText: _resolvedCancellationText,
      hasOnlinePayment: ppHasOnlinePayment,
    });
    const ppHasLocation =
        (typeof data.latitude === 'number' && Number.isFinite(data.latitude)) ||
        mapSrcTrimmed.length > 0 ||
        useMultiPin ||
        (mapLocation != null && typeof mapLocation.lat === 'number' && Number.isFinite(mapLocation.lat));
    const ppHostPhone = (data.hostPhone?.replace(/\D/g, '') || '').trim() || '7032493290';
    const ppWaBookingUrl = `https://wa.me/${ppHostPhone}?text=${encodeURIComponent(`Hi, I'm interested in booking ${data.property_name}`)}`;
    const ppWaAskUrl = `https://wa.me/${ppHostPhone}?text=${encodeURIComponent(`Hi, I have a question about ${data.property_name}`)}`;
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
    const ppSeoNoIndex = publishStatus != null && publishStatus !== 'Published';
    const ppHasMapCoordinates =
      typeof data.latitude === 'number' &&
      typeof data.longitude === 'number' &&
      Number.isFinite(data.latitude) &&
      Number.isFinite(data.longitude);
    const ppStickyNightly =
      directBookingNightly > 0 ? directBookingNightly : (nightlyPrice?.finalNightlyPrice ?? 0);

    return (
        <>
        {data && (
            <SEO
                title={`${getListingDisplayName(data.id, data.property_name)} | ${getTenantBrandName()}`}
                description={data.property_description?.slice(0, 160) || `Book ${getListingDisplayName(data.id, data.property_name)} in ${data.property_location || 'Hyderabad'} on ${getTenantBrandName()}.`}
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
                      background: '#fef3c7',
                      color: '#92400e',
                      fontSize: 12,
                      fontWeight: 600,
                      border: '1px solid #fcd34d',
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
                    const share = async () => {
                      if (typeof navigator.share === 'function') {
                        return navigator.share({ title: document.title, text, url });
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
                  <>
                    <div className="pp-cell-id-hero" aria-hidden="true">{data.id}</div>
                    <div className="pp-cell-overlay">
                      <span className="pp-dot" aria-hidden="true" />
                      <span>Photos coming soon · home is real</span>
                    </div>
                  </>
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
                  import('@fancyapps/ui').then(({ Fancybox }) => {
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
                <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #f0e6dc' }}>
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

                {/* Host strip + verified panel */}
                <section className="pp-section" style={{ paddingTop: 28 }} aria-label="About the host">
                  <div className="pp-host">
                    <div className="pp-host-avatar" aria-hidden="true">{ppHostInitial}</div>
                    <div>
                      <div className="pp-host-name">
                        {ppHostDisplayName}
                        <span className="pp-verified-badge">
                          <PpCheckIcon size={10} /> Verified
                        </span>
                      </div>
                      <div className="pp-host-sub">
                        Owner-operated · Responds on WhatsApp · Direct booking
                        {responseTimeBadge ? ` · ${responseTimeBadge}` : ''}
                      </div>
                    </div>
                    <div className="pp-host-actions">
                      {!ppIsDraft && (
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
                    </div>
                  </div>

                  {/* "What verified means" panel */}
                  <div className="pp-verified-panel">
                    <div className="pp-verified-panel-head">
                      <span className="pp-shield" aria-hidden="true"><PpShieldIcon size={22} /></span>
                      <h3>
                        What &ldquo;verified&rdquo; means at {ppBrandName}
                        <small>This isn&rsquo;t a badge we hand out. Here&rsquo;s what we actually checked.</small>
                      </h3>
                    </div>
                    <ul className="pp-verified-list">
                      <li>
                        <PpCheckIcon size={16} />
                        <span>
                          <b>Property photos are genuine.</b>
                          <span className="pp-meta">Our team reviewed listing photos before publishing.</span>
                        </span>
                      </li>
                      <li>
                        <PpCheckIcon size={16} />
                        <span>
                          <b>Reviewed before going live.</b>
                          <span className="pp-meta">
                            Every {ppBrandName} listing is checked for photos and basic details before publish.
                          </span>
                        </span>
                      </li>
                      {ppHasMapCoordinates ? (
                        <li>
                          <PpCheckIcon size={16} />
                          <span>
                            <b>Listed at the address on the map.</b>
                            <span className="pp-meta">The location pin matches the address shown on this page.</span>
                          </span>
                        </li>
                      ) : null}
                      <li>
                        <PpCheckIcon size={16} />
                        <span>
                          <b>Direct booking — no middlemen.</b>
                          <span className="pp-meta">You pay the host directly via Razorpay.</span>
                        </span>
                      </li>
                    </ul>
                  </div>
                </section>


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
                        <span style={{ fontSize: 14, color: '#475569' }} data-testid="property-check-in-time">
                          <strong style={{ color: '#1a1a2e' }}>Check-in:</strong> {resolvedCheckInTime}
                        </span>
                      )}
                      {resolvedCheckOutTime && (
                        <span style={{ fontSize: 14, color: '#475569' }}>
                          <strong style={{ color: '#1a1a2e' }}>Check-out:</strong> {resolvedCheckOutTime}
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
                              <span style={{ fontSize: 18, color: '#475569', flexShrink: 0 }} aria-hidden="true">
                                {renderIconForCode(code)}
                              </span>
                              <span>{label}</span>
                            </div>
                          );
                        })
                      : ppAmenityDisplay.map((label, idx) => (
                          <div key={`${label}-${idx}`} className="pp-amenity">
                            <span style={{ fontSize: 18, color: '#475569', flexShrink: 0 }} aria-hidden="true">
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
                      <div style={{ height: 120, borderRadius: 16, background: '#f0e6dc' }} />
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
                              <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
                                <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#1a1a2e' }}>Overall rating</p>
                                <p style={{ margin: 0 }}>
                                  {count} verified {count === 1 ? 'review' : 'reviews'} · all through this platform.
                                </p>
                              </div>
                            );
                          }
                          return (
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
                          );
                        })()}
                      </div>

                      {api.reviews.length > 0 ? (
                        <>
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
                                    <p style={{ marginBottom: 6, fontSize: 11.5, color: '#64748b' }} data-testid="review-sub-ratings">
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
                        <p style={{ fontSize: 14, color: '#475569', fontStyle: 'italic' }}>
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
                        {data.maxGuests != null && data.maxGuests > 0 ? `${data.maxGuests} guests` : 'Ask host'}
                      </strong>
                      <span>
                        {data.maxGuests != null && data.maxGuests > 0
                          ? `Up to ${data.maxGuests} guests welcome.`
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
                      <div style={{ height: 120, borderRadius: 16, background: '#f0e6dc' }} />
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
                              style={{ display: 'block', borderRadius: 16, border: '1px solid #f0e6dc', overflow: 'hidden', textDecoration: 'none', background: '#fff' }}
                            >
                              {img && <img src={img} alt={name} style={{ width: '100%', height: 140, objectFit: 'cover' }} loading="lazy" />}
                              <div style={{ padding: '12px 14px' }}>
                                <p style={{ fontWeight: 600, color: '#1a1a2e', fontSize: 14, margin: '0 0 4px' }}>{name}</p>
                                <p style={{ fontSize: 12.5, color: '#64748b', margin: 0 }}>{String(it.propertyAddress ?? '').slice(0, 60)}</p>
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
                  <p style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }} aria-label="Photo count">
                    {galleryUrls.length} photo{galleryUrls.length !== 1 ? 's' : ''}
                  </p>
                )}
                {!ppIsBookable ? (
                  <div
                    className="pp-draft-notice"
                    data-testid="draft-booking-notice"
                    aria-label="Listing not yet available for booking"
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      padding: '20px 18px',
                      background: '#f8fafc',
                      color: '#64748b',
                      textAlign: 'center',
                      opacity: 0.85,
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                      Not yet available for booking
                    </div>
                    <div style={{ fontSize: 13 }}>
                      This listing is still being prepared and isn’t open for reservations yet. Please
                      check back soon.
                    </div>
                  </div>
                ) : (
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
                    />
                  </Suspense>
                )}

                {/* Trust band — consolidates legitimacy, cancellation & payment
                    (DESIGN-003). Absorbs the former standalone verified pill.
                    Each row degrades gracefully on missing data. */}
                {(() => {
                  const pp = _getTenantCtx()?.paymentProvider;
                  const hasOnline = typeof pp === 'string' && pp !== 'MANUAL';
                  return (
                    <div className="pp-trust" data-testid="property-trust-band" aria-label="Booking trust details">
                      <div className="pp-trust-row">
                        <ShieldCheck className="pp-trust-ic" size={18} aria-hidden="true" />
                        <div>
                          <div className="pp-trust-t">
                            {hasOnline ? `Verified home · Instant book` : `Verified home · Host-confirmed booking`}
                          </div>
                          <div className="pp-trust-s">
                            Listing details and photos reviewed by {ppBrandName} before going live.
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
                            {hasOnline
                              ? 'You pay the host directly. Secure payment via Razorpay (UPI, cards, netbanking).'
                              : 'You pay the host directly — no middle-man fees. The host confirms your dates.'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Host profile card */}
                <div
                  className="pp-host"
                  style={{ marginTop: 12 }}
                  data-testid="host-profile-card"
                >
                  <div className="pp-host-avatar" aria-hidden="true" style={{ width: 44, height: 44, fontSize: 18 }}>
                    {ppHostInitial}
                  </div>
                  <div>
                    <div className="pp-host-name" style={{ fontSize: 15 }}>
                      Hosted by {ppHostDisplayName}
                    </div>
                    <div className="pp-host-sub">
                      24/7 WhatsApp support{responseTimeBadge ? ` · ${responseTimeBadge}` : ' · WhatsApp-first support.'}
                    </div>
                    {reviewReplyRateBadge && (
                      <p style={{ fontSize: 12, color: '#157046', fontWeight: 600, marginTop: 2 }}>
                        ✓ {reviewReplyRateBadge} within 48h
                      </p>
                    )}
                  </div>
                </div>

                {/* WhatsApp CTA (sidebar) — TASK-2873: draft listings are question-only, not book-via-WhatsApp */}
                <div style={{ marginTop: 12 }}>
                  {ppIsDraft ? (
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

                {/* Availability Calendar */}
                {resolvedListingId && (
                  <Suspense fallback={
                    <div style={{ borderRadius: 12, border: '1px solid #f0e6dc', background: '#f9f5f0', height: 256, marginTop: 16 }} />
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
                  <div style={{ borderRadius: 18, border: '1px solid #f0e6dc', background: '#fff', padding: 24, marginTop: 16 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: '#1a1a2e', marginBottom: 8 }}>Check Availability</h3>
                    <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
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

          {/* Mobile sticky CTA — TASK-2739-v1: Draft listings show a "not yet available" notice
              instead of the reserve bar (no booking surface until published). */}
          {ppIsDraft ? (
            <div
              className="pp-m-sticky"
              aria-label="Listing not yet available for booking"
              data-testid="mobile-draft-notice"
            >
              <div className="pp-m-sticky-price" style={{ color: '#64748b' }}>
                <b style={{ fontWeight: 600 }}>Not yet available</b>
                <span>for booking</span>
              </div>
            </div>
          ) : (
            <div className="pp-m-sticky" aria-label="Book this property" data-testid="mobile-reserve-bar">
              <div className="pp-m-sticky-price">
                <b>{formatCurrency(ppStickyNightly, { maximumFractionDigits: 0 })}</b>
                <span>/ night</span>
              </div>
              <button
                type="button"
                className="pp-btn pp-btn-primary pp-m-sticky-cta"
                onClick={() => {
                  const widget = document.querySelector('[data-testid="guest-booking-form"]');
                  widget?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                aria-label="Scroll to booking form"
              >
                Reserve
              </button>
            </div>
          )}

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
