import { hasAcceptedCookies } from './cookieConsent';

type AnalyticsEnv = 'dev' | 'prod';

type AnalyticsIdentifiers = {
  listingId?: string | number;
  unitCode?: string | number;
  listing?: string | number;
  route?: string;
};

export type AnalyticsEventPayload = {
  event: string;
  env: AnalyticsEnv;
  route?: string;
  timestamp: string;
} & AnalyticsIdentifiers & Record<string, unknown>;

type AnalyticsTransport = (payload: AnalyticsEventPayload) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const getEnv = (): AnalyticsEnv =>
  import.meta.env.MODE === 'production' ? 'prod' : 'dev';

const getGaMeasurementId = () => import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

/**
 * TASK-102427 — sanitize a host-entered GA4 measurement ID before it ever reaches
 * the DOM. Only the strict `G-XXXXXXXXXX` shape is accepted; anything carrying HTML
 * entities, quotes, angle brackets or URL metacharacters (the board's "escaped tag
 * breaks execution" class) is rejected to null. The injector below builds the script
 * via DOM APIs only — never innerHTML — so a rejected value can never execute.
 */
export function sanitizeGaMeasurementId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const id = raw.trim();
  return /^G-[A-Z0-9]{4,}$/.test(id) ? id : null;
}

const getCurrentRoute = () => {
  if (typeof window === 'undefined') return undefined;
  return window.location.pathname || '/';
};

const defaultTransport: AnalyticsTransport = (payload) => {
  if (getEnv() !== 'dev') return;

  const label = `[analytics:${payload.env}]`;
  if (typeof console !== 'undefined' && console.info) {
    console.info(label, payload);
  }
};

let transport: AnalyticsTransport = defaultTransport;
let gtagInitialized = false;
let activeMeasurementId: string | null = null;

const ensureGtag = (measurementId: string) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  if (!window.dataLayer) {
    window.dataLayer = [];
  }

  window.gtag = window.gtag || function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };

  if (!document.getElementById('gtag-js')) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.id = 'gtag-js';
    document.head.appendChild(script);
  }

  if (!gtagInitialized) {
    window.gtag('js', new Date());
    window.gtag('config', measurementId);
    gtagInitialized = true;
  }

  return true;
};

const createGtagTransport = (measurementId: string): AnalyticsTransport => (payload) => {
  const shouldLogToConsole = getEnv() === 'dev';

  if (shouldLogToConsole) {
    defaultTransport(payload);
  }

  if (!ensureGtag(measurementId)) return;

  const { event, env, timestamp, route, ...rest } = payload;
  const attributes = {
    event_category: env,
    event_label: route,
    page_location: route,
    event_time: timestamp,
    send_to: measurementId,
    ...rest,
  };

  window.gtag?.('event', event, attributes);
};

export const setAnalyticsTransport = (customTransport: AnalyticsTransport) => {
  transport = customTransport;
};

export const resetAnalyticsTransport = () => {
  transport = defaultTransport;
};

export const initAnalytics = () => {
  // DPDP Act §6: do not load non-essential analytics scripts until the user has accepted cookies.
  if (!hasAcceptedCookies()) return;
  if (transport !== defaultTransport) return;

  const measurementId = sanitizeGaMeasurementId(getGaMeasurementId());

  if (!measurementId) {
    return;
  }

  activeMeasurementId = measurementId;
  setAnalyticsTransport(createGtagTransport(measurementId));
};

/**
 * TASK-102427 — pick up a host-entered measurement ID from tenant resolution at
 * runtime (admin settings), falling back to the build-time env. Idempotent per ID:
 * repeat calls and route re-renders never inject a second gtag script. Must run
 * after the tenant is resolved (see src/main.tsx boot, next to applyTenantBranding).
 */
export const initTenantAnalytics = (tenantGaMeasurementId: unknown) => {
  if (!hasAcceptedCookies()) return;
  const measurementId =
    sanitizeGaMeasurementId(tenantGaMeasurementId) ?? sanitizeGaMeasurementId(getGaMeasurementId());
  if (!measurementId || measurementId === activeMeasurementId) return;
  activeMeasurementId = measurementId;
  setAnalyticsTransport(createGtagTransport(measurementId));
};

export const resetAnalyticsForTests = () => {
  activeMeasurementId = null;
  gtagInitialized = false;
  resetAnalyticsTransport();
};

const buildPayload = (
  event: string,
  payload: Record<string, unknown> = {},
  identifiers: AnalyticsIdentifiers = {},
): AnalyticsEventPayload => ({
  event,
  env: getEnv(),
  route: identifiers.route ?? getCurrentRoute(),
  timestamp: new Date().toISOString(),
  ...identifiers,
  ...payload,
});

export const trackEvent = (
  event: string,
  payload: Record<string, unknown> = {},
  identifiers: AnalyticsIdentifiers = {},
) => {
  const enrichedPayload = buildPayload(event, payload, identifiers);

  try {
    transport(enrichedPayload);
  } catch (error) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[analytics] transport failed', error);
      console.info('[analytics] fallback payload', enrichedPayload);
    }
  }

  return enrichedPayload;
};
