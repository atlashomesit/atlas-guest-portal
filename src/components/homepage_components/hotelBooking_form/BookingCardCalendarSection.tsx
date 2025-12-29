// BookingCardCalendarSection.tsx
import { Link } from 'react-router-dom';
import { format, startOfDay } from 'date-fns';
import { getIstStartOfDay } from '@/utils/date';
import { priceDisplayConfig } from '../../../config/priceDisplay.config';
import React, { useEffect, useId } from 'react';
import { AtlasDateRangePicker, type AtlasDateRangePickerValue } from '../../date/AtlasDateRangePicker';

interface BookingCardCalendarSectionProps {
  hasDiscountToShow: boolean;
  baseNightlyRate: number;
  averageNightlyRate: number;
  nightlySavings: number;
  discountPercentApplied: number;
  hasSpecialPricing: boolean;
  specialPricingLabel: string | null;
  priceBadgeClass: string;
  property: any;
  baseGuestAllowance: number;
  unitPolicy: any;
  fieldGridClass: string;
  fieldButtonClass: string;
  helperTextClass: string;
  nights: number;
  markEngagement: () => void;
  setOpenCalendar: React.Dispatch<React.SetStateAction<boolean>>;
  setOpenGuests: React.Dispatch<React.SetStateAction<boolean>>;
  setInlineStatus: React.Dispatch<React.SetStateAction<string>>;
  trackEvent: (...args: any[]) => void;
  propertyId: number;
  dates: { startDate: Date; endDate: Date; key: 'selection' };
  dateError: string | null;
  validationMessage: string;
  validationMessageId: string;
  setHasInteractedWithDates: React.Dispatch<React.SetStateAction<boolean>>;
  isCheckoutInvalid: boolean;
  dateErrorId: string;
  checkOutErrorId: string;
  hasInteractedWithDates: boolean;
  guestNeedsAdult: boolean;
  guestErrorId: string;
  formatGuestLabel: () => string;
  handleInlineCta: () => void;
  inlineCtaDisabled: boolean;
  isInlineChecking: boolean;
  inlineCtaLabel: string;
  inlineStatus: string;
  ctaConfirmation: string | null;
  openCalendar: boolean;
  calendarRef: React.RefObject<HTMLDivElement>;
  triggerRowRef: React.RefObject<HTMLDivElement>;
  isBookedDatesLoading: boolean;
  bookedDates: Date[];
  handleDateChange: (ranges: any) => void;
  calendarVisibleMonth: Date;
  onMonthYearChange: (date: Date) => void;
  isCalendarTransitioning: boolean;
  maxBookingDate: Date;
  minBookingDate: Date;
  ctaPrimaryColor: string;
  calendarRenderVersion?: string;
  setLastTriggerRef: (element: HTMLButtonElement | null) => void;
}

