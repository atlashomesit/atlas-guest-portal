import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type BookingState = {
  propertyId: string | number | null;
  propertyName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
};

type BookingContextValue = {
  booking: BookingState;
  updateBooking: (updates: Partial<BookingState>) => void;
setProperty: (
  propertyId: string | number | null,
  propertyName?: string | null
) => void;

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
    };
  } catch (error) {
    console.warn('[BookingContext] Failed to load persisted booking state', error);
    return defaultState;
  }
};

export const BookingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [booking, setBooking] = useState<BookingState>(loadState);
  const [pendingScrollTarget, setPendingScrollTarget] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(booking));
    } catch (error) {
      console.warn('[BookingContext] Failed to persist booking state', error);
    }
  }, [booking]);
  useEffect(() => {
 
}, [booking]);

  const updateBooking = useCallback((updates: Partial<BookingState>) => {
        setBooking((prev) => ({
      ...prev,
      ...updates,
      guests: typeof updates.guests === 'number' ? Math.max(1, updates.guests) : prev.guests,
    }));
  }, []);

  const value = useMemo<BookingContextValue>(() => ({
    booking,
    pendingScrollTarget,
    setPendingScrollTarget,
    updateBooking,
setProperty: (propertyId, propertyName) =>
  updateBooking({ propertyId, propertyName }),

    setDates: (checkIn, checkOut) => updateBooking({ checkIn, checkOut }),
    setGuests: (guests) => updateBooking({ guests }),
  }), [booking, pendingScrollTarget, updateBooking]);

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
