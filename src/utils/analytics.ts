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

const getEnv = (): AnalyticsEnv =>
  import.meta.env.MODE === 'production' ? 'prod' : 'dev';

const getCurrentRoute = () => {
  if (typeof window === 'undefined') return undefined;
  return window.location.pathname || '/';
};

const defaultTransport: AnalyticsTransport = (payload) => {
  const label = `[analytics:${payload.env}]`;
  if (typeof console !== 'undefined' && console.info) {
    console.info(label, payload);
  }
};

let transport: AnalyticsTransport = defaultTransport;

export const setAnalyticsTransport = (customTransport: AnalyticsTransport) => {
  transport = customTransport;
};

export const resetAnalyticsTransport = () => {
  transport = defaultTransport;
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
