import { Link } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Receipt, ShieldCheck } from 'lucide-react';
import { LOGO_URL } from '../../../config/branding';
import { trackEvent } from '../../../utils/analytics';
import { FeatureBadge } from '../../ui/FeatureBadge';

const HERO_IMAGE = 'https://atlashomestorage.blob.core.windows.net/listing-images/fallback.jpeg';

const uspItems = [
  { label: 'Verified homes', icon: CheckCircle2 },
  { label: 'Secure Razorpay payments', icon: ShieldCheck },
  { label: 'No hidden fees', icon: Receipt },
  { label: 'Flexible cancellation', icon: CalendarClock },
];

const Slider = () => {
  return (
    <section className="w-full bg-bg-muted text-text-primary">
      <div className="relative isolate overflow-hidden min-h-[75vh] md:min-h-[70vh] flex items-center justify-center">
        <img
          src={HERO_IMAGE}
          alt="Modern living room with warm lighting"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[color:color-mix(in_srgb,var(--text-primary)_90%,transparent)] via-[color:color-mix(in_srgb,var(--text-primary)_72%,transparent)] to-[color:color-mix(in_srgb,var(--text-primary)_60%,transparent)]" />

        <div className="relative z-10 flex flex-col items-center gap-6 px-6 py-12 text-center max-w-4xl">
          <Link to="/" className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Atlas Homestays" className="h-14 w-auto rounded-md bg-[color:color-mix(in_srgb,var(--bg-surface)_80%,transparent)] p-2 shadow-level1" />
            <span className="text-xl font-semibold text-[var(--text-contrast)] tracking-wide">Atlas Homestays</span>
          </Link>

          <div className="space-y-3">
            <p className="text-3xl md:text-5xl font-semibold text-[var(--text-contrast)] drop-shadow-lg">
              Thoughtfully curated stays in Hyderabad
            </p>
            <p className="text-base md:text-lg text-[color-mix(in_srgb,var(--text-contrast)_90%,transparent)]">
              Discover verified apartments with flexible bookings, transparent pricing, and secure payments.
            </p>
          </div>

          <div className="w-full max-w-3xl rounded-full bg-[color:color-mix(in_srgb,var(--bg-surface)_95%,transparent)] shadow-level2 backdrop-blur border border-[color:color-mix(in_srgb,var(--bg-surface)_60%,transparent)] p-3 sm:p-4 flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4">
            <div className="flex flex-1 items-center gap-3 rounded-full bg-bg-muted px-4 py-3 shadow-inner">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">City</span>
              <input
                type="text"
                value="Hyderabad"
                readOnly
                className="w-full bg-transparent text-lg font-semibold text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>
            <Link
              to="/apartments"
              onClick={() =>
                trackEvent('listings_browse', { surface: 'hero_cta' }, { route: '/' })
              }
              className="inline-flex items-center justify-center rounded-full bg-cta-primary px-6 py-3 text-base font-semibold text-[var(--text-contrast)] shadow-level2 transition hover:bg-cta-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
            >
              Browse listings
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3 px-6 py-6">
          {uspItems.map(({ label, icon }) => (
            <FeatureBadge
              key={label}
              icon={icon}
              label={label}
              tone="linen"
              className="min-w-[240px] justify-center sm:min-w-[0]"
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Slider;
