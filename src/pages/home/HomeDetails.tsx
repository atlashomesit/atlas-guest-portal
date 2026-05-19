import './HomeDetails.css';
import { Link, useParams } from "react-router-dom";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/http";
import type { LucideIcon } from "lucide-react";
import {
  Wifi, Snowflake, Tv, Car, UtensilsCrossed, WashingMachine,
  Dumbbell, Waves, TreePine, Mountain, BedDouble, Briefcase,
  ShieldCheck, Sparkles, Users, CheckCircle2,
} from "lucide-react";

import { getTenantFilteredHomes, defaultHomeHighlights } from "../../content/homes";
import { useBooking } from "../../contexts/BookingContext";
import { CONTACT } from "../../config/contact";
import { getTenantContext } from "../../tenant/tenantContext";
import { getTenantBrandName } from "../../tenant/displayBrand";
import { getTenantOverrides, shouldHideAtlasBranding } from "../../tenant/tenantOverrides";
import { usePropertyListings } from "../../hooks/usePropertyListings";
import { addRecentlyViewed } from "../../utils/guestHistory";
import { track } from "../../lib/events";
import { buildHomeDetailsLodgingJsonLd } from "./homeDetailsJsonLd";
import EmbeddedListingMap from "../../components/map/EmbeddedListingMap";

const UnitBookingWidget = lazy(() => import("../../components/availability/UnitBookingWidget"));

const fallbackImage = "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80";
const CELL_LABELS = ['Living', 'Kitchen', 'Bedroom', 'Balcony'] as const;
const REVIEW_BG_COLORS = ['#1a1a2e', '#ffb347', '#c2410c', '#94755b', '#e9f5ef'];
const REVIEW_TEXT_COLORS = ['#fffaf5', '#1a1a2e', '#fffaf5', '#fffaf5', '#157046'];

type AmenityDef = { icon: LucideIcon; keywords: string[] };

const AMENITY_MAP: AmenityDef[] = [
  { icon: Wifi,           keywords: ["wi-fi", "wifi", "internet", "broadband"] },
  { icon: Snowflake,      keywords: ["ac", "air con", "air-con", "cooling"] },
  { icon: Tv,             keywords: ["tv", "television", "smart tv", "streaming"] },
  { icon: Car,            keywords: ["parking", "car park", "garage"] },
  { icon: UtensilsCrossed,keywords: ["kitchen", "cooking", "utensil", "kitchenette"] },
  { icon: WashingMachine, keywords: ["washing", "laundry", "washer"] },
  { icon: Dumbbell,       keywords: ["gym", "fitness", "workout"] },
  { icon: Waves,          keywords: ["pool", "swimming"] },
  { icon: TreePine,       keywords: ["garden", "balcony", "terrace", "outdoor"] },
  { icon: Mountain,       keywords: ["mountain view", "sea view", "view"] },
  { icon: BedDouble,      keywords: ["bedding", "bed", "linen", "mattress"] },
  { icon: Briefcase,      keywords: ["workspace", "work", "desk"] },
  { icon: ShieldCheck,    keywords: ["security", "safe", "cctv", "guard"] },
  { icon: Sparkles,       keywords: ["housekeeping", "cleaning", "clean"] },
  { icon: Users,          keywords: ["concierge", "reception", "support"] },
];

interface ListingReview {
  id: number;
  guestName?: string | null;
  rating: number;
  title?: string | null;
  body?: string | null;
  createdAt: string;
  hostResponse?: string | null;
  isVerifiedStay: boolean;
}

interface ListingReviewsResponse {
  totalCount: number;
  averageRating: number;
  reviews: ListingReview[];
}

// ---- Inline SVG atoms -------------------------------------------------------

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function ShieldIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

