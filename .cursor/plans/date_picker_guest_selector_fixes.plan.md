# Date Picker & Guest Selector Complete Overhaul Plan

## Overview
Fix all QA-reported defects across homepage search widget, individual listing booking widgets (101, 102, 201, 202, 301, 302, 501), and the shared BookingCard component.

## Affected Components

### Core Components
1. `src/components/date/AtlasDateRangePicker.tsx` - Shared date picker
2. `src/components/availability/SearchAvailabilityWidget.tsx` - Homepage search
3. `src/components/availability/UnitBookingWidget.tsx` - Individual listing bookings
4. `src/components/homepage_components/hotelBooking_form/BookingCard.tsx` - Full booking form
5. `src/components/homepage_components/hotelBooking_form/BookingCardCalendarSection.tsx` - Calendar section

### New Components to Create
6. `src/components/guest/GuestSelector.tsx` - Multi-type guest selector
7. `src/components/guest/GuestTypeCounter.tsx` - Individual guest type counter

---

## DEFECT #1: Fix Two-Step Date Selection Logic

### Current Issues
- Date picker closes after each click
- Cannot independently set check-in vs check-out
- Clicking any date resets the range
- User must reopen picker multiple times

### Solution Architecture

#### Phase 1A: Update SearchAvailabilityWidget.tsx
```typescript
// Add selection mode tracking
const [selectionMode, setSelectionMode] = useState<'idle' | 'selecting-checkout' | 'complete'>('idle');

// Modify handleRangeChange to respect selection mode
const handleRangeChange = (selection: AtlasDateRangePickerValue) => {
  const clickedDate = startOfDay(selection.startDate);
  
  // Mode: No dates selected yet
  if (!dateRange.startDate) {
    setDateRange({ startDate: clickedDate, endDate: null });
    setSelectionMode('selecting-checkout');
    // DON'T close calendar
    return;
  }
  
  // Mode: Check-in set, selecting check-out
  if (selectionMode === 'selecting-checkout') {
    if (clickedDate > dateRange.startDate) {
      setDateRange({ startDate: dateRange.startDate, endDate: clickedDate });
      setSelectionMode('complete');
      // Close calendar only after both dates selected
      setIsCalendarOpen(false);
    } else {
      // Clicked date before check-in, start over
      setDateRange({ startDate: clickedDate, endDate: null });
      setSelectionMode('selecting-checkout');
    }
    return;
  }
  
  // Mode: Both dates selected, clicking again starts over
  if (selectionMode === 'complete') {
    setDateRange({ startDate: clickedDate, endDate: null });
    setSelectionMode('selecting-checkout');
    setIsCalendarOpen(true);
  }
};
```

#### Phase 1B: Update AtlasDateRangePicker.tsx
- Remove `retainEndDateOnFirstSelection` from DateRange props (causes issues)
- Add `preventAutoClose` prop to component
- Pass selection state to parent via callback
- Add visual indicators for selection mode

#### Phase 1C: Apply same logic to UnitBookingWidget.tsx
- Mirror SearchAvailabilityWidget date selection logic
- Ensure consistent UX across all booking forms

---

## DEFECT #2: Comprehensive Guest Selector

### Current State
- Only simple +/- counter for total guests
- No breakdown by type

### New Component: GuestSelector.tsx

```typescript
export interface GuestCounts {
  adults: number;      // min 1, max property-specific
  children: number;    // min 0, max property-specific
  infants: number;     // min 0, max 5 (don't count toward occupancy)
  pets: number;        // min 0, max 3
}

interface GuestSelectorProps {
  value: GuestCounts;
  onChange: (value: GuestCounts) => void;
  maxOccupancy: number;
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
}

export const GuestSelector: React.FC<GuestSelectorProps> = ({ ... }) => {
  return (
    <Popover>
      <GuestTypeCounter 
        label="Adults"
        subtitle="Age 13+"
        value={value.adults}
        min={1}
        max={maxOccupancy}
        onIncrement={() => handleIncrement('adults')}
        onDecrement={() => handleDecrement('adults')}
      />
      <GuestTypeCounter 
        label="Children"
        subtitle="Age 2-12"
        value={value.children}
        min={0}
        max={Math.max(0, maxOccupancy - value.adults)}
        onIncrement={() => handleIncrement('children')}
        onDecrement={() => handleDecrement('children')}
      />
      <GuestTypeCounter 
        label="Infants"
        subtitle="Under 2"
        helperText="Don't count toward occupancy"
        value={value.infants}
        min={0}
        max={5}
        onIncrement={() => handleIncrement('infants')}
        onDecrement={() => handleDecrement('infants')}
      />
      <GuestTypeCounter 
        label="Pets"
        helperText="Additional fees may apply"
        value={value.pets}
        min={0}
        max={3}
        onIncrement={() => handleIncrement('pets')}
        onDecrement={() => handleDecrement('pets')}
      />
    </Popover>
  );
};
```

