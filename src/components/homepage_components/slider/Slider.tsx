import React from 'react';
import { Link } from 'react-router-dom';
import { BadgePercent, CheckCircle2, ShieldCheck } from 'lucide-react';
import { TrustBadge } from '../../ui/TrustBadge';
import { SearchAvailabilityWidget } from '../../availability/SearchAvailabilityWidget';
const TRUST_BADGES = [
  { label: 'Verified homes', icon: CheckCircle2 },
  { label: 'Secure Razorpay payments', icon: ShieldCheck },
  { label: 'No hidden fees', icon: BadgePercent },
];

const STAGGER = ['hero-stagger-0', 'hero-stagger-1', 'hero-stagger-2', 'hero-stagger-3', 'hero-stagger-4'];

const Slider = () => {
  return (
    <section
      className="relative min-h-[90vh] flex flex-col justify-center pt-[var(--nav-height)] pb-20 overflow-hidden"
      style={{ background: 'var(--gradient-hero)' }}
      aria-labelledby="hero-title"
    >
      <div
        className="absolute top-[-10%] right-[-8%] w-[75%] max-w-[720px] h-[75%] max-h-[560px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255, 232, 214, 0.28) 0%, transparent 72%)' }}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-[1100px] mx-auto px-[6%] flex flex-col items-center text-center gap-8">
        <div
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-primary)] bg-[var(--brand-soft)] ${STAGGER[0]}`}
          style={{ animation: 'heroFadeInUp 0.8s cubic-bezier(0.33, 1, 0.4, 1) both' }}
        >
          <span aria-hidden>✦</span>
          <span>Welcome to</span>
        </div>

        <h1
          id="hero-title"
          className={`font-display font-semibold text-[34px] leading-[1.2] md:text-5xl lg:text-[40px] tracking-tight text-[var(--text-primary)] ${STAGGER[1]}`}
          style={{
            animation: 'heroFadeInUp 0.9s cubic-bezier(0.33, 1, 0.4, 1) 0.08s both',
            fontFamily: 'var(--font-family-display)',
          }}
        >
          Thoughtfully curated stays in Hyderabad
        </h1>

        <p
          className={`max-w-2xl text-[var(--text-body)] text-base md:text-lg font-normal leading-relaxed text-[var(--text-muted)] ${STAGGER[2]}`}
          style={{
            animation: 'heroFadeInUp 0.9s cubic-bezier(0.33, 1, 0.4, 1) 0.16s both',
            fontFamily: 'var(--font-family-base)',
          }}
        >
          Discover verified apartments with flexible bookings, transparent pricing, and secure payments.
        </p>

        <div
          className={`w-full max-w-[980px] ${STAGGER[3]}`}
          style={{ animation: 'heroFadeInUp 1s cubic-bezier(0.33, 1, 0.4, 1) 0.22s both' }}
        >
          <div className="rounded-[20px] bg-white/96 shadow-[var(--shadow-level-3)] backdrop-blur-sm border border-white/80 overflow-hidden">
            <SearchAvailabilityWidget mode="search" />
          </div>
        </div>

        <div
          className="flex flex-wrap items-center justify-center gap-6 md:gap-8 pt-2"
          data-testid="trust-badges"
          style={{ animation: 'heroFadeInUp 1s cubic-bezier(0.33, 1, 0.4, 1) 0.28s both' }}
        >          {TRUST_BADGES.map(({ label, icon }) => (
            <TrustBadge
              key={label}
              icon={icon}
              label={label}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200"
            />
          ))}
        </div>

        <Link to="/#our-homes" className="sr-only">
          Skip to Our Homes
        </Link>      </div>
    </section>
  );
};

export default Slider;
