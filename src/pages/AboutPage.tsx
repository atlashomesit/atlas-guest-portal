/* eslint-disable atlas-brand/no-atlas-string-leak -- TODO Task 16: replace with per-tenant content */
import { CheckCircle2, HeartHandshake, ShieldCheck, Sparkles, Users, MapPin, Clock4, BedDouble, Medal } from "lucide-react";
import SEO from "../components/SEO";

const stayIllustration = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg width="640" height="360" viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
    <title id="title">Modern homestay illustration</title>
    <desc id="desc">Abstract illustration of a modern apartment with warm lighting.</desc>
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#eef2ff" />
        <stop offset="100%" stop-color="#dbeafe" />
      </linearGradient>
      <linearGradient id="accent" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#6366f1" stop-opacity="0.9" />
        <stop offset="100%" stop-color="#22d3ee" stop-opacity="0.9" />
      </linearGradient>
    </defs>
    <rect width="640" height="360" rx="28" fill="url(#bg)" />
    <rect x="60" y="80" width="520" height="200" rx="22" fill="white" stroke="#e2e8f0" stroke-width="4" />
    <rect x="100" y="120" width="220" height="120" rx="16" fill="url(#accent)" />
    <rect x="340" y="120" width="180" height="40" rx="12" fill="#c7d2fe" />
    <rect x="340" y="180" width="140" height="28" rx="10" fill="#e0f2fe" />
    <rect x="340" y="220" width="110" height="20" rx="8" fill="#c4b5fd" />
    <circle cx="170" cy="150" r="38" fill="white" stroke="#eef2ff" stroke-width="6" />
    <path d="M148 152c12 12 24 12 36 0" stroke="url(#accent)" stroke-width="8" stroke-linecap="round" fill="none" />
    <rect x="120" y="210" width="180" height="12" rx="6" fill="#a5b4fc" />
    <rect x="120" y="230" width="120" height="12" rx="6" fill="#c7d2fe" />
    <path d="M520 260c-24 32-192 46-240 34-48-12-76-34-120-26" stroke="#c7d2fe" stroke-width="8" stroke-linecap="round" fill="none" />
  </svg>
`)}
`;

const serviceIllustration = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg width="640" height="360" viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="serviceTitle serviceDesc">
    <title id="serviceTitle">Guest services illustration</title>
    <desc id="serviceDesc">Illustration of concierge support and guided stays.</desc>
    <defs>
      <linearGradient id="serviceBg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ecfeff" />
        <stop offset="100%" stop-color="#f5f3ff" />
      </linearGradient>
      <linearGradient id="serviceAccent" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.9" />
        <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.9" />
      </linearGradient>
    </defs>
    <rect width="640" height="360" rx="28" fill="url(#serviceBg)" />
    <rect x="80" y="90" width="480" height="200" rx="24" fill="white" stroke="#e5e7eb" stroke-width="4" />
    <circle cx="200" cy="180" r="70" fill="url(#serviceAccent)" />
    <path d="M180 172c10-16 30-16 40 0" stroke="white" stroke-width="10" stroke-linecap="round" fill="none" />
    <circle cx="180" cy="168" r="6" fill="white" />
    <circle cx="220" cy="168" r="6" fill="white" />
    <rect x="290" y="130" width="210" height="26" rx="10" fill="#c4b5fd" />
    <rect x="290" y="170" width="150" height="20" rx="10" fill="#a5f3fc" />
    <rect x="290" y="210" width="180" height="30" rx="12" fill="#bfdbfe" />
    <path d="M150 250c30 18 120 46 200 26 80-20 80-56 134-52" stroke="#cbd5e1" stroke-width="8" stroke-linecap="round" fill="none" />
  </svg>
`)}
`;

const hospitalityStandards = [
  {
    title: "Thoughtful arrivals",
    description: "48-hour pre-arrival walkthroughs, fresh linens, and climate-ready rooms before every check-in.",
    icon: Clock4,
  },
  {
    title: "Comfort-first stays",
    description: "Queen beds with hotel-grade mattresses, stocked kitchens, and work-friendly layouts in every home.",
    icon: BedDouble,
  },
  {
    title: "Local support, always",
    description: "On-the-ground hosts with response times under 10 minutes for anything from Wi‑Fi resets to dinner reservations.",
    icon: MapPin,
  },
  {
    title: "Cleanliness without compromise",
    description: "CDC-aligned cleaning checklists, double inspections, and eco-friendly supplies in rotation.",
    icon: CheckCircle2,
  },
];

const trustBadges = [
  {
    title: "Verified & insured",
    description: "Licensed homestays with verified owners and comprehensive guest insurance on every booking.",
    icon: ShieldCheck,
  },
  {
    title: "Guest-first policies",
    description: "Clear cancellation, transparent pricing, and no surprise fees—ever.",
    icon: HeartHandshake,
  },
  {
    title: "Recognized hosts",
    description: "Consistently rated 4.8★+ across partner platforms and recurring corporate stays.",
    icon: Medal,
  },
  {
    title: "Security-led design",
    description: "Smart locks, privacy-safe monitoring, and secure payments keep every stay protected.",
    icon: Sparkles,
  },
];

const teamMembers = [
  {
    name: "Aisha Rao",
    title: "Guest Experience Lead",
    focus: "Designs arrival rituals, accessibility checklists, and empathetic support scripts for our hosts.",
  },
  {
    name: "Luis Mendoza",
    title: "Operations Strategist",
    focus: "Coordinates local partners, 24/7 maintenance coverage, and quality audits across every city we serve.",
  },
  {
    name: "Nihar Mehta",
    title: "Hospitality Technologist",
    focus: "Builds the digital tools that keep housekeeping, concierge, and guest messaging in perfect sync.",
  },
];