### Integration Steps
1. Replace simple guest counter in SearchAvailabilityWidget
2. Replace simple guest counter in UnitBookingWidget
3. Update BookingCard to use GuestSelector
4. Update booking context to store GuestCounts
5. Update API calls to send guest breakdown
6. Update pricing logic to handle guest types

---

## DEFECT #3: Fix Month Navigation

### Current Issue
- Clicking prev/next buttons closes picker
- Navigation doesn't work at all

### Solution: Update Month Navigation Handlers

```typescript
// In AtlasDateRangePicker or parent component managing shownDate
const handlePrevMonth = (e: React.MouseEvent) => {
  e.stopPropagation();  // Prevent picker close
  e.preventDefault();
  
  const prevMonth = new Date(shownDate);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  onShownDateChange?.(prevMonth);
};

const handleNextMonth = (e: React.MouseEvent) => {
  e.stopPropagation();  // Prevent picker close
  e.preventDefault();
  
  const nextMonth = new Date(shownDate);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  onShownDateChange?.(nextMonth);
};
```

### Add to DateRangePickerPopover Component
- Custom prev/next buttons that call these handlers
- Disable prev button if showing current month
- Show clear month/year label between buttons

---

## DEFECT #4: Visual Indicators

### Phase 4A: Selection State Indicators
Add CSS classes and conditional styling:

```typescript
const getDateClassName = (date: Date) => {
  const isStart = isSameDay(date, dateRange.startDate);
  const isEnd = isSameDay(date, dateRange.endDate);
  const isInRange = dateRange.startDate && dateRange.endDate && 
                    isWithinInterval(date, { start: dateRange.startDate, end: dateRange.endDate });
  
  return classNames({
    'date-start': isStart,
    'date-end': isEnd,
    'date-in-range': isInRange && !isStart && !isEnd,
    'date-awaiting-checkout': selectionMode === 'selecting-checkout' && isStart,
  });
};
```

### Phase 4B: Hover Preview
```typescript
const [hoverDate, setHoverDate] = useState<Date | null>(null);

// Show preview range when hovering
const previewNights = hoverDate && dateRange.startDate && !dateRange.endDate
  ? differenceInDays(hoverDate, dateRange.startDate)
  : null;
```

### CSS Additions
```css
.date-start {
  background: var(--cta-primary);
  color: var(--text-contrast);
  border-radius: 50%;
}

.date-end {
  background: var(--cta-primary);
  color: var(--text-contrast);
  border-radius: 50%;
}

.date-in-range {
  background: color-mix(in srgb, var(--cta-primary) 18%, transparent);
}

.date-awaiting-checkout {
  position: relative;
}

.date-awaiting-checkout::after {
  content: 'Start';
  font-size: 10px;
  position: absolute;
  bottom: 2px;
}
```

---

## DEFECT #5: Better Validation

### Add Validation Layer
```typescript
interface DateValidationResult {
  valid: boolean;
  error?: string;
  autoAdjusted?: boolean;
  adjustedCheckOut?: Date;
}

const validateDateRange = (
  checkIn: Date | null,
  checkOut: Date | null
): DateValidationResult => {
  if (!checkIn || !checkOut) {
    return { valid: false, error: 'Please select both check-in and check-out dates' };
  }
  
  if (checkOut <= checkIn) {
    // Auto-adjust to minimum 1 night
    return {
      valid: true,
      autoAdjusted: true,
      adjustedCheckOut: addDays(checkIn, 1),
      error: 'Minimum stay is 1 night. Check-out adjusted to next day.',
    };
  }
  
  const nights = differenceInDays(checkOut, checkIn);
  if (nights > 30) {
    return { valid: false, error: 'Maximum stay is 30 nights. Please select a shorter stay.' };
  }
  
  return { valid: true };
};
```

### Toast Notification Component
Create `src/components/ui/Toast.tsx` for validation messages

---

## DEFECT #6: Keyboard Accessibility

### Add Keyboard Handlers
```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  switch (e.key) {
    case 'Escape':
      setIsCalendarOpen(false);
      break;
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'ArrowUp':
    case 'ArrowDown':
      // Navigate between dates
      e.preventDefault();
      handleArrowNavigation(e.key);
      break;
    case 'Enter':
    case ' ':
      // Select focused date
      e.preventDefault();
      handleDateSelect(focusedDate);
      break;
  }
};
```

