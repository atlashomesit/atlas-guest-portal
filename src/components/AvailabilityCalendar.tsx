import React, { useEffect, useState } from 'react';
import { buildApiUrl, getApiHeaders } from '../api/client';

interface DayEntry {
  date: string; // yyyy-MM-dd
  status: 'available' | 'blocked' | 'booked';
}

interface Props {
  listingId: number | string;
  onDateSelect?: (date: string) => void;
}

function formatYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
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

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function AvailabilityCalendar({ listingId, onDateSelect }: Props) {
  const [calData, setCalData] = useState<Map<string, DayEntry['status']>>(new Map());
  const [loading, setLoading] = useState(true);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = addMonths(monthStart, 2);
  const fromStr = formatYmd(monthStart);
  const toStr = formatYmd(monthEnd);

  useEffect(() => {
    if (!listingId) return;
    setLoading(true);
    const url = buildApiUrl(`/api/public/listings/${listingId}/availability-calendar?from=${fromStr}&to=${toStr}`);
    fetch(url, { headers: getApiHeaders() })
      .then((r) => {
        if (!r.ok) {
          if (import.meta.env.DEV) {
            console.warn(`Availability calendar not available for listing ${listingId}:`, r.status);
          }
          return Promise.reject(new Error(`API returned ${r.status}`));
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
  }, [listingId, fromStr, toStr]);

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
        bg = 'animate-pulse bg-bg-muted';
        text = 'text-transparent';
      } else if (isPast) {
        bg = 'bg-bg-muted cursor-default';
        text = 'text-text-muted opacity-50';
      } else if (status === 'booked' || status === 'blocked') {
        bg = 'bg-gray-100 cursor-not-allowed';
        text = 'text-text-muted line-through opacity-60';
        extra = '';
      }

      cells.push(
        <div
          key={ymd}
          onClick={() => {
            if (!isPast && status === 'available' && onDateSelect) {
              onDateSelect(ymd);
            }
          }}
          title={isPast ? undefined : status === 'available' ? `Check in ${ymd}` : `Unavailable`}
          className={`flex items-center justify-center rounded-lg border text-xs font-medium h-8 ${bg} ${text} ${extra}`}
        >
          {d}
        </div>
      );
    }

    return (
      <div key={`m-${monthOffset}`} className="flex-1 min-w-[180px]">
        <p className="text-sm font-semibold text-text-primary mb-2">{MONTH_NAMES[month]} {year}</p>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {DAY_LABELS.map((l) => (
            <div key={l} className="text-center text-xs text-text-muted font-medium py-0.5">{l}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells}
        </div>
      </div>
    );
  };

  return (
    <div className="py-4 border-t border-border-subtle">
      <h3 className="text-base font-semibold text-text-primary mb-3">Availability</h3>
      <div className="flex flex-col sm:flex-row gap-6">
        {renderMonth(0)}
        {renderMonth(1)}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-white border border-green-200" /> Available</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-gray-100" /> Unavailable</span>
      </div>
    </div>
  );
}