const missionHighlights = [
  "Pair the reliability of boutique hotels with the character of privately hosted homes.",
  "Champion hospitality careers by training local teams and celebrating their craft.",
  "Design calm, tech-enabled spaces that help guests feel grounded—whether for a night or a month.",
];

const AboutPage = () => (
  <div className="bg-bg-muted text-text-primary min-h-screen">
    <SEO
      title="About Atlas Homestays | Mission, Team & Hospitality Standards"
      description="Discover the mission behind Atlas Homestays, meet the team that powers guest experiences, and explore the hospitality standards and trust badges that guide every stay."
      jsonLd={{
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Atlas Homestays',
        description:
          'Serviced apartments designed for modern travelers with verified hosts, trusted standards, and responsive local teams.',
        url: 'https://atlashomestays.com/about',
        brand: 'Atlas Homestays',
      }}
    />

    <div className="px-4 md:px-10 lg:px-20 py-20 space-y-16">
      <section className="bg-bg-surface border border-border-subtle shadow-level2 rounded-3xl p-8 md:p-12 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center" data-testid="mission-section">
        <div className="space-y-6">
          <p className="uppercase tracking-[0.2em] text-primary font-semibold">Atlas Homestays</p>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">Where dependable stays meet human hospitality</h1>
          <p className="text-lg text-text-muted max-w-2xl">
            We are a collective of hosts, designers, and operators who believe every serviced apartment should feel personal—without sacrificing reliability. From the first message to checkout, our mission is to keep guests at ease and make every city feel familiar.
          </p>
          <ul className="space-y-3 text-text-muted">
            {missionHighlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary mt-1" />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold">
              <HeartHandshake className="w-4 h-4" />
              Guest-first by design
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 text-secondary font-semibold">
              <Sparkles className="w-4 h-4" />
              Detail-obsessed spaces
            </span>
          </div>
        </div>
        <figure className="bg-gradient-to-br from-primary/10 via-cta-primary/10 to-secondary/10 rounded-2xl p-4 border border-border-subtle">
          <img src={stayIllustration} alt="Apartment interior with warm lighting" className="w-full rounded-xl shadow-level2" loading="lazy" decoding="async" />
          <figcaption className="sr-only">Illustration of a modern homestay with warm lighting and layered textures.</figcaption>
        </figure>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] items-center" data-testid="hospitality-section">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.18em] text-primary font-semibold">Hospitality standards</p>
          <h2 className="text-2xl md:text-3xl font-bold">Standards that travel with you</h2>
          <p className="text-text-muted max-w-3xl">
            Every Atlas home is audited on the same quality framework. We match hotel-grade consistency with the warmth of local hosts so travelers never have to choose between comfort and character.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {hospitalityStandards.map(({ title, description, icon: Icon }) => (
              <article key={title} className="bg-bg-surface border border-border-subtle rounded-2xl p-4 shadow-level1 flex gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-text-primary">{title}</h3>
                  <p className="text-base text-text-muted leading-relaxed">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <figure className="bg-bg-surface border border-border-subtle rounded-2xl p-4 shadow-level1">
          <img src={serviceIllustration} alt="Concierge illustration" className="w-full rounded-xl" loading="lazy" decoding="async" />
          <figcaption className="sr-only">Illustration of concierge-style support, messaging, and guided stays.</figcaption>
        </figure>
      </section>

      <section className="bg-bg-surface border border-border-subtle rounded-3xl p-8 shadow-level1" data-testid="team-section">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-primary font-semibold">Meet the team</p>
            <h2 className="text-2xl md:text-3xl font-bold">People who craft every Atlas stay</h2>
            <p className="text-text-muted max-w-2xl mt-2">
              Our distributed team blends hospitality know-how with operational rigor, ensuring each apartment is cared for like a boutique property.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cta-primary text-[var(--text-contrast)] font-semibold shadow-level1">
            <Users className="w-4 h-4" />
            Local hosts + central operations
          </div>
        </div>
        <div className="grid gap-4 mt-6 md:grid-cols-3">
          {teamMembers.map(({ name, title, focus }) => (
            <article key={name} className="border border-border-subtle rounded-2xl p-5 bg-gradient-to-b from-bg-surface to-bg-muted/60 shadow-level1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-primary/15 text-primary font-semibold flex items-center justify-center uppercase" aria-hidden>
                  {name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary">{name}</h3>
                  <p className="text-base text-text-muted">{title}</p>
                </div>
              </div>
              <p className="text-base text-text-muted leading-relaxed">{focus}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-bg-surface border border-border-subtle rounded-3xl p-8 shadow-level1" data-testid="trust-section">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-primary font-semibold">Trust badges</p>
            <h2 className="text-2xl md:text-3xl font-bold">Confidence built into every booking</h2>
            <p className="text-text-muted max-w-3xl mt-2">
              We publish the promises that guide our team, so guests know exactly how we operate before they arrive.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold">
            <ShieldCheck className="w-4 h-4" />
            Verified stays network
          </span>
        </div>
        <div className="grid gap-4 mt-6 sm:grid-cols-2 lg:grid-cols-4">
          {trustBadges.map(({ title, description, icon: Icon }) => (
            <article key={title} className="border border-border-subtle rounded-2xl p-4 bg-bg-muted/60">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center mb-3">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-text-primary mb-1">{title}</h3>
              <p className="text-base text-text-muted leading-relaxed">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  </div>
);

export default AboutPage;
