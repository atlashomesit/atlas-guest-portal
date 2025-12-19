import { Link } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Receipt, ShieldCheck } from 'lucide-react';
import { LOGO_URL } from '../../../config/branding';
import { trackEvent } from '../../../utils/analytics';
import { FeatureBadge } from '../../ui/FeatureBadge';

const HERO_IMAGE = 'https://atlashomestorage.blob.core.windows.net/listing-images/fallback.jpeg';
const HERO_OVERLAY = 'linear-gradient(120deg, rgba(21, 30, 44, 0.82) 0%, rgba(21, 30, 44, 0.68) 45%, rgba(21, 30, 44, 0.8) 100%)';

const uspItems = [
  { label: 'Verified homes', icon: CheckCircle2 },
  { label: 'Secure Razorpay payments', icon: ShieldCheck },
  { label: 'No hidden fees', icon: Receipt },
  { label: 'Flexible cancellation', icon: CalendarClock },
];

const Slider = () => {
  return (
    <section className="w-full bg-bg-muted text-text-primary">
      <div
        className="relative isolate overflow-hidden min-h-[75vh] md:min-h-[70vh] flex items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `${HERO_OVERLAY}, url(${HERO_IMAGE})` }}
      >
        <div className="relative z-10 flex flex-col items-center gap-7 px-6 py-12 text-center max-w-4xl">
          <Link to="/" className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Atlas Homestays" className="h-14 w-auto rounded-md bg-[color:color-mix(in_srgb,var(--bg-surface)_80%,transparent)] p-2 shadow-level1" />
            <span className="text-xl font-semibold text-[var(--text-contrast)] tracking-wide">Atlas Homestays</span>
          </Link>

          <div className="space-y-4 max-w-3xl">
            <p
              className="text-3xl md:text-5xl font-semibold text-[var(--text-on-hero)] drop-shadow-lg text-pretty"
              style={{ textWrap: 'balance' }}
            >
              Thoughtfully curated stays in Hyderabad
            </p>
            <p
              className="text-base md:text-lg text-[color-mix(in_srgb,var(--text-on-hero)_88%,transparent)] text-pretty"
              style={{ textWrap: 'balance' }}
            >
              Discover verified apartments with flexible bookings, transparent pricing, and secure payments.
            </p>
          </div>

          <div className="w-full max-w-3xl rounded-full bg-[color:color-mix(in_srgb,var(--bg-surface)_92%,transparent)] shadow-level2 backdrop-blur border border-[color:color-mix(in_srgb,var(--bg-surface)_55%,transparent)] p-3 sm:p-4 flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4">
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
