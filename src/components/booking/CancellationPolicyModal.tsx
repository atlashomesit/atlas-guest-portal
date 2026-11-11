import React, { useEffect } from 'react';
import { X, ShieldCheck, AlertCircle, Clock } from 'lucide-react';
import {
  type CancellationTier,
  resolveEffectiveCancellationTier,
  getCancellationRefundTiers,
  describeCancellationPolicy,
} from '@/utils/cancellationPolicy';
import CancellationMilestoneTimeline from './CancellationMilestoneTimeline';

export interface CancellationPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  cancellationTier?: CancellationTier | string | null;
  checkInDate?: Date | string | null;
  windowHoursOverride?: number | null;
  graceHours?: number | null;
  className?: string;
}

export const CancellationPolicyModal: React.FC<CancellationPolicyModalProps> = ({
  isOpen,
  onClose,
  cancellationTier,
  checkInDate,
  windowHoursOverride,
  graceHours,
  className = '',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const effectiveTier = resolveEffectiveCancellationTier(cancellationTier);
  const { headline, afterWindowCopy } = describeCancellationPolicy(effectiveTier);
  const refundTiers = getCancellationRefundTiers(effectiveTier, windowHoursOverride);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancellation-policy-modal-title"
      data-testid="cancellation-policy-modal"
    >
      <div
        className={`relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-6 ${className}`}
        data-testid="cancellation-policy-modal-content"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-neutral-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              <h2
                id="cancellation-policy-modal-title"
                className="text-lg font-bold text-neutral-900"
              >
                Cancellation Policy
              </h2>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Clear, transparent refund terms set by property policy
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
            data-testid="cancellation-modal-close-btn"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Tier Summary Card */}
        <div className="rounded-xl bg-neutral-50 border border-neutral-200/80 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Policy Tier
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                effectiveTier === 'Flexible'
                  ? 'bg-emerald-100 text-emerald-800'
                  : effectiveTier === 'Moderate'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
              }`}
              data-testid="cancellation-policy-tier-badge"
            >
              {effectiveTier}
            </span>
          </div>
          <p className="text-sm font-semibold text-neutral-900">{headline}</p>
          {afterWindowCopy && (
            <p className="text-xs text-neutral-600 leading-relaxed">{afterWindowCopy}</p>
          )}
        </div>

        {/* Refund Tiers Section */}
        <div className="space-y-3" data-testid="cancellation-refund-tiers">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
            <span>Refund Tiers &amp; Deadlines</span>
          </h3>

          <div className="space-y-2.5">
            {refundTiers.map((tier, idx) => (
              <div
                key={`refund-tier-${idx}`}
                className={`p-3.5 rounded-xl border flex items-start justify-between gap-4 transition-all ${
                  tier.isFreeCancellation
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : tier.isNonRefundable
                      ? 'border-rose-200 bg-rose-50/40'
                      : 'border-amber-200 bg-amber-50/40'
                }`}
                data-testid={`refund-tier-row-${idx}`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    {tier.isFreeCancellation ? (
                      <span className="text-emerald-700 text-xs font-bold">✓</span>
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
                    )}
                    <span className="text-sm font-semibold text-neutral-900">
                      {tier.cutoffLabel}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 leading-snug">{tier.description}</p>
                </div>
                <span
                  className={`shrink-0 text-xs font-bold px-2 py-1 rounded-md ${
                    tier.isFreeCancellation
                      ? 'bg-emerald-100 text-emerald-800'
                      : tier.isNonRefundable
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                  }`}
                  data-testid={`refund-tier-percent-${idx}`}
                >
                  {tier.refundLabel}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline if check-in is known */}
        {checkInDate && (
          <div className="pt-2 border-t border-neutral-100">
            <CancellationMilestoneTimeline
              checkInDate={checkInDate}
              cancellationTier={effectiveTier}
              windowHoursOverride={windowHoursOverride}
              graceHours={graceHours}
            />
          </div>
        )}

        {/* Footer actions */}
        <div className="pt-4 border-t border-neutral-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors"
            data-testid="cancellation-modal-done-btn"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancellationPolicyModal;
