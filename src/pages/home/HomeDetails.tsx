import { Link, useParams } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Wifi, Snowflake, Tv, Car, UtensilsCrossed, WashingMachine,
  Dumbbell, Waves, TreePine, Mountain, BedDouble, Briefcase,
  ShieldCheck, Sparkles, Users, CheckCircle2,
} from "lucide-react";

import { homes, defaultHomeHighlights } from "../../content/homes";
import { useBooking } from "../../contexts/BookingContext";
import { CONTACT } from "../../config/contact";
import { getTenantContext } from "../../tenant/tenantContext";
import { getTenantOverrides } from "../../tenant/tenantOverrides";
import { usePropertyListings } from "../../hooks/usePropertyListings";

const UnitBookingWidget = lazy(() => import("../../components/availability/UnitBookingWidget"));

const fallbackImage = "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80";

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

function resolveIcon(label: string): LucideIcon {
  const lower = label.toLowerCase();
  for (const { icon, keywords } of AMENITY_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) return icon;
  }
  return CheckCircle2;
}

function AmenityChip({ label }: { label: string }) {
  const Icon = resolveIcon(label);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-surface px-3 py-1.5 text-sm text-text-secondary">
      <Icon size={15} className="shrink-0 text-brand-primary" />
      {label}
    </span>
  );
}

const HomeDetails = () => {
  const { roomNo } = useParams<{ roomNo: string }>();
  const { homes: apiHomes } = usePropertyListings();
  const tenantOverrides = getTenantOverrides(getTenantContext()?.slug);

  // First try to find in API data (by listing ID)
  const apiRoom = apiHomes.find((item) => item.roomNo === roomNo);

  // Fallback to hardcoded homes
  const room = apiRoom ? {
    roomNo,
    title: apiRoom.title,
    href: apiRoom.href,
    slug: apiRoom.title.toLowerCase().replace(/_/g, '-'),
    images: [],
    maxGuests: 2,
  } : homes.find((item) => item.roomNo === roomNo);

  const { updateBooking } = useBooking();

  useEffect(() => {
    if (!room) return;
    updateBooking({ listingDetailPath: room.href });
  }, [room, updateBooking]);

  const primaryImage = room?.images?.[0] ?? fallbackImage;

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
    return () => {
      link.remove();
    };
  }, [room, primaryImage]);
  const highlights = room?.highlights?.length ? room.highlights : defaultHomeHighlights;

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

  return (
    <section className="max-w-5xl mx-auto px-4 py-12 flex flex-col gap-6">
      <div>
        {!tenantOverrides.hideAtlasHomesBranding && (
          <p className="text-sm uppercase tracking-wide text-text-muted">Atlas Homes</p>
        )}
        <h1 className="text-4xl font-bold text-text-primary">{room.title}</h1>
        {room.tagline && <p className="mt-2 text-lg text-text-secondary">{room.tagline}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <img
            src={primaryImage}
            alt={room.title}
            className="w-full h-80 object-cover rounded-2xl shadow-level1"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
          {room.images && room.images.length > 1 && (
            <div className="flex gap-2 mt-3">
              {room.images.slice(0, 4).map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`${room.title} photo ${idx + 1}`}
                  className="h-20 w-24 flex-shrink-0 rounded-lg object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-level1 border border-border-subtle p-5 h-fit">
          <h2 className="text-xl font-semibold text-text-primary mb-3">Highlights</h2>
          <ul className="list-disc pl-5 space-y-2 text-text-secondary">
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Amenities icon chips */}
      <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5">
        <h2 className="text-lg font-semibold text-text-primary mb-3">Amenities</h2>
        <div className="flex flex-wrap gap-2">
          {highlights.slice(0, 12).map((label) => (
            <AmenityChip key={label} label={label} />
          ))}
        </div>
      </div>

      {/* Booking widget */}
      <Suspense fallback={
        <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 animate-pulse h-48" />
      }>
        <UnitBookingWidget
          listingId={room.listingId}
          listingName={room.title}
          maxGuests={room.maxGuests}
        />
      </Suspense>

      {/* Chat with host WhatsApp CTA (TASK-355) */}
      <a
        href={`https://wa.me/${CONTACT.business.whatsapp}?text=${encodeURIComponent(`Hi, I'm interested in booking ${room.title}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="chat-with-host-btn"
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#25D366] text-[#1a9e4f] bg-[#f0fdf4] px-5 py-3 text-sm font-semibold transition hover:bg-[#dcfce7]"
        aria-label={`Chat with host on WhatsApp about ${room.title}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.113 1.523 5.839L0 24l6.337-1.502A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.783 9.783 0 01-5.037-1.394l-.361-.215-3.761.892.929-3.643-.235-.374A9.783 9.783 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
        </svg>
        💬 Chat with host
      </a>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/#our-homes"
          className="inline-flex items-center justify-center rounded-full border border-border-subtle px-5 py-3 text-sm font-semibold text-text-primary transition hover:border-[color:var(--cta-primary)] hover:text-[color:var(--cta-primary)]"
        >
          Back to Our Homes
        </Link>
      </div>
    </section>
  );
};

export default HomeDetails;
