import React, { useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';

/**
 * TASK-102113: shared (?) info tooltip for guest-facing price breakdown fee lines.
 *
 * Accessible hover + mobile-tap popover. Hover/focus shows the tip via the
 * group-hover CSS arm (desktop, no JS needed); tap/click toggles it open as a
 * clean popover sheet for touch devices where hover does not exist. Escape or
 * an outside tap closes it.
 *
 * Copy rule (binding from the board entry): explain GENERICALLY what each fee
 * covers. NEVER invent host-specific policy amounts or rules — amounts shown
 * in the breakdown come from the server; the tip only explains the concept.
 */
export const FEE_INFO_COPY = {
  cleaning:
    'One-time charge for professional cleaning of the unit before your check-in. Set by the host and varies by unit — it is not a per-night charge.',
  touristTax:
    'Local government levy collected on behalf of the authorities, where applicable. It is included in your total.',
  paymentProcessing:
    'Razorpay payment gateway fee — passed through, not a platform markup.',
  addOns:
    'Optional extras you selected for this stay, charged in addition to the room fare.',
} as const;

export type FeeInfoKey = keyof typeof FEE_INFO_COPY;

interface FeeInfoTipProps {
  /** Which generic fee explanation to show. */
  fee: FeeInfoKey;
  /** Fee line label, used for the accessible button name (e.g. "Cleaning fee"). */
  label: string;
  /** Test id prefix — button is `{testId}`, popover is `{testId}-tooltip`. */
  testId?: string;
}

export const FeeInfoTip: React.FC<FeeInfoTipProps> = ({ fee, label, testId }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();
  const text = FEE_INFO_COPY[fee];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open ]);

  return (
    <span ref={rootRef} className="group/fee-info relative inline-flex items-center">
      <button
        type="button"
        aria-label={`More info about ${label}`}
        aria-expanded={open}
        aria-describedby={tipId}
        data-testid={testId}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          if (!rootRef.current?.contains(e.relatedTarget as Node)) {
            setOpen(false);
          }
        }}
        className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cta-primary)]"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        id={tipId}
        data-testid={testId ? `${testId}-tooltip` : undefined}
        className={`absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-[13px] font-normal leading-relaxed text-[var(--text-muted)] shadow-[var(--shadow-level-2)] ${
          open ? 'block' : 'hidden group-hover/fee-info:block group-focus-within/fee-info:block'
        }`}
      >
        {text}
      </span>
    </span>
  );
};
