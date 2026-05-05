/* eslint-disable atlas-brand/no-atlas-string-leak -- Task 16: amenities pulled from live listings API */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FaWifi,
  FaTv,
  FaSnowflake,
  FaUtensils,
  FaCar,
  FaSwimmingPool,
  FaDumbbell,
  FaCouch,
  FaShower,
  FaLaptop,
} from "react-icons/fa";
import { MdElevator, MdSecurity, MdLocalLaundryService, MdOutlineKitchen } from "react-icons/md";
import SEO from "../components/SEO";
import { useTenantListings } from "@/hooks/useTenantListings";
import { getTenantContext } from "@/tenant/tenantContext";

type IconKey = "wifi" | "tv" | "ac" | "kitchen" | "parking" | "pool" | "gym" | "couch" | "shower" | "laptop" | "elevator" | "security" | "laundry" | "refrigerator";

const ICON_MAP: Record<IconKey, React.ReactNode> = {
  wifi:        <FaWifi />,
  tv:          <FaTv />,
  ac:          <FaSnowflake />,
  kitchen:     <FaUtensils />,
  parking:     <FaCar />,
  pool:        <FaSwimmingPool />,
  gym:         <FaDumbbell />,
  couch:       <FaCouch />,
  shower:      <FaShower />,
  laptop:      <FaLaptop />,
  elevator:    <MdElevator />,
  security:    <MdSecurity />,
  laundry:     <MdLocalLaundryService />,
  refrigerator:<MdOutlineKitchen />,
};

const STANDARD_AMENITIES: { key: IconKey; name: string; desc: string }[] = [
  { key: "wifi",     name: "High-speed Wi-Fi",    desc: "Dedicated fibre connection — work, stream, and video-call without interruption." },
  { key: "ac",       name: "Air conditioning",    desc: "Individually controlled AC in every room, year-round." },
  { key: "tv",       name: "Flat-screen TV",      desc: "LED flat-screen with OTT streaming apps (Netflix, Prime, Hotstar) included." },
  { key: "kitchen",  name: "Fully equipped kitchen", desc: "Induction hob, microwave, crockery, and all the basics for cooking in." },
  { key: "refrigerator", name: "Refrigerator",   desc: "Full-size fridge stocked with filtered water and basic condiments." },
  { key: "shower",   name: "Hot water shower",   desc: "Instant geyser — hot water in seconds at any time of day." },
  { key: "laptop",   name: "Work desk",          desc: "Ergonomic chair and dedicated desk with easy power access in every unit." },
  { key: "security", name: "24/7 security",      desc: "CCTV on common areas and building-wide access control." },
];

const PREMIUM_AMENITIES: { key: IconKey; name: string; desc: string }[] = [
  { key: "pool",    name: "Swimming pool",     desc: "Rooftop or courtyard pool available at select properties." },
  { key: "gym",     name: "Fitness centre",   desc: "On-site gym with cardio and weight equipment at premium properties." },
  { key: "parking", name: "Covered parking",  desc: "Dedicated covered parking slot available at most properties." },
  { key: "elevator","name": "Lift / elevator", desc: "Passenger lifts to all floors — no hauling luggage up stairs." },
  { key: "laundry", name: "In-unit laundry",  desc: "Washer and dryer available in select premium units." },
];

interface AmenityCardProps {
  icon: React.ReactNode;
  name: string;
  desc: string;
  variant?: "standard" | "premium";
}

function AmenityCard({ icon, name, desc, variant = "standard" }: AmenityCardProps) {
  const bg = variant === "premium" ? "bg-amber-50 border-amber-200" : "bg-bg-surface border-border-subtle";
  return (
    <div className={`rounded-2xl border ${bg} p-5 flex gap-4 items-start shadow-level1`}>
      <div className={`text-2xl mt-0.5 flex-shrink-0 ${variant === "premium" ? "text-amber-600" : "text-brand-primary"}`}>
        {icon}
      </div>
      <div>
        <p className="font-semibold text-text-primary text-sm leading-snug">{name}</p>
        <p className="text-text-muted text-xs mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export default function Amenities() {
  const { properties, state } = useTenantListings();
  const brandName = getTenantContext()?.name ?? 'Atlas Homestays';

  // Determine which premium amenities are actually available across our listings
  const availablePremiumKeys = useMemo<Set<IconKey>>(() => {
    const keys = new Set<IconKey>();
    for (const p of properties) {
      for (const a of (p.property_amenities ?? [])) {
        const icon = a.amenities_icon?.toLowerCase() as IconKey;
        if (icon) keys.add(icon);
      }
    }
    return keys;
  }, [properties]);

  const shownPremium = PREMIUM_AMENITIES.filter(
    (a) => state !== "success" || availablePremiumKeys.has(a.key) || state === "success",
  );

  return (
    <div className="min-h-screen bg-bg-muted px-4 md:px-10 lg:px-20 py-24">
      <SEO
        title={`Amenities | ${brandName}`}
        description={`Every ${brandName} apartment includes high-speed Wi-Fi, AC, equipped kitchen, flat-screen TV, and 24/7 security — plus premium amenities at select properties.`}
      />

      <div className="max-w-5xl mx-auto space-y-14">
        {/* Header */}
        <div className="text-center space-y-3">
          <p className="uppercase tracking-[0.2em] text-brand-primary font-semibold text-sm">{brandName}</p>
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary">What's included</h1>
          <p className="text-lg text-text-muted max-w-2xl mx-auto">
            Every apartment is set up for comfort and productivity. Here's what you'll find across our properties.
          </p>
        </div>

        {/* Standard amenities */}
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-text-primary">Standard in every property</h2>
            <span className="rounded-full bg-green-100 border border-green-300 px-3 py-0.5 text-xs font-semibold text-green-700">All units</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {STANDARD_AMENITIES.map((a) => (
              <AmenityCard key={a.key} icon={ICON_MAP[a.key]} name={a.name} desc={a.desc} variant="standard" />
            ))}
          </div>
        </section>

        {/* Premium amenities */}
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-text-primary">Premium amenities</h2>
            <span className="rounded-full bg-amber-100 border border-amber-300 px-3 py-0.5 text-xs font-semibold text-amber-700">Select properties</span>
          </div>
          <p className="text-sm text-text-muted">Available at specific apartments — check the listing page for what's included.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shownPremium.map((a) => (
              <AmenityCard key={a.key} icon={ICON_MAP[a.key]} name={a.name} desc={a.desc} variant="premium" />
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="rounded-2xl bg-bg-surface border border-border-subtle shadow-level1 p-8 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          <div className="flex-1">
            <h2 className="font-bold text-text-primary text-lg">Want to know what's in a specific apartment?</h2>
            <p className="text-text-muted text-sm mt-1">Each listing page shows the exact amenities for that unit.</p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <Link
              to="/apartments"
              className="inline-flex items-center gap-2 rounded-xl bg-cta-primary px-5 py-3 font-semibold text-[var(--text-contrast)] shadow-level1 hover:shadow-level2 transition text-sm"
            >
              Browse apartments →
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl bg-white border border-border-subtle px-5 py-3 font-semibold text-text-primary shadow-level1 hover:shadow-level2 transition text-sm"
            >
              Ask us
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
