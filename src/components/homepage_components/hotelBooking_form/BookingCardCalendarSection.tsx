// BookingCardCalendarSection.tsx
import { Link } from 'react-router-dom';
import { DateRange } from 'react-date-range';
import { format } from 'date-fns';
import { inlinePolicySnippets } from '../../../content/terms';
import { priceDisplayConfig } from '../../../config/priceDisplay.config';
import React from 'react';

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
  markEngagement: () => void;
  setOpenCalendar: React.Dispatch<React.SetStateAction<boolean>>;
  setOpenGuests: React.Dispatch<React.SetStateAction<boolean>>;
  setInlineStatus: React.Dispatch<React.SetStateAction<string>>;
  trackEvent: (...args: any[]) => void;
  propertyId: number;
  dates: { startDate: Date; endDate: Date; key: 'selection' };
  validationMessage: string;
  validationMessageId: string;
  setHasInteractedWithDates: React.Dispatch<React.SetStateAction<boolean>>;
  isCheckoutInvalid: boolean;
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
  isBookedDatesLoading: boolean;
  bookedDates: Date[];
  DateRangeComponent: typeof DateRange;
  handleDateChange: (ranges: any) => void;
  defaultStartDate: Date;
  ctaPrimaryColor: string;
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
  dates,
  validationMessage,
  validationMessageId,
  setHasInteractedWithDates,
  isCheckoutInvalid,
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
  isBookedDatesLoading,
  bookedDates,
  handleDateChange,
  defaultStartDate,
  ctaPrimaryColor,
}) => {
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

      <div className="mb-5 rounded-2xl border border-border-strong/60 bg-[color:color-mix(in_srgb,var(--bg-muted)_72%,var(--bg-surface))] shadow-inner">
        <div className={fieldGridClass}>
          <button
            type="button"
            onClick={() => {
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
            className={fieldButtonClass}
            aria-label={`Select check-in date, currently ${format(dates.startDate, 'dd MMM yyyy')}`}
            aria-describedby={validationMessage ? validationMessageId : undefined}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Check-in
            </span>
            <span className="mt-1 text-base font-semibold text-text-primary">
              {format(dates.startDate, 'dd-MM-yyyy')}
            </span>
            <span className={helperTextClass}>Update check-in without leaving the page.</span>
          </button>

          <button
            type="button"
            onClick={() => {
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
            className={fieldButtonClass}
            aria-label={`Select check-out date, currently ${format(dates.endDate, 'dd MMM yyyy')}`}
            aria-describedby={
              isCheckoutInvalid ? checkOutErrorId : validationMessage ? validationMessageId : undefined
            }
            aria-invalid={isCheckoutInvalid}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Check-out
            </span>
            <span className="mt-1 text-base font-semibold text-text-primary">
              {format(dates.endDate, 'dd-MM-yyyy')}
            </span>
            {hasInteractedWithDates && isCheckoutInvalid && (
              <span
                className="mt-1 text-xs font-semibold text-support-error"
                role="alert"
                id={checkOutErrorId}
              >
                Check-out must be after check-in.
              </span>
            )}
            <span className={helperTextClass}>Minimum one night; we’ll auto-fix overlaps.</span>
          </button>

          <button
            type="button"
            onClick={() => {
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
              to="/apartments"
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

      {openCalendar && (
        <div
          ref={calendarRef}
          className="absolute right-0 z-[var(--z-overlay)] bg-bg-surface shadow-level2 rounded-xl mt-2 overflow-hidden border border-border-subtle"
        >
          {isBookedDatesLoading ? (
            <div className="grid grid-cols-7 gap-2 p-3">
              {Array.from({ length: 14 }).map((_, index) => (
                <div
                  key={index}
                  className="h-10 rounded-lg bg-[color:color-mix(in_srgb,var(--bg-muted)_75%,var(--bg-surface))] animate-pulse"
                />
              ))}
            </div>
          ) : (
            <DateRange
              editableDateInputs={true}
              onChange={handleDateChange}
              moveRangeOnFirstSelection={false}
              ranges={[
                {
                  startDate: dates.startDate,
                  endDate: dates.endDate,
                  key: 'selection',
                },
              ]}
              minDate={defaultStartDate}
              rangeColors={[ctaPrimaryColor]}
              showDateDisplay={false}
              showPreview={false}
              showSelectionPreview={true}
              months={1}
              direction="horizontal"
              className="text-sm"
              monthDisplayFormat="MMMM yyyy"
              weekdayDisplayFormat="EEE"
              dayDisplayFormat="d"
              disabledDates={bookedDates}
              dayContentRenderer={(date) => {
                const isBooked = bookedDates.some((bookedDate) => {
                  const d = new Date(bookedDate);
                  return (
                    d.getDate() === date.getDate() &&
                    d.getMonth() === date.getMonth() &&
                    d.getFullYear() === date.getFullYear()
                  );
                });

                return (
                  <div className="relative">
                    {isBooked && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-px w-6 bg-red-500 transform rotate-12"></div>
                      </div>
                    )}
                    <span className={isBooked ? 'text-gray-400' : ''}>{date.getDate()}</span>
                  </div>
                );
              }}
            />
          )}
        </div>
      )}
    </>
  );
};
