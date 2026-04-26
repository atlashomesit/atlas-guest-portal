import React from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { FaBed, FaShower, FaSwimmingPool, FaCar, FaWifi, FaTv } from "react-icons/fa";
import { TbAirConditioning } from "react-icons/tb";
import { PiElevatorDuotone, PiCoatHangerLight } from "react-icons/pi";
import { RiLuggageCartLine } from "react-icons/ri";
import { TfiBrushAlt } from "react-icons/tfi";
import { LiaNewspaper } from "react-icons/lia";
import { MdOutlineEmojiFoodBeverage, MdOutlineLocalLaundryService, MdOutlineDone } from "react-icons/md";
import { FaCcMastercard, FaLocationDot } from "react-icons/fa6";
import { FaStar } from "react-icons/fa";
import { X, ChevronRight, Clock, KeyRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { propertyData, propertyImages } from '../../../data.ts';
import { getUnitPolicy } from '../../../config/policyConfig';
import { inlinePolicySnippets } from '../../../content/terms';
import Subheading from '../../commonComponents/subheading/Subheading';
import UnitBookingWidget from '../../availability/UnitBookingWidget';
import AvailabilityCalendar from '../../AvailabilityCalendar';
import { trackEvent } from '../../../utils/analytics';
import { Button } from '../../ui/Button';
import { calculateNightlyPrice, inferUnitType } from '../../../utils/pricing';
import { buildHomeUnitPath, getPropertySlug } from '../../../utils/navigation';
import { useBooking } from '../../../contexts/BookingContext';
import { useListingPhotosFromApi } from '../../../contexts/ListingPhotosContext';
import { resolveListing } from '../../../utils/listingResolver';
import { filterGuestImageUrls, sanitizeGuestImageUrl } from '../../../utils/guestImageUrl';
import type { ListingDetail, PublicListing } from '../../../api/listingClient';
import { fetchListingById, parseMaxGuestsFromPayload, resolveStaticMaxGuests } from '../../../api/listingClient';
import SEO from '../../SEO';
import { buildApiUrl, getApiHeaders } from '../../../api/client';
import { addRecentlyViewed, isFavorite, toggleFavorite } from '../../../utils/guestHistory';
import { formatCurrency, formatHumanDate } from '../../../utils/formatting';

import { Fancybox } from "@fancyapps/ui";
import "@fancyapps/ui/dist/fancybox/fancybox.css";


interface PropertyAmenity {
    amenities_icon: string;
}

interface PropertyDetail {
    type: string;
    value: string;
}

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
                <div className="h-4 w-32 animate-pulse rounded bg-bg-muted" />
            </div>
            <div className="max-w-[85rem] flex flex-col gap-10 mx-auto px-4 sm:px-8 lg:px-16 py-8">
                <div className="space-y-3">
                    <div className="h-9 max-w-xl animate-pulse rounded-lg bg-bg-muted" />
                    <div className="h-4 w-48 animate-pulse rounded bg-bg-muted" />
                    <div className="h-4 w-64 animate-pulse rounded bg-bg-muted" />
                </div>

                <div className="flex gap-2 h-64 md:h-96 lg:h-[450px] overflow-hidden">
                    <div className="flex-1 h-full rounded-md overflow-hidden animate-pulse bg-bg-muted" />
                    <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2 h-full">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-full w-full rounded-md animate-pulse bg-bg-muted" />
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="w-full sm:w-2/3 order-2 sm:order-1 space-y-6">
                        <div className="pb-8 border-b border-border-subtle space-y-4">
                            <div className="h-7 w-56 animate-pulse rounded bg-bg-muted" />
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="h-24 rounded-xl animate-pulse bg-bg-muted border border-border-subtle" />
                                ))}
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="h-7 w-48 animate-pulse rounded bg-bg-muted" />
                            <div className="h-4 w-full animate-pulse rounded bg-bg-muted" />
                            <div className="h-4 w-5/6 animate-pulse rounded bg-bg-muted" />
                            <div className="h-4 w-4/6 animate-pulse rounded bg-bg-muted" />
                        </div>
                    </div>
                    <div className="w-full sm:w-1/3 order-1 sm:order-2">
                        <div className="rounded-2xl border border-border-subtle bg-bg-surface shadow-level1 p-6 space-y-4">
                            <div className="h-40 w-full animate-pulse rounded-xl bg-bg-muted" />
                            <div className="h-6 w-28 animate-pulse rounded bg-bg-muted" />
                            <div className="h-10 w-full animate-pulse rounded-xl bg-bg-muted" />
                            <div className="h-12 w-full animate-pulse rounded-xl bg-bg-muted" />
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
    property_review_snippets: string[];
    property_price: number;
    timezoneId?: string;
    photoCount?: number;
    maxGuests?: number;
    maxCapacity?: number;
    /** G3-002: from API listing when available */
    checkInTime?: string;
    checkOutTime?: string;
    /** AMN-001: amenity codes from API (e.g. ["wifi","ac","parking"]) */
    amenityCodes?: string[];
    /** TASK-355: host/on-site contact phone for WhatsApp CTA */
    hostPhone?: string | null;
}

