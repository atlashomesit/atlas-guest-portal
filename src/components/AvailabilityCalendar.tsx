import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { buildApiUrl, getApiHeaders } from '../api/client';
import { dedupedAvailabilityCalendarFetch } from '../api/availabilityCalendarClient';
import { messageFromApiResponse } from '../utils/serverErrorFromResponse';
import { useBooking } from '../contexts/BookingContext';

interface DayEntry {
  date: string; // yyyy-MM-dd
  status: 'available' | 'blocked' | 'booked' | 'turnover' | 'hold'; // TASK-4557: include 'hold'
}

interface Props {
  listingId: number | string;
  onDateSelect?: (date: string) => void;
}

interface PaymentStatusPollBody {
  status?: string;
  bookingStatus?: string;
  holdExpiresAtUtc?: string | null;
}

const PAYMENT_STATUS_POLL_MS = 30_000;

function formatYmd(d: Date): string {
  // Use LOCAL date parts (not toISOString, which is UTC). The grid cells below build keys from
  // local year/month/day, so a UTC slice shifts the from/to range by a day in IST (UTC+5:30) and
  // can make blocked/booked days fall outside the fetched window and render as "available".
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  r.setDate(1);
  return r;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstWeekday(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

function formatHoldCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function AvailabilityCalendar({ listingId, onDateSelect }: Props) {
  const { booking, updateBooking } = useBooking();
  const [calData, setCalData] = useState<Map<string, DayEntry['status']>>(new Map());
  const [loading, setLoading] = useState(true);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const holdBookingId = booking.paymentHoldBookingId;
  const holdToken = booking.paymentHoldToken;
  const holdExpiresAtIso = booking.holdExpiresAt;

  const holdActive =
    holdBookingId != null &&
    holdBookingId > 0 &&
    typeof holdToken === 'string' &&
    holdToken.trim().length > 0 &&
    typeof holdExpiresAtIso === 'string' &&
    holdExpiresAtIso.trim().length > 0;

  const clearPaymentHold = useCallback(() => {
    updateBooking({
      paymentHoldBookingId: null,
      paymentHoldToken: null,
      holdExpiresAt: null,
    });
  }, [updateBooking]);

  const remainingMs = useMemo(() => {
    if (!holdExpiresAtIso) return 0;
    const end = new Date(holdExpiresAtIso).getTime();
    if (Number.isNaN(end)) return 0;
    return end - nowTick;
  }, [holdExpiresAtIso, nowTick]);

  useEffect(() => {
    if (!holdActive) return undefined;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [holdActive]);

  useEffect(() => {
    if (!holdActive) return;
    if (remainingMs <= 0) clearPaymentHold();
  }, [holdActive, remainingMs, clearPaymentHold]);

  const pollPaymentStatus = useCallback(async () => {
    if (holdBookingId == null || holdBookingId <= 0 || !holdToken?.trim()) return;
    try {
      const url = buildApiUrl(
        `/bookings/${holdBookingId}/payment-status?t=${encodeURIComponent(holdToken.trim())}`,
      );
      const res = await fetch(url, {
        headers: { Accept: 'application/json', ...getApiHeaders() },
      });
      if (!res.ok) {
        if (res.status === 404) clearPaymentHold();
        return;
      }
      const body = (await res.json()) as PaymentStatusPollBody;
      const pay = String(body.status ?? '');
      if (pay === 'Paid' || pay === 'Failed') {
        clearPaymentHold();
        return;
      }
      const bst = String(body.bookingStatus ?? '').toLowerCase();
      if (bst && bst !== 'hold' && bst !== 'paymentpending') {
        clearPaymentHold();
        return;
      }
      if (typeof body.holdExpiresAtUtc === 'string' && body.holdExpiresAtUtc.trim()) {
        updateBooking({ holdExpiresAt: body.holdExpiresAtUtc.trim() });
      }
    } catch {
      /* non-fatal */
    }
  }, [holdBookingId, holdToken, clearPaymentHold, updateBooking]);

  useEffect(() => {
    if (!holdActive) return undefined;
    void pollPaymentStatus();
    const id = window.setInterval(() => void pollPaymentStatus(), PAYMENT_STATUS_POLL_MS);
    return () => window.clearInterval(id);
  }, [holdActive, pollPaymentStatus]);

  const { today, monthStart, fromStr, toStr } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = addMonths(start, 2);
    return {
      today: now,
      monthStart: start,
      fromStr: formatYmd(start),
      toStr: formatYmd(end),
    };
  }, []);

  useEffect(() => {
    if (!listingId) return;
    setLoading(true);
    const url = new URL(buildApiUrl(`/api/public/listings/${listingId}/availability-calendar`));
    url.searchParams.set('from', fromStr);
    url.searchParams.set('to', toStr);
    // TASK-2118: module-level dedup keeps this fetch shared across StrictMode
    // double-mount and across the sibling UnitBookingWidget for the same URL.
    dedupedAvailabilityCalendarFetch(url.toString(), { headers: getApiHeaders() })
      .then(async (r) => {
        if (!r.ok) {
          if (import.meta.env.DEV) {
            console.warn(`Availability calendar not available for listing ${listingId}:`, r.status);
          }
          throw new Error(await messageFromApiResponse(r));
        }
        return r.json();
      })
      .then((items: unknown) => {
        if (!Array.isArray(items)) return;
        const map = new Map<string, DayEntry['status']>();
        (items as DayEntry[]).forEach(({ date, status }) => map.set(date, status));
        setCalData(map);
      })
      .catch((error) => {
        if (import.meta.env.DEV) {
          console.warn('Failed to fetch availability calendar:', error);
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  const renderMonth = (monthOffset: number) => {
    const base = addMonths(monthStart, monthOffset);
    const year = base.getFullYear();
    const month = base.getMonth();
    const totalDays = daysInMonth(year, month);
    const startWd = firstWeekday(year, month);

    const cells: React.ReactNode[] = [];
    for (let i = 0; i < startWd; i++) {
      cells.push(<div key={`e-${i}`} />);
    }
    for (let d = 1; d <= totalDays; d++) {
      const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const status = loading ? 'loading' : (calData.get(ymd) ?? 'available');
      const cellDate = new Date(year, month, d);
      const isPast = cellDate < today;

      let bg = 'bg-white hover:bg-green-50 cursor-pointer border-green-200';
      let text = 'text-text-primary';
      let extra = '';

      if (loading) {
        bg = 'bg-bg-muted';
        text = 'text-transparent';
      } else if (isPast) {
        bg = 'bg-bg-muted cursor-default';
        text = 'text-gray-600';
      } else if (status === 'booked' || status === 'blocked' || status === 'hold') {
        // TASK-4557: hold dates styled unavailable like booked/blocked
        bg = 'bg-gray-100 cursor-not-allowed';
        text = 'text-gray-700 line-through';
        extra = '';
      } else if (status === 'turnover') {
        // Turnover day allows same-day check-in but should be visually distinct.
        bg = 'bg-amber-50 hover:bg-amber-100 cursor-pointer border-amber-300';
        text = 'text-amber-800';
      }

      const dayClickable =
        !holdActive && !isPast && (status === 'available' || status === 'turnover') && Boolean(onDateSelect);

      cells.push(
        <div
          key={ymd}
          role="button"
          tabIndex={dayClickable ? 0 : -1}
          onClick={() => {
            if (dayClickable) onDateSelect!(ymd);
          }}
          onKeyDown={(e) => {
            if (!dayClickable) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onDateSelect!(ymd);
            }
          }}
          title={
            holdActive
              ? 'Dates locked while payment completes'
              : isPast
                ? undefined
                : status === 'available' || status === 'turnover'
                  ? `Check in ${ymd}`
                  : 'Unavailable'
          }
          className={`flex items-center justify-center rounded-lg border text-xs font-medium h-8 ${bg} ${text} ${extra} ${
            holdActive ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          {d}
        </div>,
      );
    }

    return (
      <div key={`m-${monthOffset}`} className="flex-1 min-w-[180px]">
        <p className="text-sm font-semibold text-text-primary mb-2">
          {MONTH_NAMES[month]} {year}
        </p>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {DAY_LABELS.map((l) => (
            <div key={l} className="text-center text-xs text-text-muted font-medium py-0.5">
              {l}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells}
        </div>
      </div>
    );
  };

  const countdownLabel = holdActive ? formatHoldCountdown(remainingMs) : null;

  return (
    <div className="py-4 border-t border-border-subtle relative">
      {holdActive && countdownLabel && (
        <div
          className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          role="status"
          aria-live="polite"
          data-testid="availability-calendar-hold-banner"
        >
          <span className="font-semibold">On Hold - {countdownLabel} min</span>
          <span className="block text-xs text-amber-900/90 mt-0.5">Payment in progress. Calendar locked until checkout finishes or the hold expires.</span>
        </div>
      )}
      <h3 className="text-base font-semibold text-text-primary mb-3">Availability</h3>
      <div className={`relative flex flex-col sm:flex-row gap-6 ${holdActive ? 'pointer-events-none select-none' : ''}`}>
        {holdActive && (
          <div
            className="absolute inset-0 z-10 rounded-lg bg-bg-surface/40 backdrop-blur-[1px]"
            aria-hidden
            data-testid="availability-calendar-hold-overlay"
          />
        )}
        {renderMonth(0)}
        {renderMonth(1)}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-white border border-green-200" /> Available
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-amber-50 border border-amber-300" /> Turnover (check-in allowed)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-gray-100" /> Unavailable
        </span>
      </div>
    </div>
  );
}
