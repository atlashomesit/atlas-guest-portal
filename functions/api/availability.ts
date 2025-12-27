/*
 * Availability API handler
 * - Provides instrumentation (request logging, DB timing)
 * - Validates inputs & responds with clear errors
 * - Applies CORS safeguards
 * - Adds synthetic timeout guard for slow DB queries
 */

interface Env {
  AVAILABILITY_DB?: D1Database;
  ALLOWED_ORIGINS?: string;
  AVAILABILITY_DB_TIMEOUT_MS?: string;
}

type AvailabilityRow = {
  id: string;
  name?: string;
  max_guests?: number;
  available_from?: string;
  available_to?: string;
  nightly_rate?: number;
};

const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

const getCorsHeaders = (request: Request, allowedOrigins: string[]) => {
  const origin = request.headers.get('Origin');
  const normalizedOrigins = allowedOrigins.map((value) => value.trim()).filter(Boolean);
  const allowOrigin = origin && normalizedOrigins.includes(origin) ? origin : normalizedOrigins[0] ?? '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400',
  } satisfies Record<string, string>;
};

const parseLimit = (limitParam: string | null) => {
  const DEFAULT_LIMIT = 25;
  const MAX_LIMIT = 100;

  if (!limitParam) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(limitParam, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      onTimeout();
      reject(new Error('availability-query-timeout'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const validateParams = (params: URLSearchParams) => {
  const checkIn = params.get('checkIn');
  const checkOut = params.get('checkOut');
  const guestsRaw = params.get('guests');
  const limit = parseLimit(params.get('limit'));

  if (!checkIn || !checkOut || !guestsRaw) {
    return {
      error: true,
      response: jsonResponse(
        {
          message: 'Missing required query parameters',
          required: ['checkIn', 'checkOut', 'guests'],
        },
        400,
      ),
    } as const;
  }

  const guests = Number.parseInt(guestsRaw, 10);
  if (Number.isNaN(guests) || guests <= 0) {
    return {
      error: true,
      response: jsonResponse({ message: 'Invalid guests parameter; must be a positive integer' }, 400),
    } as const;
  }

  return { error: false, checkIn, checkOut, guests, limit } as const;
};

export const onRequestOptions = ({ request, env }: { request: Request; env: Env }) => {
  const corsHeaders = getCorsHeaders(request, env.ALLOWED_ORIGINS?.split(',') ?? ['*']);
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const start = performance.now();
  const requestId = crypto.randomUUID();
  const corsHeaders = getCorsHeaders(request, env.ALLOWED_ORIGINS?.split(',') ?? ['*']);
  const params = new URL(request.url).searchParams;

  console.log('[availability] incoming request', {
    requestId,
    method: request.method,
    url: request.url,
    origin: request.headers.get('Origin') || 'unknown',
    params: Object.fromEntries(params.entries()),
  });

  const validation = validateParams(params);
  if (validation.error) {
    return validation.response;
  }

  const { checkIn, checkOut, guests, limit } = validation;

  if (!env.AVAILABILITY_DB) {
    console.error('[availability] missing AVAILABILITY_DB binding', { requestId });
    return jsonResponse(
      { message: 'Availability database is not configured for this environment.' },
      500,
      corsHeaders,
    );
  }

  const timeoutMs = Number.parseInt(env.AVAILABILITY_DB_TIMEOUT_MS ?? '4500', 10);

  const query = env.AVAILABILITY_DB.prepare(
    `
    SELECT id, name, max_guests, available_from, available_to, nightly_rate
    FROM listings
    WHERE max_guests >= ?
      AND date(available_from) <= date(?)
      AND date(available_to) >= date(?)
    ORDER BY nightly_rate ASC, available_from ASC
    LIMIT ?
  `,
  )
    .bind(guests, checkIn, checkOut, limit)
    .all<AvailabilityRow>();

  try {
    const dbStart = performance.now();
    const result = await withTimeout(query, timeoutMs, () =>
      console.warn('[availability] query exceeded timeout threshold', { requestId, timeoutMs }),
    );
    const dbDuration = Math.round(performance.now() - dbStart);

    const payload = {
      data: result.results ?? [],
      meta: {
        requestId,
        queryDurationMs: dbDuration,
        totalDurationMs: Math.round(performance.now() - start),
        limit,
        guests,
      },
    };

    console.log('[availability] query complete', {
      requestId,
      rows: payload.data.length,
      queryDurationMs: dbDuration,
    });

    return jsonResponse(payload, 200, corsHeaders);
  } catch (error) {
    if (error instanceof Error && error.message === 'availability-query-timeout') {
      return jsonResponse(
        {
          message: 'Availability check timed out. Please try again in a moment.',
          requestId,
        },
        504,
        corsHeaders,
      );
    }

    console.error('[availability] query failed', { requestId, error });
    return jsonResponse(
      {
        message: 'Unable to fetch availability at this time.',
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
      corsHeaders,
    );
  }
};