const PropertyDetails = () => {
    const location = useLocation();
    const { propertySlug: propertySlugParam, unitSlug: unitSlugParam, id: legacyIdParam } = useParams();

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
    const [, setListingLookupError] = useState<string | null>(null);
    const [isListingLookupPending, setIsListingLookupPending] = useState(false);
    const [showAmenitiesModal, setShowAmenitiesModal] = useState(false);
    const [showAboutMore, setShowAboutMore] = useState(false);
    const [showNeighborhoodMore, setShowNeighborhoodMore] = useState(false);
    const [copyLinkLabel, setCopyLinkLabel] = useState<'Copy link' | 'Copied!'>('Copy link');
    const unitType = inferUnitType({ id: data?.id, property_name: data?.property_name });
    const { setProperty, updateBooking } = useBooking();
    const { getUrlsForListingId } = useListingPhotosFromApi();
    const [searchParams] = useSearchParams();
    // Build a back-to-results link when the user arrived from /search (params preserved in URL by SearchPage)
    const backToResultsHref = useMemo(() => {
        const searchKeys = ["checkIn", "checkOut", "guests", "minPrice", "maxPrice"];
        const hasSearchParams = searchKeys.some((k) => searchParams.has(k));
        if (!hasSearchParams) return null;
        return `/search?${searchParams.toString()}`;
    }, [searchParams]);
    const showAvailabilityPlaceholder = false;
    const [availabilityPrefetched, setAvailabilityPrefetched] = useState(false);
    const [fav, setFav] = useState(false);
    const [similarFromApi, setSimilarFromApi] = useState<null | { loading: boolean; items: any[] }>(null);
    /** AMN-001: amenity master code→label map */
    const [amenityMaster, setAmenityMaster] = useState<Map<string, string>>(new Map());

    /** G3-001: live reviews from `GET /api/listings/{id}/reviews` when listing id resolves */
    const [listingReviewsFromApi, setListingReviewsFromApi] = useState<null | {
        loading: boolean;
        averageRating: number;
        totalCount: number;
        reviews: { id: number; guestName?: string | null; rating: number; title?: string | null; body?: string | null; createdAt: string; hostResponse?: string | null; hostResponseAt?: string | null }[];
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

    // Hydrate booking context from URL search params (passed from SearchPage)
    useEffect(() => {
        const checkIn = searchParams.get('checkIn');
        const checkOut = searchParams.get('checkOut');
        const guests = Number(searchParams.get('guests')) || null;
        if (checkIn || checkOut || guests) {
            updateBooking({
                ...(checkIn ? { checkIn: new Date(checkIn).toISOString() } : {}),
                ...(checkOut ? { checkOut: new Date(checkOut).toISOString() } : {}),
                ...(guests ? { guests } : {}),
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
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

    useEffect(() => {
        const lookupId = data?.listingId ?? location.state?.property?.listingId ?? listingIdParam;

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
                const mgFromResolve = parseMaxGuestsFromPayload(listing as Record<string, unknown>);
                if (mgFromResolve != null) {
                    setData((prev) => (prev ? { ...prev, maxGuests: mgFromResolve } : prev));
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
    }, [data?.listingId, location.state, listingIdParam]);

    useEffect(() => {
        const lid = Number(resolvedListingId ?? data?.listingId ?? NaN);
        if (!data || !Number.isFinite(lid) || lid <= 0) return;
        if (typeof data.maxGuests === 'number' && data.maxGuests >= 1) return;
        const ac = new AbortController();
        void fetchListingById(lid, ac.signal)
            .then((detail) => {
                const d = detail as Record<string, unknown>;
                const mg = parseMaxGuestsFromPayload(d);
                const rawPhone = d.hostPhone ?? d.contactPhone;
                const phone = typeof rawPhone === 'string' && rawPhone.trim() ? rawPhone.trim() : null;
                setData((prev) => {
                    if (!prev) return prev;
                    const updates: Partial<typeof prev> = {};
                    if (mg != null) updates.maxGuests = mg;
                    if (phone !== null && !prev.hostPhone) updates.hostPhone = phone;
                    return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
                });
            })
            .catch(() => {});
        return () => ac.abort();
    }, [resolvedListingId, data?.listingId, data?.maxGuests]);

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
                    reviews?: { id: number; guestName?: string | null; rating: number; title?: string | null; body?: string | null; createdAt: string; hostResponse?: string | null; hostResponseAt?: string | null }[];
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
            ? propertyData.find((item: Property) => Number(item.listingId) === listingId)
            : null;

        if (import.meta.env.DEV && listingIdParam) {
             
            console.debug('[PropertyDetails] route params:', { propertySlug, unitSlug: listingIdParam, listingId }, 'foundByListingId:', !!foundByListingId);
        }

        // 2) Match by unit slug / property name (legacy URLs)
        const foundByUnitSlug = foundByListingId ?? propertyData.find((item: Property) => {
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
            const lid = Number(foundByUnitSlug.listingId);
            const apiUrls = getUrlsForListingId(Number.isFinite(lid) ? lid : undefined);
            const staticImgs = propertyImages[String(foundByUnitSlug.id)] || [];
            const images = filterGuestImageUrls(apiUrls && apiUrls.length > 0 ? apiUrls : staticImgs);
            setData({
                ...foundByUnitSlug,
                property_neighborhoods: Array.isArray(foundByUnitSlug.property_neighborhoods)
                    ? foundByUnitSlug.property_neighborhoods
                    : [],
                property_img: images,
                maxGuests:
                    resolveStaticMaxGuests(foundByUnitSlug as unknown as Record<string, unknown>) ??
                    foundByUnitSlug.maxGuests,
            });
            return;
        }

        // If not found by slug, try to find by ID (e.g. unitSlug "7" matches item.id 501)
        const propertyId = normalizedUnitSlug || undefined;
        if (propertyId) {
            const foundById = propertyData.find((item: Property) => String(item.id) === String(propertyId));
            if (foundById) {
                const lid = Number(foundById.listingId);
                const apiUrls = getUrlsForListingId(Number.isFinite(lid) ? lid : undefined);
                const staticImgs = propertyImages[String(foundById.id)] || [];
                const images = filterGuestImageUrls(apiUrls && apiUrls.length > 0 ? apiUrls : staticImgs);
                setData({
                    ...foundById,
                    property_neighborhoods: Array.isArray(foundById.property_neighborhoods)
                        ? foundById.property_neighborhoods
                        : [],
                    property_img: images,
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
            const fromNav = Array.isArray(navGallery) && navGallery.length > 0 ? navGallery : undefined;
            const lid = Number(prop.listingId);
            const apiUrls = getUrlsForListingId(Number.isFinite(lid) ? lid : undefined);
            const staticImgs = propertyImages[String(prop.id)] || [];
            const images = filterGuestImageUrls(fromNav ?? (apiUrls && apiUrls.length > 0 ? apiUrls : staticImgs));
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

        // API fallback: fetch from API when not in static data (handles DB IDs not in propertyData)
        if (listingIdParam && (Number.isFinite(listingId) ? listingId > 0 : true)) {
            if (import.meta.env.DEV) {
                 
                console.debug('[PropertyDetails] API fallback for listingIdParam:', listingIdParam);
            }
            const controller = new AbortController();
            let cancelled = false;
            resolveListing(String(listingIdParam), controller.signal)
                .then((apiListing: ListingDetail | null) => {
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
                    const mapped: Property = {
                        id: Number(apiListing.id) || listingId,
                        listingId: Number(apiListing.id) || listingId,
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
                        property_review_snippets: Array.isArray((apiListing as Record<string, unknown>).property_review_snippets) ? (apiListing as Record<string, unknown>).property_review_snippets as string[] : [],
                        property_price: Number((apiListing as Record<string, unknown>).property_price) || 0,
                        timezoneId: (apiListing as Record<string, unknown>).timezoneId as string | undefined,
                        photoCount: photoCount || (coverUrl ? 1 : 0),
                        maxGuests: parseMaxGuestsFromPayload(apiListing as Record<string, unknown>),
                        checkInTime: pub.checkInTime?.trim() || undefined,
                        checkOutTime: pub.checkOutTime?.trim() || undefined,
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
                    };
                    const fromApi =
                        photoUrlsList.length > 0 ? photoUrlsList : (coverUrl ? [coverUrl] : []);
                    const staticImages = propertyImages[String(mapped.id)] ?? propertyImages[String(apiListing.id)];
                    const images = filterGuestImageUrls(
                        fromApi.length > 0 ? fromApi : (staticImages ?? mapped.property_img ?? []),
                    );
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
    }, [propertySlug, listingIdParam, listingId, location.state, getUrlsForListingId]);
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
          name: data.property_name,
          coverPhotoUrl: Array.isArray(data.property_img) ? data.property_img[0] : undefined,
          location: data.property_location,
      });
      updateBooking({ listingDetailPath: path });
  }

}, [data?.id, data?.property_name, data?.listingId, listingId, propertySlug, resolvedListingId, setProperty, updateBooking]);

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

    // Prefetch listing availability as soon as listing id resolves so date widget opens warm.
    useEffect(() => {
        const listingToPrefetch = Number(resolvedListingId ?? data?.listingId ?? listingId);
        if (!Number.isFinite(listingToPrefetch) || listingToPrefetch <= 0 || availabilityPrefetched) return;

        const controller = new AbortController();
        const startDate = new Date().toISOString().slice(0, 10);
        const url = buildApiUrl(`/availability/listing-availability?listingId=${listingToPrefetch}&startDate=${encodeURIComponent(startDate)}&months=2`);
        fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json', ...getApiHeaders() },
            signal: controller.signal,
        })
            .then(() => setAvailabilityPrefetched(true))
            .catch(() => {
                if (!controller.signal.aborted) {
                    // non-blocking prefetch; widget still fetches on demand
                }
            });

        return () => controller.abort();
    }, [resolvedListingId, data?.listingId, listingId, availabilityPrefetched]);


    useEffect(() => {
        if (!data) return;

        // Fancybox v6 syntax
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
        return <MdOutlineDone />;
    };

    const formatAmenityName = (name: string) => {
        return name.charAt(0).toUpperCase() + name.slice(1);
    };

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

    const unitPolicy = getUnitPolicy(data?.id);
    const cancellationPolicyText = (() => {
        const policies = data?.property_policy_details ?? [];
        const fromListingPolicy = policies.find((p) =>
            typeof p?.type === 'string' && p.type.toLowerCase().includes('cancellation'),
        )?.value;
        return fromListingPolicy || inlinePolicySnippets?.cancellation || 'Standard cancellation policy applies.';
    })();

    const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
    const galleryUrls = filterGuestImageUrls(data?.property_img ?? []);
    const primaryImage = galleryUrls[0];

    const propertyJsonLd = data ? [
        {
        "@context": "https://schema.org",
        "@type": "LodgingBusiness",
        name: data.property_name,
        description: data.property_description?.slice(0, 300),
        image: primaryImage,
        url: pageUrl,
        address: {
            "@type": "PostalAddress",
            addressLocality: data.property_location || "Hyderabad",
            addressRegion: "Telangana",
            addressCountry: "IN",
        },
        aggregateRating: data.property_rating ? {
            "@type": "AggregateRating",
            ratingValue: data.property_rating,
            reviewCount: data.property_reviews || 0,
        } : undefined,
        ...(nightlyPrice?.finalNightlyPrice ? {
            priceRange: `INR ${nightlyPrice.finalNightlyPrice}/night`,
            makesOffer: {
                "@type": "Offer",
                priceCurrency: "INR",
                price: nightlyPrice.finalNightlyPrice,
                availability: "https://schema.org/InStock",
            },
        } : {}),
        },
        // FAQPage: reuse "Things to know" snippets where available for richer search results.
        ...(Array.isArray(data.property_policy_details) && data.property_policy_details.length > 0 ? [{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: data.property_policy_details
                .filter((p: any) => p?.type && p?.value)
                .slice(0, 6)
                .map((p: any) => ({
                    "@type": "Question",
                    name: String(p.type),
                    acceptedAnswer: { "@type": "Answer", text: String(p.value) }
                }))
        }] : [])
    ] : undefined;

    return (
        <>
        {data && (
            <SEO
                title={`${data.property_name} | Atlas Homestays`}
                description={data.property_description?.slice(0, 160) || `Book ${data.property_name} in ${data.property_location || 'Hyderabad'} on Atlas Homestays.`}
                image={primaryImage}
                url={pageUrl}
                type="lodgingBusiness"
                jsonLd={propertyJsonLd}
            />
        )}
        <section className="w-full pt-28 md:pt-0 tracking-wide">
            <div className='pt-10 pl-32'>
                <Subheading />
            </div>

            <div className="max-w-[85rem] flex flex-col gap-10 mx-auto px-4 sm:px-8 lg:px-16 py-8">
                {backToResultsHref && (
                    <div>
                        <Link
                            to={backToResultsHref}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
                            data-testid="back-to-results"
                        >
                            <span aria-hidden="true">←</span> Back to results
                        </Link>
                    </div>
                )}

                {/* Property Header */}
                <div className="">
                    <h1 className="text-2xl sm:text-3xl font-semibold mb-2 capitalize text-text-primary">{data?.property_name}</h1>
                    <div className="flex items-center text-text-muted">
                        <FaLocationDot className="mr-2 text-sm" />
                        <span className="text-sm sm:text-base">{data?.property_location || 'Location not available'}</span>
                    </div>
                    {(data?.property_neighborhoods || []).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {data?.property_neighborhoods?.map((neighborhood: string, index: number) => (
                                <div
                                    key={`${neighborhood}-${index}`}
                                    className="inline-flex items-center gap-2 rounded-full bg-[color:color-mix(in_srgb,var(--bg-muted)_45%,var(--bg-surface))] px-3 py-1 text-xs font-semibold text-text-primary"
                                    role="listitem"
                                    aria-label={`Neighborhood: ${neighborhood}`}
                                >
                                    <span aria-hidden="true" role="presentation">🏙️</span>
                                    <span>{neighborhood}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3 text-sm text-text-muted">
                        <div className="flex items-center gap-2 font-semibold text-text-primary">
                            <FaStar className="text-accent-primary" />
                            <span>{(data?.property_rating || 0).toFixed(2)}</span>
                            <span className="text-text-muted">• {data?.property_reviews || 0} reviews</span>
                        </div>
                        {data?.property_review_snippets?.[0] && (
                            <p className="sm:pl-3 sm:border-l sm:border-border-subtle sm:ml-3 text-text-muted italic">
                                "{data.property_review_snippets?.[0] || 'No reviews available'}"
                            </p>
                        )}
                    </div>
                </div>

                {/* Social sharing — minimal, does not distract from booking CTA */}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Check out ${data?.property_name ?? 'this home'}: ${window.location.href}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: '#25d366' }}
                    >
                        💬 Share on WhatsApp
                    </a>
                    <button
                        type="button"
                        onClick={() => {
                            navigator.clipboard.writeText(window.location.href).then(() => {
                                setCopyLinkLabel('Copied!');
                                setTimeout(() => setCopyLinkLabel('Copy link'), 2000);
                            }).catch(() => {});
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}
                        className="text-text-muted hover:text-text-primary transition"
                    >
                        🔗 {copyLinkLabel}
                    </button>
                </div>

                {/* Check-in / check-out times — shown prominently before gallery */}
                {(data?.checkInTime || data?.checkOutTime) && (
                    <div className="flex flex-wrap gap-4 text-sm font-medium mt-1 mb-2">
                        <div className="flex items-center gap-1.5 text-text-primary">
                            <KeyRound className="w-4 h-4 text-accent-primary flex-shrink-0" />
                            <span>Check-in from <strong>{data.checkInTime?.trim() || 'Flexible'}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-text-primary">
                            <Clock className="w-4 h-4 text-accent-primary flex-shrink-0" />
                            <span>Checkout by <strong>{data.checkOutTime?.trim() || 'Flexible'}</strong></span>
                        </div>
                    </div>
                )}

                {/* Image Gallery — Azure blob URLs are skipped (409); API/static must serve reachable images */}
<div className="flex gap-2 h-64 md:h-96 lg:h-[450px] overflow-hidden ">
  <div className="flex-1 relative h-full rounded-md overflow-hidden bg-bg-muted">
    {galleryUrls[0] ? (
      <a href={galleryUrls[0]} data-fancybox="property-gallery">
        <img
          src={galleryUrls[0]}
          alt={data?.property_name ? `${data.property_name} photo` : "Main property photo"}
          loading="lazy"
          decoding="async"
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="w-full h-full object-cover"
        />
      </a>
    ) : (
      <>
        <a href="/placeholder-property.jpg" data-fancybox="property-gallery" className="hidden" aria-hidden="true" />
        <div className="w-full h-full min-h-[16rem] bg-bg-muted bg-[linear-gradient(135deg,color-mix(in_srgb,var(--border-subtle)_55%,transparent)_0%,color-mix(in_srgb,var(--bg-muted)_92%,transparent)_100%)]" role="img" aria-label="No photos available" />
      </>
    )}
  </div>
  <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2 h-full">
    {galleryUrls.slice(1, 5).map((img: string, index: number) => (
      <div key={`${img}-${index}`} className="relative w-full h-full rounded-md overflow-hidden">
        <a href={img} data-fancybox="property-gallery">
          <img
            src={img}
            alt={data?.property_name ? `${data.property_name} photo ${index + 2}` : `Property photo ${index + 2}`}
            loading="lazy"
            decoding="async"
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="w-full h-full object-cover hover:opacity-80 transition"
          />
        </a>
        {index === 3 && galleryUrls.length > 0 && (
          <button
            type="button"
            onClick={() => {
              Fancybox.show(
                galleryUrls.map((u: string) => ({
                  src: u,
                  type: "image",
                })),
              );
            }}
            className="absolute bottom-2 right-2 bg-[color:color-mix(in_srgb,var(--text-primary)_65%,transparent)] text-[var(--text-contrast)] text-xs md:text-sm px-3 py-1 rounded-full flex items-center gap-2 hover:bg-[color:color-mix(in_srgb,var(--text-primary)_80%,transparent)] transition"
          >
            All photos
          </button>
        )}
      </div>
    ))}
  </div>
</div>

                <div className='flex flex-col gap-4 sm:flex-row '>
                    {/* Left div  */}
                    <div className="w-full sm:w-2/3 order-2 sm:order-1">
                        {/* What this place offers */}
                        <div className="pb-8 border-b border-border-subtle">
                            <h2 className="text-xl sm:text-2xl font-semibold mb-6 text-text-primary">What this place offers</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {data?.amenityCodes && data.amenityCodes.length > 0 ? (
                                    data.amenityCodes.slice(0, 9).map((code) => {
                                        const label = amenityMaster.get(code.toLowerCase()) ?? formatAmenityName(code);
                                        return (
                                            <div key={code} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-bg-muted border border-border-subtle text-center">
                                                <span className="text-2xl text-accent-primary">
                                                    {renderIconForCode(code)}
                                                </span>
                                                <span className="text-xs font-medium text-text-primary">{label}</span>
                                            </div>
                                        );
                                    })
                                ) : (data?.property_amenities || []).length > 0 ? (
                                    (data?.property_amenities || []).slice(0, 9).map((amenity, idx) => (
                                        <div key={idx} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-bg-muted border border-border-subtle text-center">
                                            <span className="text-2xl text-accent-primary">
                                                {renderIcon(amenity?.amenities_icon || '')}
                                            </span>
                                            <span className="text-xs font-medium text-text-primary">
                                                {amenity?.amenities_icon ? formatAmenityName(amenity.amenities_icon) : 'Amenity'}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-text-muted col-span-2 sm:col-span-3">No amenities listed</p>
                                )}
                            </div>
                            {((data?.amenityCodes?.length ?? 0) > 9 || (data?.property_amenities?.length ?? 0) > 0) && (
                                <Button
                                    variant="secondary"
                                    onClick={() => setShowAmenitiesModal(true)}
                                    className="mt-6"
                                >
                                    Show All Amenities
                                </Button>
                            )}
                        </div>

                        {/* Policies Section */}
                        {data?.property_policy_details && (
                            <div className="border border-border-subtle rounded-lg overflow-hidden shadow-level1 bg-bg-surface">
                                <div className="bg-bg-surface p-6">
                                    <h2 className="text-xl sm:text-2xl font-semibold mb-6 text-text-primary">Things to know</h2>
                                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                                        <button
                                            type="button"
                                            className="px-3 py-1.5 rounded-lg border border-border-subtle bg-bg-muted text-sm font-medium text-text-primary hover:opacity-90"
                                            onClick={() => {
                                                const lid = Number(resolvedListingId ?? data?.listingId ?? listingId);
                                                if (!Number.isFinite(lid) || lid <= 0) return;
                                                setFav(toggleFavorite(lid));
                                            }}
                                        >
                                            {fav ? '♥ Saved' : '♡ Save'}
                                        </button>
                                        <button
                                            type="button"
                                            className="px-3 py-1.5 rounded-lg border border-border-subtle bg-bg-muted text-sm font-medium text-text-primary hover:opacity-90"
                                            onClick={() => {
                                                const url = window.location.href;
                                                const text = `Check out ${data?.property_name ?? 'this home'} on Atlas Homestays`;
                                                const share = async () => {
                                                    // Web Share API on mobile; otherwise open WhatsApp in a new tab.
                                                    const nav: any = navigator;
                                                    if (nav?.share) return nav.share({ title: document.title, text, url });
                                                    window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank', 'noopener,noreferrer');
                                                };
                                                void share();
                                            }}
                                        >
                                            Share
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                                        <div className="p-4 border border-border-subtle rounded-lg bg-bg-muted">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Clock className="w-4 h-4 text-accent-primary" />
                                                <p className="text-text-muted text-sm">Check-in / Check-out</p>
                                            </div>
                                            <p className="font-medium text-text-primary">
                                                Check-in {data.checkInTime?.trim() || unitPolicy?.checkIn || '2:00 PM'} · Check-out {data.checkOutTime?.trim() || unitPolicy?.checkOut || '11:00 AM'}
                                            </p>
                                            <a className="text-sm text-accent-primary underline" href="/terms#check-in-check-out">View terms</a>
                                        </div>
                                        <div className="p-4 border border-border-subtle rounded-lg bg-bg-muted">
                                            <div className="flex items-center gap-2 mb-1">
                                                <KeyRound className="w-4 h-4 text-accent-primary" />
                                                <p className="text-text-muted text-sm">Cancellation & rules</p>
                                            </div>
                                            <p className="font-medium text-text-primary">
                                                {cancellationPolicyText}
                                            </p>
                                            <p className="text-text-primary mt-2 text-sm">
                                                {inlinePolicySnippets?.houseRules || 'Standard house rules apply'}
                                            </p>
                                            <a className="text-sm text-accent-primary underline inline-block mt-2" href="/policies#cancellation-refunds">Read policy</a>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                                        {(data?.property_policy_details || [])
                                            .filter((policy: PropertyDetail) => policy?.type && !policy.type.includes('Policy') && !policy.type.includes('Detailed'))
                                            .map((policy: PropertyDetail, idx: number) => (
                                                <div key={idx}>
                                                    <p className="text-text-muted text-sm mb-1">{policy.type}</p>
                                                    <p className="font-medium text-text-primary">{policy.value}</p>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Similar stays — Wave 9 #85 */}
                        {(() => {
                            const s = similarFromApi;
                            if (s?.loading) return (
                                <div className="pb-8 border-b border-border-subtle">
                                    <div className="h-7 w-48 animate-pulse rounded bg-bg-muted mb-4" />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {Array.from({ length: 2 }).map((_, i) => (
                                            <div key={i} className="rounded-xl border border-border-subtle bg-bg-surface overflow-hidden shadow-level1">
                                                <div className="h-40 w-full animate-pulse bg-bg-muted" />
                                                <div className="p-4 space-y-2">
                                                    <div className="h-4 w-3/4 animate-pulse rounded bg-bg-muted" />
                                                    <div className="h-3 w-1/2 animate-pulse rounded bg-bg-muted" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                            if (!s || !Array.isArray(s.items) || s.items.length === 0) return null;
                            return (
                                <div className="pb-8 border-b border-border-subtle">
                                    <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-text-primary">Similar stays</h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {s.items.slice(0, 4).map((it: any) => {
                                            const id = Number(it.id);
                                            const name = String(it.name ?? it.propertyName ?? `Listing ${it.id}`);
                                            const img = (it.coverPhotoUrl as string | undefined) ?? (Array.isArray(it.photoUrls) ? it.photoUrls[0] : undefined);
                                            const path = buildHomeUnitPath(getPropertySlug({ name: it.propertyName, property_name: it.propertyName }), id);
                                            return (
                                                <Link
                                                    key={String(it.id)}
                                                    to={path}
                                                    className="rounded-xl border border-border-subtle bg-bg-surface overflow-hidden shadow-level1 hover:shadow-level2 transition-shadow"
                                                >
                                                    {img ? <img src={img} alt={name} className="w-full h-40 object-cover" loading="lazy" /> : null}
                                                    <div className="p-4">
                                                        <p className="font-semibold text-text-primary">{name}</p>
                                                        <p className="text-sm text-text-secondary">{String(it.propertyAddress ?? '').slice(0, 60)}</p>
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Guest Reviews — API when available (G3-001), else static catalog snippets */}
                        {(() => {
                            const api = listingReviewsFromApi;
                            const showApi = api && !api.loading && api.totalCount > 0;
                            const showStatic = !showApi && data && data.property_reviews > 0;
                            if (api?.loading && !showStatic) return (
                                <div className="pb-8 border-b border-border-subtle">
                                    <div className="h-7 w-40 animate-pulse rounded bg-bg-muted mb-4" />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {Array.from({ length: 2 }).map((_, i) => (
                                            <div key={i} className="p-4 rounded-xl bg-bg-muted border border-border-subtle space-y-2">
                                                <div className="h-3 w-24 animate-pulse rounded bg-bg-surface" />
                                                <div className="flex gap-1">
                                                    {Array.from({ length: 5 }).map((__, j) => (
                                                        <div key={j} className="h-3 w-3 animate-pulse rounded-full bg-bg-surface" />
                                                    ))}
                                                </div>
                                                <div className="h-3 w-full animate-pulse rounded bg-bg-surface" />
                                                <div className="h-3 w-4/5 animate-pulse rounded bg-bg-surface" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                            if (!showApi && !showStatic) return null;
                            const rating = showApi ? api!.averageRating : data!.property_rating;
                            const count = showApi ? api!.totalCount : data!.property_reviews;
                            return (
                            <div className="pb-8 border-b border-border-subtle" data-testid="reviews-section">
                                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-text-primary">Guest Reviews</h2>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="flex items-center gap-1 text-accent-primary">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <FaStar key={i} className={i < Math.round(rating) ? 'text-accent-primary' : 'text-border-subtle'} />
                                        ))}
                                    </div>
                                    <span className="font-semibold text-text-primary">{rating.toFixed(1)}</span>
                                    <span className="text-text-muted text-sm">({count} reviews)</span>
                                </div>
                                {showApi && api!.reviews.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {api!.reviews.slice(0, 6).map((r) => (
                                            <div key={r.id} className="p-4 rounded-xl bg-bg-muted border border-border-subtle">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-sm font-semibold text-text-primary">{r.guestName ?? 'Guest'}</span>
                                                    <span className="text-xs text-text-muted">
                                                        {formatHumanDate(r.createdAt, {
                                                            locale: 'en-IN',
                                                            fallback: '—',
                                                            options: { day: '2-digit', month: 'short', year: 'numeric' },
                                                        })}
                                                    </span>
                                                </div>
                                                <div className="flex gap-0.5 mb-2">
                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                        <FaStar key={i} className={`text-xs ${i < r.rating ? 'text-accent-primary' : 'text-border-subtle'}`} />
                                                    ))}
                                                </div>
                                                {r.title && <p className="text-sm font-medium text-text-primary mb-1">{r.title}</p>}
                                                {r.body && <p className="text-sm text-text-muted italic">"{r.body}"</p>}
                                                {r.hostResponse && (
                                                    <div className="mt-2 pl-3 border-l-2 border-accent-primary/40">
                                                        <p className="text-xs text-text-muted font-medium mb-0.5">Owner's response:</p>
                                                        <p className="text-sm text-text-muted">{r.hostResponse}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    data?.property_review_snippets && data.property_review_snippets.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {data.property_review_snippets.slice(0, 4).map((snippet: string, idx: number) => (
                                            <div key={idx} className="p-4 rounded-xl bg-bg-muted border border-border-subtle">
                                                <p className="text-sm text-text-muted italic">"{snippet}"</p>
                                            </div>
                                        ))}
                                    </div>
                                    )
                                )}
                            </div>
                            );
                        })()}

                        {/* About this place */}
                        <div className="pb-8 border-b border-border-subtle">
                            <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-text-primary">About this place</h2>
                            <p className="text-text-muted leading-relaxed text-justify">
                                {!data?.property_description ? 
                                    'No description available' :
                                    showAboutMore
                                        ? data.property_description
                                        : `${data.property_description.slice(0, 200)}${data.property_description.length > 200 ? '...' : ''}`
                                }
                            </p>
                            <button
                                onClick={() => setShowAboutMore(!showAboutMore)}
                                className="flex items-center mt-3 font-semibold underline hover:text-text-primary transition"
                            >
                                Show {showAboutMore ? 'Less' : 'More'}
                                <ChevronRight className={`ml-1 w-4 h-4 transition-transform ${showAboutMore ? 'rotate-90' : ''}`} />
                            </button>
                        </div>

                        {/* Location Map */}
                        <div className="">
                            <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-text-primary">Where you'll be</h2>
                            <div className="rounded-lg overflow-hidden border border-border-subtle">
                                <iframe
                                    src={data?.property_mapSrc || ''}
                                    className="w-full h-64 sm:h-96"
                                    loading="lazy"
                                    allowFullScreen
                                    referrerPolicy="no-referrer-when-downgrade"
                                    title="Property Location"
                                ></iframe>
                            </div>
                            <p className="mt-4 text-text-muted text-sm sm:text-base">
                                {data?.property_location || 'Location information not available'}
                            </p>
                        </div>

                        {/* About neighborhood */}
                        <div className="pb-8 border-b border-border-subtle">
                            <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-text-primary">About neighborhood</h2>
                            <p className="text-text-muted leading-relaxed mb-2">
                                Location & Neighborhood Located in {data?.property_location || 'this area'}, this property offers easy access to major attractions and landmarks in the area.
                            </p>
                            {showNeighborhoodMore && (data?.property_nearplaces || []).length > 0 && (
                                <div className="text-text-muted leading-relaxed mt-3">
                                    <p className="mb-2 font-medium text-text-primary">Nearby places include:</p>
                                    <ul className="list-disc list-inside space-y-1 ml-2">
                                        {(data?.property_nearplaces || []).slice(0, 10).map((place: string, idx: number) => (
                                            <li key={`place-${idx}`}>{place}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <button
                                onClick={() => setShowNeighborhoodMore(!showNeighborhoodMore)}
                                className="flex items-center mt-3 font-semibold underline hover:text-text-primary transition"
                            >
                                Show {showNeighborhoodMore ? 'Less' : 'More'}
                                <ChevronRight className={`ml-1 w-4 h-4 transition-transform ${showNeighborhoodMore ? 'rotate-90' : ''}`} />
                            </button>
                        </div>
                    </div>
                    {/* right div  */}
                    <div className="w-full sm:w-1/3 order-1 sm:order-2">
                        <div className="sticky top-16">
                            {data.photoCount != null && data.photoCount > 0 && (
                                <p className="text-sm text-text-muted mb-2" aria-label="Photo count">{data.photoCount} photo{data.photoCount !== 1 ? 's' : ''}</p>
                            )}
                            <UnitBookingWidget
                                listingId={resolvedListingId ?? undefined}
                                propertyId={listingPropertyId ?? undefined}
                                listingName={data.property_name || 'This property'}
                                timezoneId={data.timezoneId}
                                coverPhotoUrl={primaryImage}
                                maxGuests={data.maxGuests}
                            />
                            <div className="mt-3 flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-xs font-medium text-green-700">
                                    ✓ Verified listing
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700">
                                    ⚡ Instant book
                                </span>
                            </div>
                            {/* TASK-545: Host profile card — builds trust (#2 signal per 2025 Indian hospitality research). */}
                            <div
                                className="mt-3 flex items-center gap-3 rounded-2xl border border-border-subtle bg-bg-surface p-3"
                                data-testid="host-profile-card"
                            >
                                <div
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white text-sm font-semibold"
                                    aria-hidden="true"
                                >
                                    {"AH"}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-text-primary truncate">
                                        Managed by Atlas Homestays
                                    </p>
                                    <p className="text-xs text-text-muted">
                                        24/7 WhatsApp support · Typically replies within 1 hour
                                    </p>
                                </div>
                            </div>
                            {(() => {
                                // Use hostPhone if available, otherwise fall back to business contact
                                const phoneToUse = data.hostPhone?.replace(/\D/g, '') || '7032493290';
                                return (
                                    <div className="mt-3">
                                        <a
                                            href={`https://wa.me/${phoneToUse}?text=Hi%2C%20I'm%20interested%20in%20booking%20${encodeURIComponent(data.property_name || 'this property')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            data-testid="chat-with-host-btn"
                                            className="flex items-center justify-center gap-2 w-full rounded-xl border border-border-strong bg-bg-surface px-4 py-3 text-sm font-medium text-text-primary hover:bg-bg-muted transition"
                                            onClick={() => trackEvent('whatsapp_cta_click', { listingId: resolvedListingId })}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                            </svg>
                                            Chat with host
                                        </a>
                                    </div>
                                );
                            })()}
                            {resolvedListingId && (
                                <AvailabilityCalendar
                                    listingId={resolvedListingId}
                                    onDateSelect={(ymd) => {
                                        const ev = new CustomEvent('atlas:set-checkin', { detail: ymd });
                                        window.dispatchEvent(ev);
                                    }}
                                />
                            )}
                            {showAvailabilityPlaceholder && (
                                <div className="rounded-2xl border border-border-subtle bg-bg-surface shadow-level1 p-6">
                                    <h3 className="text-lg font-semibold text-text-primary mb-2">Check Availability</h3>
                                    <p className="text-text-muted text-sm mb-4">
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
                        </div>
                    </div>
                </div>

                {/* Amenities Modal */}
                {showAmenitiesModal && (
                    <div className="fixed inset-0 bg-[color:color-mix(in_srgb,var(--text-primary)_70%,transparent)] z-[var(--z-modal)] flex items-center justify-center p-4">
                        <div className="bg-bg-surface rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-border-subtle shadow-level2">
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                    {data?.amenityCodes && data.amenityCodes.length > 0 ? (
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
                                        (data?.property_amenities || []).map((amenity: PropertyAmenity, idx: number) => {
                                            const icon = amenity?.amenities_icon || '';
                                            const displayName = icon ? formatAmenityName(icon) : 'Amenity';
                                            return (
                                                <div
                                                    key={`amenity-${idx}-${displayName}`}
                                                    className="flex items-center gap-3 sm:gap-4"
                                                    role="listitem"
                                                >
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
                                <Button
                                    onClick={() => setShowAmenitiesModal(false)}
                                    fullWidth
                                    variant="secondary"
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>

        {/* Mobile fixed Reserve CTA - visible only below md breakpoint */}
        {data && (
          <div
            className="fixed bottom-0 inset-x-0 z-30 flex items-center justify-between border-t border-border-subtle bg-bg-surface px-4 py-3 shadow-level2 md:hidden"
            data-testid="mobile-reserve-bar"
          >
            <div>
              <span className="text-base font-bold text-text-primary">
                {formatCurrency(nightlyPrice.finalNightlyPrice, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-text-muted"> / night</span>
            </div>
            <button
              type="button"
              className="rounded-xl bg-cta-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm"
              onClick={() => {
                const widget = document.querySelector('[data-testid="booking-name"]');
                widget?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            >
              Reserve
            </button>
          </div>
        )}
        </>
    );
};

export default PropertyDetails;
