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
  const room = homes.find((item) => item.roomNo === roomNo);
  const { updateBooking } = useBooking();

  useEffect(() => {
    if (!room) return;
    updateBooking({ listingDetailPath: room.href });
  }, [room, updateBooking]);

  const primaryImage = room?.images?.[0] ?? fallbackImage;
  const highlights = room?.highlights?.length ? room.highlights : defaultHomeHighlights;

  if (!room) {
    return (
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-text-primary">Home not found</h1>
        <p className="mt-3 text-text-secondary">
          We could not find that home. Please return to the catalog to see available stays.
        </p>
        <Link to="/#our-homes" className="inline-flex mt-6 rounded-full bg-[color:var(--cta-primary)] px-4 py-2 text-white font-semibold">
          Back to Our Homes
        </Link>
      </section>
    );
  }

  return (
    <section className="max-w-5xl mx-auto px-4 py-12 flex flex-col gap-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-text-muted">Atlas Homes</p>
        <h1 className="text-4xl font-bold text-text-primary">{room.title}</h1>
        {room.tagline && <p className="mt-2 text-lg text-text-secondary">{room.tagline}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <img
            src={primaryImage}
            alt={room.title}
            className="w-full h-80 object-cover rounded-2xl shadow-level1"
            loading="lazy"
          />
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
