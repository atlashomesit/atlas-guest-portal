import React from 'react';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import {
  type CancellationTier,
  computeEffectiveCancellationDeadline,
  formatCancellationDeadline,
  isFreeCancellationDeadlineActive,
  resolveEffectiveCancellationTier,
} from '@/utils/cancellationPolicy';
import { format } from 'date-fns';

export interface CancellationMilestoneTimelineProps {
  checkInDate: Date | string | null | undefined;
  cancellationTier?: CancellationTier | string | null;
  windowHoursOverride?: number | null;
  graceHours?: number | null;
  bookingCreatedAt?: Date;
  className?: string;
}

export default function CancellationMilestoneTimeline({
  checkInDate,
  cancellationTier,
  windowHoursOverride,
  graceHours,
  bookingCreatedAt = new Date(),
  className = '',
}: CancellationMilestoneTimelineProps) {
  if (!checkInDate) return null;

  const checkIn = typeof checkInDate === 'string' ? new Date(checkInDate) : checkInDate;
  if (Number.isNaN(checkIn.getTime())) return null;

  const effectiveTier = resolveEffectiveCancellationTier(cancellationTier);
  const deadline = computeEffectiveCancellationDeadline(
    checkIn,
    effectiveTier,
    windowHoursOverride,
    bookingCreatedAt,
    graceHours,
  );

  const isActive = isFreeCancellationDeadlineActive(deadline);
  const deadlineFormatted = formatCancellationDeadline(deadline);
  const checkInFormatted = format(checkIn, 'd MMM, h:mm a');

  return (
    <div
      className={`rounded-xl border border-border-subtle bg-bg-surface p-3.5 shadow-sm ${className}`}
      data-testid="cancellation-milestone-timeline"
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Cancellation policy timeline ({effectiveTier})
        </h4>
      </div>

      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border-subtle">
        {/* Step 1: Booking */}
        <div className="relative">
          <div className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-4 ring-bg-surface">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs font-semibold text-text-primary">Today / Booking confirmed</div>
            <div className="text-[11px] text-text-muted">
              {isActive ? 'Full refund window begins upon booking.' : 'Standard policy applied.'}
            </div>
          </div>
        </div>

        {/* Step 2: Full Refund Cutoff */}
        <div className="relative" data-testid="cancellation-full-refund-cutoff">
          <div
            className={`absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-bg-surface ${
              isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5 flex-wrap">
              <span>Full refund cutoff:</span>
              <span className="font-bold text-emerald-700">{deadlineFormatted}</span>
            </div>
            <div className="text-[11px] text-text-secondary mt-0.5">
              {effectiveTier === 'Strict' && (
                <span>Cancel before this cutoff for a 100% refund. Cancellations after this are non-refundable.</span>
              )}
              {effectiveTier === 'Moderate' && (
                <span>Cancel before this cutoff for a 100% refund. Cancellations after receive a 50% partial refund.</span>
              )}
              {effectiveTier === 'Flexible' && (
                <span>Cancel before this cutoff for a full 100% refund.</span>
              )}
            </div>
          </div>
        </div>

        {/* Step 3: Non-Refundable Cutoff */}
        <div className="relative" data-testid="cancellation-non-refundable-cutoff">
          <div className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-700 ring-4 ring-bg-surface">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5 flex-wrap">
              <span>Non-refundable cutoff:</span>
              <span className="font-bold text-rose-700">
                {effectiveTier === 'Strict' ? deadlineFormatted : checkInFormatted}
              </span>
            </div>
            <div className="text-[11px] text-text-secondary mt-0.5">
              {effectiveTier === 'Strict'
                ? 'After the cutoff, 0% refund (100% retention).'
                : effectiveTier === 'Moderate'
                  ? 'No refund for cancellations after check-in.'
                  : 'No refund after check-in.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
