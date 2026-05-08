import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type BookingState = {
  propertyId: string | number | null;
  propertyName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
  /** Canonical `/homes/{propertySlug}/{listingId}` for returning from /reserve to pay (TASK-258). */
  listingDetailPath: string | null;
  /** While Razorpay checkout is open for a hold booking; used by AvailabilityCalendar (payment-in-progress UX). */
  paymentHoldBookingId: number | null;
  paymentHoldToken: string | null;
  /** ISO8601 UTC instant when the server-side hold window ends (aligned with `/bookings/{id}/payment-status`). */
  holdExpiresAt: string | null;
};

type BookingContextValue = {
  booking: BookingState;
  updateBooking: (updates: Partial<BookingState>) => void;
  setProperty: (propertyId: string | number | null, propertyName?: string | null) => void;

  setDates: (checkIn: string | null, checkOut: string | null) => void;
  setGuests: (guests: number) => void;
  pendingScrollTarget: string | null;
  setPendingScrollTarget: (target: string | null) => void;
};

const STORAGE_KEY = 'atlasHeroSearch';

const defaultState: BookingState = {
  propertyId: null,
  propertyName: null,
  checkIn: null,
  checkOut: null,
  guests: 2,
  listingDetailPath: null,
  paymentHoldBookingId: null,
  paymentHoldToken: null,
  holdExpiresAt: null,
};

// eslint-disable-next-line react-refresh/only-export-components -- context co-located with provider
export const BookingContext = createContext<BookingContextValue | undefined>(undefined);

const loadState = (): BookingState => {
  if (typeof window === 'undefined') return defaultState;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultState;

    const parsed = JSON.parse(saved) as Partial<BookingState>;

    return {
      propertyId: parsed.propertyId ?? null,
      propertyName: parsed.propertyName ?? null,
      checkIn: parsed.checkIn ?? null,
      checkOut: parsed.checkOut ?? null,
      guests: typeof parsed.guests === 'number' && parsed.guests > 0 ? parsed.guests : defaultState.guests,
      listingDetailPath:
        typeof parsed.listingDetailPath === 'string' && parsed.listingDetailPath.trim()
          ? parsed.listingDetailPath.trim()
          : null,
      paymentHoldBookingId: null,
      paymentHoldToken: null,
      holdExpiresAt: null,
    };
  } catch (error) {
    console.warn('[BookingContext] Failed to load persisted booking state', error);
    return defaultState;
  }
};

function persistedSlice(b: BookingState) {
  return {
    propertyId: b.propertyId,
    propertyName: b.propertyName,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    guests: b.guests,
    listingDetailPath: b.listingDetailPath,
  };
}

export const BookingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [booking, setBooking] = useState<BookingState>(loadState);
  const [pendingScrollTarget, setPendingScrollTarget] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedSlice(booking)));
    } catch (error) {
      console.warn('[BookingContext] Failed to persist booking state', error);
    }
  }, [booking]);

  const updateBooking = useCallback((updates: Partial<BookingState>) => {
    setBooking((prev) => ({
      ...prev,
      ...updates,
      guests: typeof updates.guests === 'number' ? Math.max(1, updates.guests) : prev.guests,
    }));
  }, []);

  const setProperty = useCallback(
    (propertyId: string | number | null, propertyName?: string | null) =>
      updateBooking({ propertyId, propertyName: propertyName ?? null }),
    [updateBooking],
  );
  const setDates = useCallback(
    (checkIn: string | null, checkOut: string | null) => updateBooking({ checkIn, checkOut }),
    [updateBooking],
  );
  const setGuests = useCallback((guests: number) => updateBooking({ guests }), [updateBooking]);

  const value = useMemo<BookingContextValue>(
    () => ({
      booking,
      pendingScrollTarget,
      setPendingScrollTarget,
      updateBooking,
      setProperty,
      setDates,
      setGuests,
    }),
    [booking, pendingScrollTarget, updateBooking, setProperty, setDates, setGuests],
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with context
export const useBooking = () => {
  const context = useContext(BookingContext);

  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }

  return context;
};
