const API_HOST_PATTERN = /(?:atlas-homes-api-[^.]+\.azurewebsites\.net|api\.atlaspms\.in)/i;
const DEFAULT_TIMEOUT_MS = 20000;

export type MonitoringBreadcrumb = {
  action: string;
  data?: Record<string, unknown>;
  timestamp: string;
};

export type MonitoringContext = Record<string, unknown> & {
  tags?: Record<string, string>;
};

export type ApiErrorContext = MonitoringContext & {
  url: string;
  status?: number;
  method?: string;
  requestName?: string;
  responseSnippet?: string;
  durationMs?: number;
  category?: 'cors' | 'timeout' | 'network' | 'http' | 'unknown';
};

type DsnDetails = {
  protocol: string;
  host: string;
  projectId: string;
  publicKey: string;
  path?: string;
};

type MonitoringLevel = 'error' | 'warning' | 'info';

type SentryPayload = {
  event_id: string;
  message: string;
  platform: 'javascript';
  environment: string;
  level: MonitoringLevel;
  timestamp: string;
  exception?: {
    values: Array<{ type: string; value: string; stacktrace?: { frames: Array<{ filename?: string; function?: string; lineno?: number }> } }>;
  };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  breadcrumbs?: { timestamp: number; message: string; data?: Record<string, unknown> }[];
};

const breadcrumbs: MonitoringBreadcrumb[] = [];

const monitoringState: {
  initialized: boolean;
  enabled: boolean;
  parsedDsn: DsnDetails | null;
} = {
  initialized: false,
  enabled: false,
  parsedDsn: null,
};

const toSafeString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const createEventId = (): string => {
  const randomId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  return randomId.replace(/-/g, '').slice(0, 32).padEnd(32, '0');
};

const parseDsn = (dsn: string): DsnDetails | null => {
  try {
    const url = new URL(dsn);
    const pathParts = url.pathname.replace(/^\//, '').split('/').filter(Boolean);
    const projectId = pathParts.pop();
    if (!projectId || !url.username) return null;

    const path = pathParts.length ? `/${pathParts.join('/')}` : '';
    return {
      protocol: url.protocol,
      host: url.host,
      projectId,
      publicKey: url.username,
      path,
    };
  } catch {
    return null;
  }
};

const recordBreadcrumb = (action: string, data?: Record<string, unknown>) => {
  const entry: MonitoringBreadcrumb = { action, data, timestamp: new Date().toISOString() };
  breadcrumbs.push(entry);
  if (breadcrumbs.length > 25) {
    breadcrumbs.shift();
  }
};

const mapBreadcrumbs = () =>
  breadcrumbs.map((crumb) => ({
    timestamp: Date.parse(crumb.timestamp) / 1000,
    message: crumb.action,
    data: crumb.data,
  }));

const sendToSentry = async (payload: SentryPayload) => {
  if (!monitoringState.enabled || !monitoringState.parsedDsn || typeof fetch === 'undefined') return;
  const { protocol, host, projectId, publicKey, path } = monitoringState.parsedDsn;
  const endpoint = `${protocol}//${host}${path ?? ''}/api/${projectId}/store/`;
  const authHeader = `Sentry sentry_version=7, sentry_client=atlas-guest-portal/1.0, sentry_key=${publicKey}`;

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': authHeader,
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (networkError) {
    console.warn('[monitoring] Failed to send payload to Sentry', networkError);
  }
};

const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) return error;
  return new Error(toSafeString(error));
};

export const initMonitoring = () => {
  if (monitoringState.initialized) return;
  monitoringState.initialized = true;

  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  const parsed = dsn ? parseDsn(dsn) : null;
  monitoringState.parsedDsn = parsed;
  monitoringState.enabled = Boolean(parsed);

  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      if (event.message) {
        reportError(event.error ?? new Error(event.message), {
          tags: { boundary: 'global' },
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      }
    });

    window.addEventListener('unhandledrejection', (event) => {
      reportError(event.reason ?? new Error('Unhandled promise rejection'), { tags: { boundary: 'promise' } });
    });
  }
};

const buildPayload = (message: string, level: MonitoringLevel, error?: Error, context?: MonitoringContext): SentryPayload => ({
  event_id: createEventId(),
  message,
  platform: 'javascript',
  environment: import.meta.env.MODE,
  level,
  timestamp: new Date().toISOString(),
  exception: error
    ? {
        values: [
          {
            type: error.name || 'Error',
            value: error.message,
          },
        ],
      }
    : undefined,
  tags: context?.tags,
  extra: context,
  breadcrumbs: mapBreadcrumbs(),
});