export const BookingCardCalendarSection: React.FC<BookingCardCalendarSectionProps> = ({
  hasDiscountToShow,
  baseNightlyRate,
  averageNightlyRate,
  nightlySavings,
  discountPercentApplied,
  hasSpecialPricing,
  specialPricingLabel,
  priceBadgeClass,
  property,
  baseGuestAllowance,
  unitPolicy,
  fieldGridClass,
  fieldButtonClass,
  helperTextClass,
  markEngagement,
  setOpenCalendar,
  setOpenGuests,
  setInlineStatus,
  trackEvent,
  propertyId,
  nights,
  dates,
  dateError,
  validationMessage,
  validationMessageId,
  setHasInteractedWithDates,
  isCheckoutInvalid,
  dateErrorId,
  checkOutErrorId,
  hasInteractedWithDates,
  guestNeedsAdult,
  guestErrorId,
  formatGuestLabel,
  handleInlineCta,
  inlineCtaDisabled,
  isInlineChecking,
  inlineCtaLabel,
  inlineStatus,
  ctaConfirmation,
  openCalendar,
  calendarRef,
  triggerRowRef,
  isBookedDatesLoading,
  bookedDates,
  handleDateChange,
  calendarVisibleMonth,
  onMonthYearChange,
  isCalendarTransitioning,
  maxBookingDate,
  minBookingDate,
  ctaPrimaryColor,
  calendarRenderVersion,
  setLastTriggerRef,
}) => {
  const todayStart = getIstStartOfDay();
  const minSelectableDate = minBookingDate < todayStart ? todayStart : minBookingDate;
  const hasDateIssue = Boolean(dateError) || isCheckoutInvalid;
  const dateFieldButtonClass = `${fieldButtonClass} ${hasDateIssue ? 'border-support-error ring-1 ring-support-error/40 focus-visible:outline-support-error' : ''}`;
  const nightLabel = nights === 1 ? '1 night' : `${nights} nights`;
  const loadingLabel = `Loading ${format(calendarVisibleMonth, 'MMMM yyyy')}...`;
  const calendarDialogLabelId = useId();
  const calendarContentId = useId();

  const disabledDay = (date: Date) => {
    const dateToCheck = getIstStartOfDay(date);
    const dateTime = dateToCheck.getTime();
    if (dateToCheck < minSelectableDate || dateToCheck > maxBookingDate) return true;

    return bookedDates.some((bookedDate) => {
      // bookedDate is already a Date object, normalize it directly
      const normalizedBooked = getIstStartOfDay(bookedDate instanceof Date ? bookedDate : new Date(bookedDate));
      return normalizedBooked.getTime() === dateTime;
    });
  };

  const renderDayContent = (date: Date) => {
    // Normalize dates to start of day for accurate comparison
    const dateToCheck = getIstStartOfDay(date);
    const dateToCheckTime = dateToCheck.getTime();

    const selectionStart = startOfDay(dates.startDate).getTime();
    const selectionEnd = startOfDay(dates.endDate).getTime();

    const isPastDate = dateToCheck < minSelectableDate;
    const isBeyondWindow = dateToCheck > maxBookingDate;
    const isBooked = bookedDates.some((bookedDate) => {
      // bookedDate is already a Date object, normalize it directly
      const normalizedBooked = getIstStartOfDay(bookedDate instanceof Date ? bookedDate : new Date(bookedDate));
      return normalizedBooked.getTime() === dateToCheckTime;
    });

    const selectionStartTime = Math.min(selectionStart, selectionEnd);
    const selectionEndTime = Math.max(selectionStart, selectionEnd);
    const isInSelectionRange =
      dateToCheckTime >= selectionStartTime && dateToCheckTime <= selectionEndTime && !isBooked && !isBeyondWindow;
    const isRangeStart = dateToCheckTime === selectionStart;
    const isRangeEnd = dateToCheckTime === selectionEnd;
    const isEdgeCaseSameDaySelection = selectionStart === selectionEnd;
    const isSpecialPricingDay = false;
    const isSelected = dateToCheckTime === selectionStartTime || dateToCheckTime === selectionEndTime;
    const selectionTreatment =
      isSelected && !isBooked
        ? 'bg-cta-primary text-[var(--text-contrast)] border-cta-primary shadow-sm ring-2 ring-[color:color-mix(in_srgb,var(--cta-secondary)_60%,transparent)]'
        : 'border-transparent bg-transparent';
    const dayTextColor = isInSelectionRange || isSelected ? 'text-[var(--text-contrast)]' : 'text-text-primary';
    const dayBackground = isSpecialPricingDay
      ? 'bg-[color:color-mix(in_srgb,var(--cta-secondary)_16%,transparent)]'
      : isInSelectionRange
      ? 'bg-cta-primary'
      : 'bg-transparent';
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        {isInSelectionRange && (
          <span
            className={`absolute inset-0 ${
              isEdgeCaseSameDaySelection
                ? 'rounded-full bg-cta-primary'
                : isRangeStart
                ? 'rounded-l-full bg-cta-primary'
                : isRangeEnd
                ? 'rounded-r-full bg-cta-primary'
                : dayBackground
            }`}
            aria-hidden
          />
        )}
        <span
          className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition ${selectionTreatment} ${dayTextColor} ${
            isBooked ? 'line-through' : ''
          } ${
            isPastDate
              ? 'opacity-30 line-through pointer-events-none'
              : ''
          } ${isBeyondWindow ? 'opacity-40 pointer-events-none' : ''}`}
          style={{ minHeight: 40, minWidth: 40 }}
        >
          {date.getDate()}
        </span>
      </div>
    );
  };

  const calendarOverlay = isCalendarTransitioning ? (
    <div className="absolute inset-0 bg-bg-surface/60 backdrop-blur-[1px] flex items-center justify-center">
      <div className="h-8 w-8 border-2 border-border-subtle border-t-cta-primary rounded-full animate-spin" aria-hidden />
      <span className="sr-only">{loadingLabel}</span>
      <span className="ml-3 text-xs font-semibold text-text-muted" aria-hidden>
        {loadingLabel}
      </span>
    </div>
  ) : null;

  const handlePickerChange = (selection: AtlasDateRangePickerValue) => {
    handleDateChange({
      selection: {
        startDate: selection.startDate ?? dates.startDate,
        endDate: selection.endDate ?? dates.endDate,
        key: 'selection',
      },
    });
  };

  const dateRangeProps: NonNullable<React.ComponentProps<typeof AtlasDateRangePicker>['dateRangeProps']> = {
    className: 'text-sm',
    monthDisplayFormat: 'MMMM yyyy',
    weekdayDisplayFormat: 'EEE',
    dayDisplayFormat: 'd',
    ariaLabels: {
      prevButton: 'Go to previous month',
      nextButton: 'Go to next month',
      monthPicker: 'Change displayed month',
      yearPicker: 'Change displayed year',
      dateInput: {
        selection: {
          startDate: 'Check-in date input',
          endDate: 'Check-out date input',
        },
      },
    },
  };
  useEffect(() => {
    if (!openCalendar || !calendarRef.current) return;

    const navButtons = calendarRef.current.querySelectorAll<HTMLButtonElement>('.rdrNextPrevButton');
    navButtons.forEach((button) => {
      button.setAttribute('aria-controls', calendarContentId);
      button.setAttribute('aria-expanded', 'true');
    });
  }, [calendarContentId, calendarRef, openCalendar]);

  return (
    <>
      <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-2">
            {hasDiscountToShow && (
              <span className="text-sm font-medium text-text-muted line-through">
                ₹{baseNightlyRate.toLocaleString('en-IN')}
              </span>
            )}
            <p className="text-[30px] font-bold text-cta-primary leading-none">
              ₹{averageNightlyRate.toLocaleString('en-IN')}
              <span className="text-base font-semibold ml-1 text-text-muted">/night</span>
            </p>
          </div>
          <p className="text-sm text-text-muted">
            {hasSpecialPricing
              ? 'Average nightly with special-day pricing'
              : 'Average nightly after discount'}
          </p>
          {hasDiscountToShow && nightlySavings > 0 && (
            <p className="text-xs font-semibold text-cta-primary">
              {priceDisplayConfig.discount.savingsPrefix} ₹
              {nightlySavings.toLocaleString('en-IN')} nightly
            </p>
          )}
          {hasDiscountToShow && (
            <p className="text-xs text-text-muted">
              {priceDisplayConfig.discount.reasonLabel} · Discount ({discountPercentApplied}%)
            </p>
          )}
          <p className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary" aria-live="polite">
            <span className="inline-flex h-6 min-w-[4rem] items-center justify-center rounded-full bg-bg-muted px-3 text-[11px] uppercase tracking-wide">
              {nightLabel}
            </span>
            <span className="sr-only">Stay length updated: {nightLabel}</span>
          </p>
        </div>
        {(hasSpecialPricing || hasDiscountToShow) && (
          <span className={`mt-1 ${priceBadgeClass}`}>
            {hasSpecialPricing
              ? specialPricingLabel || 'Special day pricing'
              : priceDisplayConfig.discount.primaryBadgeLabel ||
                priceDisplayConfig.discount.secondaryBadgeLabel}
          </span>
        )}
      </div>

      {property && (
        <div className="mb-4 space-y-1">
          <p className="text-cta-primary text-sm font-semibold">
            ★ {property.property_rating.toFixed(2)} ({property.property_reviews} reviews)
          </p>
          {property.property_review_snippets?.[0] && (
            <p className="text-sm text-text-primary italic">
              “{property.property_review_snippets[0]}”
            </p>
          )}
        </div>
      )}

      <div className="mb-4 space-y-1 text-sm text-text-primary">
        <p>
          Base price includes {baseGuestAllowance} guests; additional guests incur{' '}
          {unitPolicy.extraGuestFeeRange} per night (unit dependent).
          <a className="underline ml-1" href="/terms#guests">
            See terms
          </a>
        </p>
        <p>
          Check-in {unitPolicy.checkIn} · Check-out {unitPolicy.checkOut}.
          <a className="underline ml-1" href="/terms#check-in-check-out">
            Timings
          </a>
        </p>
      </div>

      <div className="relative mb-5 rounded-2xl border border-border-strong/60 bg-[color:color-mix(in_srgb,var(--bg-muted)_72%,var(--bg-surface))] shadow-inner">
        <div ref={triggerRowRef} className={`booking-card-grid ${fieldGridClass}`}>
          <button
            type="button"
            onClick={(event) => {
              setLastTriggerRef(event.currentTarget);
              markEngagement();
              setOpenCalendar(true);
              setOpenGuests(false);
              setInlineStatus('Choose your arrival date.');
              trackEvent(
                'booking_calendar_opened',
                { surface: 'booking_form', trigger: 'checkin' },
                { propertyId, listingId: propertyId, unitCode: propertyId },
              );
            }}
            className={dateFieldButtonClass}
            aria-label={`Select check-in date, currently ${format(dates.startDate, 'dd MMM yyyy')}`}
            aria-describedby={dateError ? dateErrorId : validationMessage ? validationMessageId : undefined}
            aria-invalid={hasDateIssue}
            aria-expanded={openCalendar}
            aria-controls={calendarContentId}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Check-in
            </span>
            <span className="mt-1 text-base font-semibold text-text-primary">
              {format(dates.startDate, 'dd-MM-yyyy')}
            </span>
            <span className={helperTextClass}>Update check-in without leaving the page.</span>
            {hasInteractedWithDates && dateError && (
              <span className="mt-1 text-xs font-semibold text-support-error" role="alert" id={dateErrorId}>
                {dateError}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={(event) => {
              setLastTriggerRef(event.currentTarget);
              markEngagement();
              setOpenCalendar(true);
              setOpenGuests(false);
              setHasInteractedWithDates(true);
              setInlineStatus('Pick a check-out date after check-in.');
              trackEvent(
                'booking_calendar_opened',
                { surface: 'booking_form', trigger: 'checkout' },
                { propertyId, listingId: propertyId, unitCode: propertyId },
              );
            }}
            className={dateFieldButtonClass}
            aria-label={`Select check-out date, currently ${format(dates.endDate, 'dd MMM yyyy')}`}
            aria-describedby={
              dateError ? dateErrorId : isCheckoutInvalid ? checkOutErrorId : validationMessage ? validationMessageId : undefined
            }
            aria-invalid={hasDateIssue}
            aria-expanded={openCalendar}
            aria-controls={calendarContentId}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Check-out
            </span>
            <span className="mt-1 text-base font-semibold text-text-primary">
              {format(dates.endDate, 'dd-MM-yyyy')}
            </span>
            {hasInteractedWithDates && (isCheckoutInvalid || dateError) && (
              <span
                className="mt-1 text-xs font-semibold text-support-error"
                role="alert"
                id={dateError ? dateErrorId : checkOutErrorId}
              >
                {dateError || 'Check-out must be at least 1 night after check-in.'}
              </span>
            )}
            <span className={helperTextClass}>Minimum one night; we’ll auto-fix overlaps.</span>
          </button>

          <button
            type="button"
            onClick={(event) => {
              setLastTriggerRef(event.currentTarget);
              markEngagement();
              setOpenGuests(true);
              setOpenCalendar(false);
              setInlineStatus('Adjust guests and add pets if needed.');
              trackEvent(
                'booking_guests_opened',
                { surface: 'booking_form', guests: undefined },
                { propertyId, listingId: propertyId, unitCode: propertyId },
              );
            }}
            className={fieldButtonClass}
            aria-label={`Select guests, currently ${formatGuestLabel()}`}
            aria-describedby={guestNeedsAdult ? guestErrorId : undefined}
            aria-invalid={guestNeedsAdult}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Guests
            </span>
            <span className="mt-1 text-base font-semibold text-text-primary">
              {formatGuestLabel()}
            </span>
            {guestNeedsAdult && (
              <span
                className="mt-1 text-xs font-semibold text-support-error"
                role="alert"
                id={guestErrorId}
              >
                Add at least one adult.
              </span>
            )}
            <span className={helperTextClass}>Adults must be present for every booking.</span>
          </button>

          <div className="flex h-full min-h-[4.5rem] flex-col justify-center gap-2">
            <button
              type="button"
              onClick={handleInlineCta}
              disabled={inlineCtaDisabled}
              className="flex min-h-[4.5rem] items-center justify-center rounded-xl bg-cta-primary px-4 text-base font-semibold text-[var(--text-contrast)] shadow-level2 transition hover:bg-cta-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isInlineChecking ? 'Checking availability…' : inlineCtaLabel}
            </button>
            <Link
              to="/#our-homes"
              className="text-center text-sm font-semibold text-text-primary underline-offset-4 hover:text-cta-secondary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta-secondary"
            >
              Browse listings
            </Link>
          </div>
        </div>
      </div>

      {(inlineStatus || ctaConfirmation) && (
        <p className="mt-2 text-sm font-semibold text-cta-primary" aria-live="polite">
          {inlineStatus || ctaConfirmation}
        </p>
      )}

      <AtlasDateRangePicker
        key={calendarRenderVersion ?? calendarVisibleMonth.toISOString()}
        anchorRef={triggerRowRef}
        calendarRef={calendarRef}
        contentId={calendarContentId}
        heading="Choose your stay dates"
        labelId={calendarDialogLabelId}
        loadingLabel={loadingLabel}
        onClose={() => setOpenCalendar(false)}
        open={openCalendar}
        value={{ startDate: dates.startDate, endDate: dates.endDate }}
        onChange={handlePickerChange}
        minDate={minSelectableDate}
        maxDate={maxBookingDate}
        disabledDates={bookedDates}
        disabledDay={disabledDay}
        months={1}
        shownDate={calendarVisibleMonth}
        onShownDateChange={(date) => onMonthYearChange(getIstStartOfDay(date))}
        rangeColors={[dateError ? 'var(--support-error, #ef4444)' : ctaPrimaryColor]}
        loading={isBookedDatesLoading}
        dayContentRenderer={renderDayContent}
        afterCalendar={calendarOverlay}
        dateRangeProps={dateRangeProps}
      />

      <style>{`
        .booking-calendar-popover .rdrDay:focus-visible,
        .booking-calendar-popover .rdrDayNumber span:focus-visible,
        .booking-calendar-popover .rdrNextPrevButton:focus-visible,
        .booking-calendar-popover select:focus-visible {
          outline: 2px solid var(--cta-primary);
          outline-offset: 2px;
          border-radius: 9999px;
        }
      `}</style>
    </>
  );
};