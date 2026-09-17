import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface DateRangePickerPopoverProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  calendarRef: React.RefObject<HTMLDivElement | null>;
  contentId: string;
  heading: string;
  instructionText?: string;
  showInstruction?: boolean;
  instructionAriaLabel?: string;
  labelId: string;
  loadingLabel: string;
  onClose: () => void;
  open: boolean;
  children: React.ReactNode;
  popoverClassName?: string;
  activeField?: 'checkin' | 'checkout' | null;
}

const useMediaQuery = (query: string) => {
  const getMatches = () => (typeof window === 'undefined' ? false : window.matchMedia(query).matches);
  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQueryList = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);

    mediaQueryList.addEventListener('change', listener);
    setMatches(mediaQueryList.matches);

    return () => mediaQueryList.removeEventListener('change', listener);
  }, [query]);

  return matches;
};

export const DateRangePickerPopover: React.FC<DateRangePickerPopoverProps> = ({
  calendarRef,
  contentId,
  heading,
  instructionText,
  showInstruction,
  instructionAriaLabel,
  labelId,
  loadingLabel,
  onClose,
  open,
  children,
  popoverClassName,
  activeField,
}) => {
  const localPopoverRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // TASK-4439: focus trap + focus return (WCAG 2.4.3 / 2.1.2) — Escape close is
  // handled by the parent widget (SearchAvailabilityWidget / AtlasDateRangePicker).
  useFocusTrap<HTMLDivElement>(open, localPopoverRef);

  const setPopoverRef = (node: HTMLDivElement | null) => {
    localPopoverRef.current = node;
    if (calendarRef) {
      (calendarRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  };

  useEffect(() => {
    if (!open || !isMobile || typeof document === 'undefined' || typeof window === 'undefined') return;

    const body = document.body;
    const previousStyles = {
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };

    const previousScrollTop = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const computedPaddingRight = Number.parseFloat(getComputedStyle(body).paddingRight) || 0;

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${previousScrollTop}px`;
    body.style.width = '100%';

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousStyles.overflow;
      body.style.paddingRight = previousStyles.paddingRight;
      body.style.position = previousStyles.position;
      body.style.top = previousStyles.top;
      body.style.width = previousStyles.width;
      window.scrollTo({ top: previousScrollTop, left: 0 });
    };
  }, [open, isMobile]);

  const portalTarget = useMemo(() => (typeof document !== 'undefined' ? document.body : null), []);

  if (!open) return null;

  // Mobile: Bottom sheet drawer via portal
  if (isMobile) {
    if (!portalTarget) return null;
    return createPortal(
      <>
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-[8px] z-[90]"
          onClick={onClose}
          aria-hidden
        />
        <div
          ref={setPopoverRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelId}
          id={contentId}
          tabIndex={-1}
          className={`booking-calendar-popover${popoverClassName ? ` ${popoverClassName}` : ''} fixed inset-x-0 bottom-0 z-[95] max-h-[80vh] rounded-t-[24px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_16px_48px_rgba(15,23,42,0.12)]`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1 rounded-full bg-[var(--border-strong)]" aria-hidden />
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--bg-muted)] bg-[var(--bg-surface)]">
            <div className="flex items-center gap-2">
              <p id={labelId} className="text-[15px] font-semibold text-[var(--text-primary)]">
                {heading}
              </p>
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-muted)]"
                title="Click a date for check-in, then a later date for check-out."
                aria-label={instructionAriaLabel ?? 'Click a date for check-in, then a later date for check-out.'}
              >
                ?
              </span>
            </div>
            {showInstruction && instructionText ? (
              <p className="ml-3 text-xs text-[var(--text-muted)]" aria-live="polite">
                {instructionText}
              </p>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close date picker"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-base font-semibold text-[var(--text-primary)] shadow-sm"
            >
              ×
            </button>
          </div>

          <div className="overflow-y-auto overflow-x-hidden p-3" style={{ pointerEvents: 'auto' }}>
            {children}
            <p className="sr-only" aria-live="polite">
              {loadingLabel}
            </p>
          </div>
        </div>
      </>,
      portalTarget,
    );
  }

  // Desktop: In-place absolute positioning relative to anchor container, same as GuestTypeSelector
  // Anchored with pure CSS absolute positioning: top-full left-0 mt-2 z-[80]
  // Never jumps or drifts on scroll or date selection
  return (
    <div
      ref={setPopoverRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      id={contentId}
      tabIndex={-1}
      className={`booking-calendar-popover${popoverClassName ? ` ${popoverClassName}` : ''} absolute top-full left-0 mt-2 z-[80] w-[500px] max-w-[calc(100vw-24px)] rounded-[16px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-level-3)] pointer-events-auto`}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className="pointer-events-none absolute -top-2 h-3.5 w-3.5 rotate-45 border border-[var(--border-subtle)] border-b-transparent border-r-transparent bg-[var(--bg-surface)]"
        style={{ left: activeField === 'checkout' ? '60%' : '32px' }}
        aria-hidden
      />

      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--bg-muted)] bg-[var(--bg-surface)]">
        <div className="flex items-center gap-2">
          <p id={labelId} className="text-[15px] font-semibold text-[var(--text-primary)]">
            {heading}
          </p>
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-muted)]"
            title="Click a date for check-in, then a later date for check-out."
            aria-label={instructionAriaLabel ?? 'Click a date for check-in, then a later date for check-out.'}
          >
            ?
          </span>
        </div>
        {showInstruction && instructionText ? (
          <p className="ml-3 text-xs text-[var(--text-muted)]" aria-live="polite">
            {instructionText}
          </p>
        ) : null}
      </div>

      <div className="p-3" style={{ pointerEvents: 'auto' }}>
        {children}
        <p className="sr-only" aria-live="polite">
          {loadingLabel}
        </p>
      </div>
    </div>
  );
};