function ChevronDown({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function GridIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

// ---- Helpers ----------------------------------------------------------------

function resolveIcon(label: string): LucideIcon {
  const lower = label.toLowerCase();
  for (const { icon, keywords } of AMENITY_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) return icon;
  }
  return CheckCircle2;
}

interface CancellationInfo {
  headline: string;
  description: string;
  steps: Array<{ title: string; desc: string }>;
}

const REFUND_STEPS = [
  { title: 'Cancel from your booking', desc: 'One tap from your booking confirmation. No reason needed.' },
  { title: 'Refund initiated', desc: 'Automatic within 24 hours. Reference number sent to you.' },
  { title: 'Money in your account', desc: 'UPI: same day. Cards & netbanking: 3–5 working days.' },
  { title: 'Confirmation', desc: 'SMS and WhatsApp when the refund clears. Both.' },
];

function getCancellationInfo(tier: string | null | undefined): CancellationInfo {
  if (tier === 'Flexible') return {
    headline: 'Full refund if cancelled 48 hours before check-in',
    description: 'Money returns to the exact UPI or card you paid with. No phone calls needed.',
    steps: REFUND_STEPS,
  };
  if (tier === 'Moderate') return {
    headline: 'Full refund if cancelled 5 days before check-in',
    description: 'Partial refund for cancellations after the window. Check your booking for exact terms.',
    steps: REFUND_STEPS,
  };
  if (tier === 'Strict') return {
    headline: '50% refund if cancelled 7 days before check-in',
    description: 'No refund within 7 days of check-in. Check your booking for exact terms.',
    steps: REFUND_STEPS,
  };
  return {
    headline: 'Contact us to discuss cancellation',
    description: 'Reach out via WhatsApp before cancelling to get the best outcome.',
    steps: REFUND_STEPS,
  };
}

// ---- Component --------------------------------------------------------------

const HomeDetails = () => {
  const { roomNo } = useParams<{ roomNo: string }>();
  const { homes: apiHomes, listingsById } = usePropertyListings();
  const tenant = getTenantContext();
  const tenantOverrides = getTenantOverrides(tenant?.slug);
  const hideAtlasBranding = shouldHideAtlasBranding(tenant, tenantOverrides);

  const apiRoom = apiHomes.find((item) => item.roomNo === roomNo);
  const filteredHomes = getTenantFilteredHomes();
  const room = apiRoom ? {
    roomNo,
    title: apiRoom.title,
    href: apiRoom.href,
    slug: apiRoom.title.toLowerCase().replace(/_/g, '-'),
    images: [] as string[],
    maxGuests: 2,
    listingId: Number(apiRoom.roomNo),
  } : filteredHomes.find((item) => item.roomNo === roomNo);

  const { updateBooking } = useBooking();
  const [reviewsData, setReviewsData] = useState<ListingReviewsResponse | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showAllHighlights, setShowAllHighlights] = useState(false);
  const bookingRef = useRef<HTMLElement>(null);

  const highlights = room?.highlights?.length ? room.highlights : defaultHomeHighlights;

  // ---- All existing effects — untouched ------------------------------------

  useEffect(() => {
    if (!room) return;
    updateBooking({ listingDetailPath: room.href });
  }, [room, updateBooking]);

  useEffect(() => {
    const listingId = Number(roomNo);
    if (!Number.isFinite(listingId) || listingId <= 0) return;
    apiFetch(`/api/listings/${listingId}/reviews`)
      .then((res) => res.json() as Promise<ListingReviewsResponse>)
      .then(setReviewsData)
      .catch(() => { /* reviews are non-critical */ });
  }, [roomNo]);

  /** TASK-1480: track listing view event on mount. */
  useEffect(() => {
    if (!room) return;
    const listingId = Number(room.roomNo);
    if (Number.isFinite(listingId) && listingId > 0) track('view_listing', listingId);
  }, [room]);

  /** WCAG: set document.title for listing detail so assistive technology and the
   *  accessibility WCAG test can detect a non-empty title on the listing/booking route.
   *  Restore on unmount to avoid stale title when navigating away (TASK-2433: never restore to blank). */
  useEffect(() => {
    if (!room?.title) return;
    const brandName = getTenantBrandName();
    const prev = document.title?.trim() ? document.title : "";
    const next = `${room.title} | ${brandName}`.trim();
    document.title = next || prev || brandName || "Atlas";
    return () => {
      if (prev) {
        document.title = prev;
      } else {
        document.title = brandName || "Atlas";
      }
    };
  }, [room?.title]);

  /** TASK-1477: inject LodgingBusiness JSON-LD for SEO (url, ratings, white-label provider). */
  useEffect(() => {
    if (!room) return;
    const apiListing = listingsById[room.roomNo ?? ""];
    const images = room.images?.length ? room.images : (apiListing?.photoUrls ?? []);
    const schema = buildHomeDetailsLodgingJsonLd({
      roomTitle: room.title,
      roomHref: room.href,
      tagline: room.tagline,
      highlights: highlights ?? [],
      imageUrls: images,
      apiListing: apiListing ?? null,
      tenantBrandName: getTenantBrandName(),
      hideAtlasBranding,
      reviews: reviewsData,
    });
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-atlas-jsonld", "home-details");
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, [room, highlights, listingsById, reviewsData, hideAtlasBranding]);

  /** TASK-1459: record listing view for Recently viewed strip. */
  useEffect(() => {
    if (!room) return;
    const lid = "listingId" in room && typeof room.listingId === "number" ? room.listingId : Number(roomNo);
    if (!Number.isFinite(lid) || lid <= 0) return;
    addRecentlyViewed({
      listingId: lid,
      path: room.href,
      name: room.title,
      coverPhotoUrl: room.images?.[0],
    });
  }, [room, roomNo]);

  // Derive the primary image for the LCP preload effect
  const apiListingForEffects = listingsById[room?.roomNo ?? ""];
  const primaryImage = (apiListingForEffects?.photoUrls?.[0] ?? room?.images?.[0]) || fallbackImage;

  /** TASK-1453: LCP preload for hero photo (no react-helmet-async — inject once per navigation). */
  useEffect(() => {
    if (!room || !primaryImage) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = primaryImage;
    link.setAttribute("fetchpriority", "high");
    link.setAttribute("data-atlas-home-lcp", "1");
    document.head.appendChild(link);
    return () => { link.remove(); };
  }, [room, primaryImage]);

  // ---- Not-found state -----------------------------------------------------

  if (!room) {
    return (
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-text-primary">Home not found</h1>
        <p className="mt-3 text-text-secondary">
          We could not find that home. Please return to the catalog to see available stays.
        </p>
        <Link to="/#our-homes" className="inline-flex mt-6 rounded-full bg-[color:var(--cta-primary)] px-4 py-3 text-white font-semibold">
          Back to Our Homes
        </Link>
      </section>
    );
  }

  // ---- Derived display values ----------------------------------------------

  const apiListing = listingsById[room.roomNo ?? ""];
  const photos = apiListing?.photoUrls?.length ? apiListing.photoUrls : (room.images ?? []);
  const hostDisplayName = apiListing?.propertyName ?? room.title ?? getTenantBrandName();
  const hostInitial = hostDisplayName.trim().charAt(0).toUpperCase();
  const hasLocation = apiListing?.latitude != null && apiListing?.longitude != null;
  const cancellationInfo = getCancellationInfo(apiListing?.cancellationTier);

  const waBookingUrl = `https://wa.me/${CONTACT.business.whatsapp}?text=${encodeURIComponent(`Hi, I'm interested in booking ${room.title}`)}`;
  const waAskUrl = `https://wa.me/${CONTACT.business.whatsapp}?text=${encodeURIComponent(`Hi, I have a question about ${room.title}`)}`;

  const showRegRow = (tenantOverrides.gstin != null) ||
    (tenantOverrides.tourismRegNumbers != null && tenantOverrides.tourismRegNumbers.length > 0);

  const displayedHighlights = showAllHighlights ? highlights : highlights.slice(0, 4);
  const displayedReviews = showAllReviews ? reviewsData?.reviews : reviewsData?.reviews.slice(0, 6);

  return (
    <div className="pp-root">
      <div className="pp-shell">

        {/* ---- Breadcrumbs ---- */}
        <nav className="pp-crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span className="pp-sep" aria-hidden="true">›</span>
          <Link to="/#our-homes">Stays</Link>
          <span className="pp-sep" aria-hidden="true">›</span>
          <span aria-current="page">{room.title}</span>
        </nav>

        {/* ---- Title row ---- */}
        <div className="pp-title-row">
          <div>
            {!hideAtlasBranding && (
              <p className="pp-eyebrow">{getTenantBrandName()}</p>
            )}
            <h1 className="pp-display">{room.title}</h1>
            <div className="pp-submeta">
              {reviewsData && reviewsData.totalCount > 0 && (
                <>
                  <span className="pp-rating">
                    ★ {reviewsData.averageRating.toFixed(1)}{' '}
                    <em>({reviewsData.totalCount} {reviewsData.totalCount === 1 ? 'review' : 'reviews'})</em>
                  </span>
                  <span className="pp-submeta-sep" aria-hidden="true">·</span>
                </>
              )}
              {apiListing?.propertyAddress && (
                <>
                  <span>{apiListing.propertyAddress}</span>
                  <span className="pp-submeta-sep" aria-hidden="true">·</span>
                </>
              )}
              {room.maxGuests > 0 && (
                <span>Sleeps {room.maxGuests}</span>
              )}
            </div>
          </div>
          <div className="pp-title-actions">
            <a
              href={waBookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pp-btn pp-btn-ghost pp-btn-sm"
              aria-label={`Share ${room.title} on WhatsApp`}
            >
              Share
            </a>
          </div>
        </div>

        {/* ---- Gallery mosaic ---- */}
        <div className="pp-gallery" role="region" aria-label="Property photos">
          {/* Hero cell — spans both rows */}
          <div
            className={`pp-cell pp-cell-hero${photos[0] ? ' pp-cell--photo' : ''}`}
            style={photos[0] ? { backgroundImage: `url(${photos[0]})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
            role="img"
            aria-label={photos[0] ? `${room.title} — main photo` : `${room.title} — photo coming soon`}
          >
            {!photos[0] && (
              <>
                <div className="pp-cell-id-hero" aria-hidden="true">{room.roomNo}</div>
                <div className="pp-cell-overlay">
                  <span className="pp-dot" aria-hidden="true" />
                  <span>Photos coming soon · home is real</span>
                </div>
              </>
            )}
          </div>

          {/* Thumbnail cells */}
          {([1, 2, 3, 4] as const).map((i) => {
            const photo = photos[i];
            return (
              <div
                key={i}
                className={`pp-cell pp-cell-${i + 1}${photo ? ' pp-cell--photo' : ''}`}
                style={photo ? { backgroundImage: `url(${photo})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
                role="img"
                aria-label={photo ? `${room.title} — photo ${i + 1}` : `${CELL_LABELS[i - 1]} area`}
              >
                {!photo && (
                  <>
                    <div className="pp-cell-id-thumb" aria-hidden="true">{['i','ii','iii','iv'][i - 1]}</div>
                    <span className="pp-cell-label">{CELL_LABELS[i - 1]}</span>
                  </>
                )}
              </div>
            );
          })}

          <Link to="/gallery" className="pp-gallery-more" aria-label="View all photos">
            <GridIcon size={13} />
            {photos.length > 5 ? `View all ${photos.length} photos` : 'View gallery'}
          </Link>
        </div>

        {/* ---- Two-column main ---- */}
        <div className="pp-main">

          {/* ===== LEFT COLUMN ===== */}
          <div>

            {/* Host strip + verified panel */}
            <section className="pp-section" style={{ paddingTop: 28 }} aria-label="About the host">
              <div className="pp-host">
                <div className="pp-host-avatar" aria-hidden="true">{hostInitial}</div>
                <div>
                  <div className="pp-host-name">
                    {hostDisplayName}
                    <span className="pp-verified-badge">
                      <CheckIcon size={10} /> Verified
                    </span>
                  </div>
                  <div className="pp-host-sub">
                    Owner-operated · Responds on WhatsApp · Direct booking
                  </div>
                </div>
                <div className="pp-host-actions">
                  <a
                    href={waBookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pp-btn pp-btn-whatsapp pp-btn-sm"
                    data-testid="chat-with-host-btn"
                    aria-label={`Message host about ${room.title} on WhatsApp`}
                  >
                    <WhatsAppIcon size={14} /> Message on WhatsApp
                  </a>
                  <a
                    href={waAskUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pp-btn pp-btn-ghost pp-btn-sm"
                    aria-label="Ask host a question on WhatsApp"
                  >
                    Ask a question
                  </a>
                </div>
              </div>

              {/* "What verified means" panel */}
              <div className="pp-verified-panel">
                <div className="pp-verified-panel-head">
                  <span className="pp-shield" aria-hidden="true"><ShieldIcon size={22} /></span>
                  <h3>
                    What &ldquo;verified&rdquo; means at {getTenantBrandName()}
                    <small>This isn&rsquo;t a badge we hand out. Here&rsquo;s what we actually checked.</small>
                  </h3>
                </div>
                <ul className="pp-verified-list">
                  <li>
                    <CheckIcon size={16} />
                    <span>
                      <b>Property photos are genuine.</b>
                      <span className="pp-meta">Our team reviewed listing photos before publishing.</span>
                    </span>
                  </li>
                  <li>
                    <CheckIcon size={16} />
                    <span>
                      <b>Host identity verified.</b>
                      <span className="pp-meta">KYC completed · property title cross-checked.</span>
                    </span>
                  </li>
                  <li>
                    <CheckIcon size={16} />
                    <span>
                      <b>Listed at the exact address shown.</b>
                      <span className="pp-meta">No swap-on-arrival · GPS pin matches registration.</span>
                    </span>
                  </li>
                  <li>
                    <CheckIcon size={16} />
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
              {room.tagline && (
                <p className="pp-prose"><strong>{room.tagline}</strong></p>
              )}
              {highlights.length > 0 && (
                <ul className="pp-prose-list" aria-label="Home highlights">
                  {displayedHighlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {highlights.length > 4 && (
                <button
                  type="button"
                  className="pp-prose-more"
                  onClick={() => setShowAllHighlights((s) => !s)}
                  aria-expanded={showAllHighlights}
                >
                  {showAllHighlights ? 'Show less' : `Read more`}
                  <ChevronDown size={14} />
                </button>
              )}
            </section>

            {/* Amenities */}
            <section className="pp-section" aria-label="Amenities">
              <div className="pp-section-head">
                <h2>What&rsquo;s here</h2>
              </div>
              <div className="pp-amenities">
                {highlights.slice(0, 12).map((label) => {
                  const Icon = resolveIcon(label);
                  return (
                    <div key={label} className="pp-amenity">
                      <Icon size={18} aria-hidden="true" />
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Reviews */}
            {reviewsData && reviewsData.totalCount > 0 && (
              <section className="pp-section" aria-label="Guest reviews">
                <div className="pp-section-head">
                  <h2>
                    ★ {reviewsData.averageRating.toFixed(1)} from {reviewsData.totalCount}{' '}
                    {reviewsData.totalCount === 1 ? 'guest' : 'guests'}
                  </h2>
                </div>

                <div className="pp-reviews-summary">
                  <div>
                    <div className="pp-rating-big" aria-label={`${reviewsData.averageRating.toFixed(1)} out of 5`}>
                      {reviewsData.averageRating.toFixed(1)}
                    </div>
                    <span className="pp-rating-stars" aria-hidden="true">★★★★★</span>
                    <div className="pp-rating-big-sub">{reviewsData.totalCount} verified {reviewsData.totalCount === 1 ? 'stay' : 'stays'}</div>
                  </div>
                  <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
                    <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#1a1a2e' }}>Overall rating</p>
                    <p style={{ margin: 0 }}>
                      Guests rate this home {reviewsData.averageRating.toFixed(1)} out of 5 based on{' '}
                      {reviewsData.totalCount} {reviewsData.totalCount === 1 ? 'review' : 'reviews'}.
                      All reviews are from verified stays booked through this platform.
                    </p>
                  </div>
                </div>

                <div className="pp-review-grid">
                  {(displayedReviews ?? []).map((r, idx) => (
                    <article key={r.id} className="pp-review">
                      <div className="pp-review-head">
                        <div
                          className="pp-review-avatar"
                          aria-hidden="true"
                          style={{
                            background: REVIEW_BG_COLORS[idx % REVIEW_BG_COLORS.length],
                            color: REVIEW_TEXT_COLORS[idx % REVIEW_TEXT_COLORS.length],
                          }}
                        >
                          {(r.guestName ?? 'G').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="pp-review-name">{r.guestName ?? 'Guest'}</div>
                          <div className="pp-review-date">
                            {new Date(r.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                          </div>
                        </div>
                      </div>
                      {r.title && <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', margin: '0 0 4px' }}>{r.title}</p>}
                      {r.body && <p className="pp-review-body">{r.body}</p>}
                      {r.isVerifiedStay && (
                        <span className="pp-review-verified">
                          <CheckIcon size={10} /> Verified stay
                        </span>
                      )}
                      {r.hostResponse && (
                        <div className="pp-review-host-resp">
                          <div className="pp-review-host-resp-label">Host response</div>
                          <p>{r.hostResponse}</p>
                        </div>
                      )}
                    </article>
                  ))}
                </div>

                {reviewsData.reviews.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAllReviews((s) => !s)}
                    className="pp-prose-more"
                    style={{ marginTop: 16 }}
                    aria-expanded={showAllReviews}
                  >
                    {showAllReviews
                      ? 'Show fewer reviews'
                      : `View all ${reviewsData.totalCount} reviews`}
                    <ChevronDown size={14} />
                  </button>
                )}
              </section>
            )}

            {/* Cancellation policy */}
            <section className="pp-section" aria-label="Cancellation policy">
              <h2 style={{ marginBottom: 18 }}>If you need to cancel</h2>
              <div className="pp-refund">
                <div className="pp-refund-head">
                  <div>
                    <h3>{cancellationInfo.headline}</h3>
                    <p>{cancellationInfo.description}</p>
                  </div>
                </div>
                <div className="pp-timeline" role="list">
                  {cancellationInfo.steps.map((step) => (
                    <div key={step.title} className="pp-timeline-step" role="listitem">
                      <div className="pp-tl-dot" aria-hidden="true" />
                      <h6>{step.title}</h6>
                      <p>{step.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Location map */}
            {hasLocation && (
              <section className="pp-section" aria-label="Location">
                <div className="pp-section-head">
                  <h2>Where you&rsquo;ll be</h2>
                  {apiListing?.propertyAddress && (
                    <span className="pp-muted" style={{ fontSize: 13 }}>{apiListing.propertyAddress}</span>
                  )}
                </div>
                <EmbeddedListingMap
                  latitude={Number(apiListing!.latitude)}
                  longitude={Number(apiListing!.longitude)}
                  label={room.title}
                  height={320}
                />
              </section>
            )}

          </div>
          {/* ===== END LEFT COLUMN ===== */}

          {/* ===== RIGHT COLUMN — sticky booking ===== */}
          <aside className="pp-booking-col" ref={bookingRef} aria-label="Booking">
            <Suspense fallback={
              <div style={{ height: 340, borderRadius: 20, background: '#f9f5f0', border: '1px solid #f0e6dc' }} />
            }>
              <UnitBookingWidget
                listingId={room.listingId}
                listingName={room.title}
                maxGuests={room.maxGuests}
                hostPhone={(room as { hostPhone?: string | null }).hostPhone ?? null}
              />
            </Suspense>
          </aside>

        </div>
        {/* ===== END pp-main ===== */}

        {/* Tourism registration row */}
        {showRegRow && (
          <div className="pp-reg-row" aria-label="Operator registration details">
            <b>Registered operator.</b>{' '}
            {tenantOverrides.gstin && (
              <>GSTIN <code>{tenantOverrides.gstin}</code>{' '}</>
            )}
            {tenantOverrides.tourismRegNumbers?.map((reg) => (
              <span key={reg}>· Tourism Reg. <code>{reg}</code>{' '}</span>
            ))}
            · {getTenantBrandName()}
          </div>
        )}

      </div>
      {/* ===== END pp-shell ===== */}

      {/* Mobile sticky CTA */}
      {apiListing?.baseNightlyRate != null && (
        <div className="pp-m-sticky" aria-label="Book this property">
          <div className="pp-m-sticky-price">
            <b>₹{apiListing.baseNightlyRate.toLocaleString('en-IN')}</b>
            <span>/ night</span>
          </div>
          <button
            type="button"
            className="pp-btn pp-btn-primary pp-m-sticky-cta"
            onClick={() => bookingRef.current?.scrollIntoView({ behavior: 'smooth' })}
            aria-label="Scroll to booking form"
          >
            Reserve
          </button>
        </div>
      )}

    </div>
  );
};

export default HomeDetails;
