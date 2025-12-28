import React, { useEffect, useMemo, useState } from 'react';

import { AvailabilityWidgetMode, BookingWindow, computeBlockedDates } from '@/be/availabilityCalendar';

export interface AvailabilityWidgetProps {
  mode: AvailabilityWidgetMode;
  listingId?: string | number;
  fetchBookings?: (listingId: string) => Promise<BookingWindow[]>;
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
          <li key={date.toISOString()}>{date.toISOString().slice(0, 10)}</li>
        ))}
      </ul>
    </div>
  );
};

const normalizeListingId = (listingId?: string | number) =>
  listingId != null ? String(listingId) : undefined;

const useBlockedDates = (
  mode: AvailabilityWidgetMode,
  listingId: string | undefined,
  fetchBookings: (listingId: string) => Promise<BookingWindow[]>,
  today?: Date,
) => {
  const [blockedDates, setBlockedDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(mode === 'unit');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'search') {
      setBlockedDates([]);
      setLoading(false);
      return;
    }

    if (!listingId) {
      setError('Unit availability requires a listingId.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchBookings(listingId)
      .then((bookings) => {
        if (cancelled) return;
        setBlockedDates(computeBlockedDates(bookings, today));
      })
      .catch((fetchError) => {
        if (cancelled) return;
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load bookings');
        setBlockedDates([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchBookings, listingId, mode, today]);

  return { blockedDates, loading, error };
};

const defaultFetchBookings = async (listingId: string): Promise<BookingWindow[]> => {
  const response = await fetch(`/api/listings/${listingId}/bookings`);
  if (!response.ok) throw new Error('Unable to load bookings');
  return response.json();
};

export const AvailabilityWidget: React.FC<AvailabilityWidgetProps> = ({
  fetchBookings = defaultFetchBookings,
  listingId: rawListingId,
  mode,
  today,
}) => {
  const listingId = useMemo(() => normalizeListingId(rawListingId), [rawListingId]);

  if (mode === 'search' && listingId) {
    throw new Error('Search availability should not be provided a listingId.');
  }

  if (mode === 'unit' && !listingId) {
    throw new Error('Unit availability requires a listingId.');
  }

  const { blockedDates, error, loading } = useBlockedDates(mode, listingId, fetchBookings, today);

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
