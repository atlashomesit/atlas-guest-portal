import { useRef, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';
import { AtlasDateRangePicker } from '../../date/AtlasDateRangePicker';
import { getIstCalendarDate, startOfCalendarDay, toCalendarISO } from '../../../utils/date';

const parseIsoDate = (value: string | null): Date | null => {
  if (!value) return null;
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  return getIstCalendarDate(instant);
};

export const DesktopSearchPillGroup = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const checkIn = searchParams.get('checkIn');
  const checkOut = searchParams.get('checkOut');
  const destination = searchParams.get('city') ?? searchParams.get('destination');
  
  const startDate = parseIsoDate(checkIn);
  const endDate = parseIsoDate(checkOut);
  
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [activeDateField, setActiveDateField] = useState<'checkin'|'checkout'|null>(null);
  const datesRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  const today = useMemo(() => getIstCalendarDate(), []);
  
  const handleRangeChange = (selection: any) => {
    const start = selection.startDate ? startOfCalendarDay(selection.startDate) : null;
    const end = selection.endDate ? startOfCalendarDay(selection.endDate) : null;
    
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (start) next.set('checkIn', toCalendarISO(start));
      else next.delete('checkIn');
      
      if (end) next.set('checkOut', toCalendarISO(end));
      else next.delete('checkOut');
      
      return next;
    }, { replace: true });

    if (start && end && end > start) {
      setIsCalendarOpen(false);
      setActiveDateField(null);
    }
  };

  const formattedDates = (startDate && endDate) 
    ? `${format(startDate, 'E, MMM d')} – ${format(endDate, 'E, MMM d')}`
    : 'Add dates';
    
  const whereLabel = destination ? destination : 'Search stays';

  return (
    <div className="flex items-center gap-2" data-testid="desktop-search-pill-group">
      {/* Where to Pill */}
      <Link to="/search" className="navbar-search-pill" style={{ minWidth: 'auto', maxWidth: '240px', padding: '0.45rem 1rem' }}>
        <span className="navbar-search-pill__label">Where to?</span>
        <span className="navbar-search-pill__hint truncate w-full inline-block">{whereLabel}</span>
      </Link>
      
      {/* Dates Pill */}
      <div className="relative" ref={datesRef}>
        <button
          type="button"
          className="navbar-search-pill text-left"
          style={{ minWidth: 'auto', padding: '0.45rem 1rem' }}
          onClick={() => setIsCalendarOpen(o => !o)}
          data-testid="navbar-dates-pill"
        >
          <span className="navbar-search-pill__label flex items-center gap-1.5">
            <Calendar size={14} strokeWidth={2.5} />
            Dates
          </span>
          <span className="navbar-search-pill__hint">{formattedDates}</span>
        </button>
        
        <AtlasDateRangePicker
          anchorRef={datesRef}
          calendarRef={calendarRef}
          open={isCalendarOpen}
          onClose={() => setIsCalendarOpen(false)}
          value={{ startDate, endDate }}
          onChange={handleRangeChange}
          minDate={today}
          disabledDay={(d) => startOfCalendarDay(d) < today}
          activeField={activeDateField}
        />
      </div>
    </div>
  );
};