### ARIA Labels
```typescript
<button
  aria-label={`${format(date, 'MMMM d, yyyy')}${isStart ? ' Check-in' : ''}${isEnd ? ' Check-out' : ''}`}
  aria-pressed={isStart || isEnd}
  role="button"
  tabIndex={isDisabled ? -1 : 0}
/>
```

---

## DEFECT #7: Night Count Display

### Real-time Night Count
```typescript
// Display night count prominently
const nightCount = dateRange.startDate && dateRange.endDate
  ? differenceInDays(dateRange.endDate, dateRange.startDate)
  : null;

// In UI
{nightCount && (
  <div className="night-count-badge">
    {nightCount} {nightCount === 1 ? 'night' : 'nights'}
  </div>
)}

// Hover preview
{hoverNightCount && selectionMode === 'selecting-checkout' && (
  <div className="night-count-preview">
    {hoverNightCount} {hoverNightCount === 1 ? 'night' : 'nights'} (preview)
  </div>
)}
```

---

## Implementation Order

### Phase 1: Critical Fixes (Days 1-2)
1. ✅ Fix date auto-reset issue (DONE)
2. Fix two-step date selection logic
3. Prevent picker auto-close
4. Fix month navigation buttons

### Phase 2: Guest Selector (Days 3-4)
5. Create GuestSelector component
6. Create GuestTypeCounter component
7. Integrate into SearchAvailabilityWidget
8. Integrate into UnitBookingWidget
9. Integrate into BookingCard
10. Update booking context and API

### Phase 3: Visual & UX (Days 5-6)
11. Add visual state indicators
12. Implement hover preview
13. Add night count display
14. Better validation messages
15. Toast notifications

### Phase 4: Accessibility (Day 7)
16. Keyboard navigation
17. ARIA labels
18. Screen reader testing
19. Focus management

### Phase 5: Testing (Day 8)
20. E2E tests for all scenarios
21. Test all 7 properties (101, 102, 201, 202, 301, 302, 501)
22. Mobile testing
23. Cross-browser testing

---

## Files to Modify

### High Priority
- [ ] `src/components/availability/SearchAvailabilityWidget.tsx`
- [ ] `src/components/availability/UnitBookingWidget.tsx`
- [ ] `src/components/date/AtlasDateRangePicker.tsx`
- [ ] `src/components/homepage_components/hotelBooking_form/BookingCardCalendarSection.tsx`

### New Files to Create
- [ ] `src/components/guest/GuestSelector.tsx`
- [ ] `src/components/guest/GuestTypeCounter.tsx`
- [ ] `src/components/ui/Toast.tsx`
- [ ] `src/hooks/useDateSelection.ts` (custom hook for date logic)
- [ ] `src/hooks/useGuestSelection.ts` (custom hook for guest logic)

### Context Updates
- [ ] `src/contexts/BookingContext.tsx` - Add GuestCounts type

### Medium Priority
- [ ] `src/components/homepage_components/hotelBooking_form/BookingCard.tsx`

---

## Testing Checklist

### Date Picker Tests
- [ ] Select Jan 10-12 → verify 2 nights
- [ ] Select dates across month boundary (Jan 30 - Feb 1)
- [ ] Try same-day check-in/out → verify auto-adjustment
- [ ] Navigate months with prev/next → verify picker stays open
- [ ] Click date when range complete → verify starts new selection
- [ ] Hover over dates → verify preview night count

### Guest Selector Tests
- [ ] Select 2 adults, 1 child, 1 pet → verify summary
- [ ] Try to exceed max occupancy → verify validation
- [ ] Try to set adults to 0 → verify blocked at minimum 1
- [ ] Select 3 infants → verify doesn't count toward occupancy

### Individual Listings Tests
- [ ] Test on property 101 detail page
- [ ] Test on property 102 detail page
- [ ] Test on property 201 detail page
- [ ] Test on property 202 detail page
- [ ] Test on property 301 detail page
- [ ] Test on property 302 detail page
- [ ] Test on property 501 detail page

### Accessibility Tests
- [ ] Tab through all form elements
- [ ] Use arrow keys to navigate calendar
- [ ] Use Enter to select dates
- [ ] Screen reader announces selection changes
- [ ] Escape closes modals properly

---

## Success Criteria

✅ User can select any date range in exactly 2 clicks (check-in, then check-out)
✅ Date picker stays open until both dates selected
✅ Month navigation works without closing picker
✅ Guest selector shows breakdown by type (adults, children, infants, pets)
✅ Visual indicators clearly show selection state
✅ Hover shows preview night count
✅ Validation messages are clear and helpful
✅ Keyboard navigation works completely
✅ All 7 individual property booking widgets work identically
✅ Mobile UX is smooth and intuitive

