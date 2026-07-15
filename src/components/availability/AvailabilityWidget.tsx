import React, { useContext, useEffect, useMemo, useState } from 'react';
import { addDays } from 'date-fns';

import { fetchAvailability, type AvailabilityNightlyRate, type AvailabilityRequestParams, type AvailabilityResponse } from '@/api/availabilityClient';
import { AvailabilityWidgetMode } from '@/be/availabilityCalendar';
import { BookingContext } from '@/contexts/BookingContext';
import { getIstStartOfDay } from '@/utils/date';
import { parseISODate, toISODate } from '@/utils/dateRange';

export interface AvailabilityWidgetProps {
  mode: AvailabilityWidgetMode;
  listingId?: string | number;
  propertyId?: string | number;
  fetchAvailability?: (params: AvailabilityRequestParams) => Promise<AvailabilityResponse>;
  today?: Date;
}

interface AvailabilityCalendarViewProps {
  mode: AvailabilityWidgetMode;
  blockedDates: Date[];
  loading: boolean;
  error: string | null;
}

const AvailabilityCalendarView: React.FC<AvailabilityCalendarViewProps> = ({
  mode,
  blockedDates,
  error,
  loading,
}) => {
  return (
    <div aria-busy={loading} aria-live="polite">
      <h3>{mode === 'search' ? 'Search availability' : 'Unit availability'}</h3>
      {error ? <div role="alert">{error}</div> : null}
      {loading ? <p>Loading availability…</p> : null}
      <ul data-testid="blocked-date-list">
        {blockedDates.map((date) => (
          <li key={date.toISOString()}>{toISODate(date)}</li>
        ))}
      </ul>
    </div>
  );
};

const normalizeListingId = (listingId?: string | number) => {
  if (listingId == null) return undefined;
  const normalized = String(listingId).trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
};

const resolveNightlyRates = (
  response: AvailabilityResponse,
  normalizedTarget: string,
): AvailabilityNightlyRate[] => {
  if (response.nightlyRates) {
    return response.nightlyRates;
  }

  const listing = response.listings?.find((entry) => {
    const candidate = entry.propertyId ?? entry.listingId ?? entry.id;
    return normalizeListingId(candidate) === normalizedTarget;
  });

  return listing?.nightlyRates ?? [];
};

const extractBlockedDates = (nightlyRates: AvailabilityNightlyRate[]): Date[] => {
  const blockedSet = new Map<string, Date>();
  nightlyRates
    .filter((rate) => !rate.isAvailable)
    .map((rate) => getIstStartOfDay(parseISODate(rate.date)))
    .forEach((date) => {
      blockedSet.set(toISODate(date), date);
    });

  return Array.from(blockedSet.values()).sort((a, b) => a.getTime() - b.getTime());
};

const useBlockedDates = (
  mode: AvailabilityWidgetMode,
  propertyId: string | undefined,
  guests: number,
  fetchAvailabilityClient: (params: AvailabilityRequestParams) => Promise<AvailabilityResponse>,
  today?: Date,
) => {
  const [blockedDates, setBlockedDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(mode === 'unit');
  const [error, setError] = useState<string | null>(null);
  const availabilityRange = useMemo(() => {
    const startDate = getIstStartOfDay(today ?? new Date());
    return { startDate, endDate: addDays(startDate, 60) };
  }, [today]);

  useEffect(() => {
    if (mode === 'search') {
      setBlockedDates([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (!propertyId) {
      setError('Unit availability requires a propertyId.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    setLoading(true);
    setError(null);

    fetchAvailabilityClient({
      propertyId,
      checkIn: toISODate(availabilityRange.startDate),
      checkOut: toISODate(availabilityRange.endDate),
      guests,
      signal: controller?.signal,
    })
      .then((response) => {
        if (cancelled) return;
        const nightlyRates = resolveNightlyRates(response, propertyId);
        setBlockedDates(extractBlockedDates(nightlyRates));
      })
      .catch((fetchError) => {
        if (cancelled) return;
        setError(
          fetchError instanceof Error && fetchError.message
            ? fetchError.message
            : 'Could not load availability. Please refresh.',
        );
        setBlockedDates([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
      controller?.abort();
    };
  }, [availabilityRange, fetchAvailabilityClient, guests, mode, propertyId, today]);

  return { blockedDates, loading, error };
};

const defaultFetchAvailability = async (params: AvailabilityRequestParams): Promise<AvailabilityResponse> =>
  fetchAvailability(params);

export const AvailabilityWidget: React.FC<AvailabilityWidgetProps> = ({
  fetchAvailability: fetchAvailabilityProp,
  listingId: rawListingId,
  propertyId: rawPropertyId,
  mode,
  today,
}) => {
  const bookingContext = useContext(BookingContext);
  const guests = bookingContext?.booking?.guests ?? 1;
  const propertyId = useMemo(
    () => normalizeListingId(rawPropertyId ?? rawListingId),
    [rawListingId, rawPropertyId],
  );
  const fetchAvailabilityClient = fetchAvailabilityProp ?? defaultFetchAvailability;

  if (mode === 'search' && propertyId) {
    throw new Error('Search availability should not be provided a propertyId.');
  }

  if (mode === 'unit' && !propertyId) {
    throw new Error('Unit availability requires a propertyId.');
  }

  const { blockedDates, error, loading } = useBlockedDates(
    mode,
    propertyId,
    guests,
    fetchAvailabilityClient,
    today,
  );

  return (
    <AvailabilityCalendarView
      blockedDates={blockedDates}
      error={error}
      loading={loading}
      mode={mode}
    />
  );
};

export const SearchAvailabilityWidget: React.FC<Omit<AvailabilityWidgetProps, 'mode'>> = (props) => (
  <AvailabilityWidget {...props} mode="search" />
);

export const UnitBookingWidget: React.FC<Omit<AvailabilityWidgetProps, 'mode'>> = (props) => (
  <AvailabilityWidget {...props} mode="unit" />
);