// Hardening for BUG-ONBOARD-1 (incident 2026-05-02): errors reach Sentry when DSN is set. See atlas-e2e/docs/incidents/2026-05-02-property-registration-failure.md
export const reportError = (error: unknown, context?: MonitoringContext & { level?: MonitoringLevel }) => {
  const normalizedError = normalizeError(error);
  const level = context?.level ?? 'error';
  const details = { ...context } as MonitoringContext;
  if (details.tags) {
    details.tags = { ...details.tags };
  }

  console.error('[monitoring] error', normalizedError, details);
  const payload = buildPayload(normalizedError.message, level, normalizedError, details);
  void sendToSentry(payload);
};

export const reportMessage = (message: string, level: MonitoringLevel = 'info', context?: MonitoringContext) => {
  console.info(`[monitoring] ${level}`, message, context);
  const payload = buildPayload(message, level, undefined, context);
  void sendToSentry(payload);
};

export const logUserAction = (action: string, data?: Record<string, unknown>) => {
  console.info('[user-action]', action, data ?? {});
  recordBreadcrumb(action, data);
};

export const logApiError = (error: unknown, context: ApiErrorContext) => {
  const normalizedError = normalizeError(error);
  const { status } = context;
  const level: MonitoringLevel = status && status >= 500 ? 'error' : 'warning';
  const shouldReport = monitoringState.enabled || API_HOST_PATTERN.test(context.url);
  const message = context.category === 'timeout'
    ? 'Network timeout while contacting API'
    : context.category === 'cors'
      ? 'CORS or network error while contacting API'
      : `API request failed${status ? ` with status ${status}` : ''}`;

  console.error('[api-error]', message, { ...context, error: normalizedError.message });
  recordBreadcrumb('api_error', { url: context.url, status: context.status, category: context.category });

  if (shouldReport) {
    const host = (() => {
      try {
        const base = typeof window !== 'undefined' ? window.location.origin : 'https://atlas-dev.invalid';
        return new URL(context.url, base).host;
      } catch {
        return 'unknown-host';
      }
    })();

    reportError(normalizedError, {
      ...context,
      level,
      tags: {
        ...context.tags,
        host,
        category: context.category ?? 'http',
      },
    });
  }
};

export type MonitoredRequestInit = RequestInit & { timeoutMs?: number; requestName?: string };

export const monitoredFetch = async (url: string, init?: MonitoredRequestInit): Promise<Response> => {
  const now = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now();
  const start = now();
  const controller = new AbortController();
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const signals = [init?.signal, controller.signal].filter(Boolean) as AbortSignal[];
  // AbortSignal.any() is not yet in all TypeScript definitions
  const AbortSignalAny = AbortSignal as typeof AbortSignal & { any?: (signals: AbortSignal[]) => AbortSignal };
  const signal = signals.length > 1 && typeof AbortSignalAny.any === 'function'
    ? AbortSignalAny.any(signals)
    : signals[0];
  const timer = typeof setTimeout !== 'undefined'
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const response = await fetch(url, { ...init, signal });
    const durationMs = now() - start;

    if (!response.ok) {
      const snippet = await response.clone().text().catch(() => '');
      logApiError(new Error(`HTTP ${response.status}`), {
        ...contextFromRequest(url, init),
        status: response.status,
        responseSnippet: snippet.slice(0, 200),
        durationMs,
        category: 'http',
      });
    }

    return response;
  } catch (error) {
    const durationMs = now() - start;
    if (error instanceof DOMException && error.name === 'AbortError') {
      logApiError(error, {
        ...contextFromRequest(url, init),
        durationMs,
        category: 'timeout',
      });
      throw new Error('Request timed out. Please retry in a moment.');
    }

    const category: ApiErrorContext['category'] = error instanceof TypeError ? 'cors' : 'network';
    logApiError(error, { ...contextFromRequest(url, init), durationMs, category });
    throw new Error('We could not reach the server. Please check your connection and try again.');
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const contextFromRequest = (url: string, init?: MonitoredRequestInit): ApiErrorContext => ({
  url,
  method: init?.method ?? 'GET',
  requestName: init?.requestName,
});

export const isAtlasApiRequest = (url: string) => API_HOST_PATTERN.test(url);
