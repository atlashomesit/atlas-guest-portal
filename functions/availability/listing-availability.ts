interface Env {
  AVAILABILITY_DB?: D1Database;
  ALLOWED_ORIGINS?: string;
  AVAILABILITY_DB_TIMEOUT_MS?: string;
}

type AvailabilityRow = {
  date: string;
  inventory?: number | null;
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

const parseDateParam = (value: string | null) => {
  if (!value) return null;
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const parsed = new Date(`${normalized}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const buildDateRange = (start: Date, end: Date) => {
  const days: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    days.push(toIsoDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return days;
};

export const onRequestOptions = ({ request, env }: { request: Request; env: Env }) => {
  const corsHeaders = getCorsHeaders(request, env.ALLOWED_ORIGINS?.split(',') ?? ['*']);
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const requestId = crypto.randomUUID();
  const corsHeaders = getCorsHeaders(request, env.ALLOWED_ORIGINS?.split(',') ?? ['*']);
  const params = new URL(request.url).searchParams;

  const listingId = params.get('listingId')?.trim();
  const startDate = parseDateParam(params.get('startDate'));
  const endDate = parseDateParam(params.get('endDate'));

  if (!listingId || !startDate || !endDate) {
    return jsonResponse(
      {
        message: 'Missing required query parameters.',
        required: ['listingId', 'startDate', 'endDate'],
      },
      400,
      corsHeaders,
    );
  }

  if (endDate < startDate) {
    return jsonResponse({ message: 'endDate must be on or after startDate.' }, 400, corsHeaders);
  }

  if (!env.AVAILABILITY_DB) {
    return jsonResponse(
      { message: 'Availability database is not configured for this environment.' },
      500,
      corsHeaders,
    );
  }

  const timeoutMs = Number.parseInt(env.AVAILABILITY_DB_TIMEOUT_MS ?? '4500', 10);

  const query = env.AVAILABILITY_DB.prepare(
    `
      SELECT date, inventory
      FROM listing_availability
      WHERE listing_id = ?
        AND date(date) >= date(?)
        AND date(date) <= date(?)
      ORDER BY date ASC
    `,
  )
    .bind(listingId, toIsoDate(startDate), toIsoDate(endDate))
    .all<AvailabilityRow>();

  try {
    const result = await withTimeout(query, timeoutMs, () =>
      console.warn('[listing-availability] query exceeded timeout threshold', { requestId, timeoutMs }),
    );

    const inventoryByDate = new Map(
      (result.results ?? []).map((row) => [toIsoDate(new Date(`${row.date}T00:00:00Z`)), row.inventory ?? 0]),
    );

    const dates = buildDateRange(startDate, endDate).map((date) => {
      const inventory = inventoryByDate.get(date) ?? 1;
      return {
        date,
        inventory,
        available: inventory > 0,
      };
    });

    return jsonResponse(
      {
        listingId,
        startDate: toIsoDate(startDate),
        endDate: toIsoDate(endDate),
        dates,
      },
      200,
      corsHeaders,
    );
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

    console.error('[listing-availability] query failed', { requestId, error });
    return jsonResponse(
      {
        message: 'Unable to fetch listing availability at this time.',
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
      corsHeaders,
    );
  }
};
