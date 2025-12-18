import { Link } from 'react-router-dom';
import { LOGO_URL } from '../../../config/branding';
import { trackEvent } from '../../../utils/analytics';

const HERO_IMAGE = 'https://atlashomestorage.blob.core.windows.net/listing-images/fallback.jpeg';

const uspItems = [
  'Verified homes',
  'Secure Razorpay payments',
  'No hidden fees',
  'Flexible cancellation',
];

const Slider = () => {
  return (
    <section className="w-full bg-neutral-50 text-neutral-900">
      <div className="relative isolate overflow-hidden min-h-[75vh] md:min-h-[70vh] flex items-center justify-center">
        <img
          src={HERO_IMAGE}
          alt="Modern living room with warm lighting"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/80 via-neutral-900/70 to-neutral-900/60" />

        <div className="relative z-10 flex flex-col items-center gap-6 px-6 py-12 text-center max-w-4xl">
          <Link to="/" className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Atlas Homestays" className="h-14 w-auto rounded-md bg-white/80 p-2 shadow" />
            <span className="text-xl font-semibold text-white tracking-wide">Atlas Homestays</span>
          </Link>

          <div className="space-y-3">
            <p className="text-3xl md:text-5xl font-semibold text-white drop-shadow-lg">
              Thoughtfully curated stays in Hyderabad
            </p>
            <p className="text-base md:text-lg text-white/90">
              Discover verified apartments with flexible bookings, transparent pricing, and secure payments.
            </p>
          </div>

          <div className="w-full max-w-3xl rounded-full bg-white/95 shadow-xl backdrop-blur border border-white/60 p-3 sm:p-4 flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4">
            <div className="flex flex-1 items-center gap-3 rounded-full bg-neutral-100 px-4 py-3 shadow-inner">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">City</span>
              <input
                type="text"
                value="Hyderabad"
                readOnly
                className="w-full bg-transparent text-lg font-semibold text-neutral-900 placeholder:text-neutral-500 focus:outline-none"
              />
            </div>
            <Link
              to="/apartments"
              onClick={() =>
                trackEvent('listings_browse', { surface: 'hero_cta' }, { route: '/' })
              }
              className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Browse listings
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-white">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-3 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4">
          {uspItems.map((usp) => (
            <div
              key={usp}
              className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-center shadow-sm"
            >
              <p className="text-sm font-semibold text-neutral-800">{usp}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Slider;
