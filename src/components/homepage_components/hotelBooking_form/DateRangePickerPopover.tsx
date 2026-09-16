import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const DateRangePickerPopover: React.FC<DateRangePickerPopoverProps> = ({
  anchorRef,
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
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 340, caretLeft: 24, isFlipped: false });
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

  useLayoutEffect(() => {
    if (!open || isMobile || typeof window === 'undefined') return;

    const updatePosition = () => {
      if (!anchorRef.current) return;

      const anchorRect = anchorRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const viewportLeft = window.scrollX;
      const margin = 12;
      const measuredWidth = localPopoverRef.current?.offsetWidth ?? 320;
      const availableWidth = viewportWidth - margin * 2;
      const width = clamp(measuredWidth, 280, availableWidth);

      const unclampedLeft = anchorRect.left + viewportLeft;
      const maxLeft = viewportLeft + viewportWidth - width - margin;
      const left = clamp(unclampedLeft, viewportLeft + margin, Math.max(viewportLeft + margin, maxLeft));

      const popHeight = localPopoverRef.current?.offsetHeight || 360;
      const spaceBelow = viewportHeight - anchorRect.bottom - margin;
      const spaceAbove = anchorRect.top - margin;

      let isFlipped = false;
      let top: number;

      if (spaceBelow < popHeight && spaceAbove >= spaceBelow) {
        // Flip above anchor
        isFlipped = true;
        top = anchorRect.top + window.scrollY - popHeight - 8;
        if (top < window.scrollY + margin) {
          top = window.scrollY + margin;
        }
      } else {
        // Place below anchor
        isFlipped = false;
        top = anchorRect.bottom + window.scrollY + 8;
        const maxTop = window.scrollY + viewportHeight - popHeight - margin;
        if (top > maxTop && spaceBelow < popHeight) {
          top = Math.max(window.scrollY + margin, maxTop);
        }
      }

      const caretLeft = clamp(anchorRect.left + anchorRect.width / 2 - (left - viewportLeft), 16, width - 16);

      setPosition({ top, left, width, caretLeft, isFlipped });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef, isMobile, open]);

  const portalTarget = useMemo(() => (typeof document !== 'undefined' ? document.body : null), []);

  if (!portalTarget || !open) return null;

  const desktopStyles: React.CSSProperties | undefined = !isMobile
    ? {
        top: position.top,
        left: position.left,
        width: 'max-content',
        maxWidth: 'min(560px, calc(100vw - 24px))',
        maxHeight: 'calc(100vh - 24px)',
        overflowY: 'auto',
      }
    : undefined;

  return createPortal(
    <>
      <div
        className={`fixed inset-0 ${
          isMobile ? 'bg-black/50 backdrop-blur-[8px]' : 'pointer-events-none bg-transparent'
        } z-[90]`}
        onClick={isMobile ? onClose : undefined}
        aria-hidden
      />
      <div
        ref={setPopoverRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        id={contentId}
        tabIndex={-1}
        className={`booking-calendar-popover${popoverClassName ? ` ${popoverClassName}` : ''} ${
          isMobile
            ? 'fixed inset-x-0 bottom-0 z-[95] max-h-[80vh] rounded-t-[24px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_16px_48px_rgba(15,23,42,0.12)]'
            : 'absolute z-[95] rounded-[16px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_16px_48px_rgba(15,23,42,0.12)]'
        }`}
        style={desktopStyles}
        onClick={(event) => event.stopPropagation()}
      >
        {!isMobile && (
          <div
            className={`pointer-events-none absolute h-3.5 w-3.5 rotate-45 border border-[var(--border-subtle)] bg-[var(--bg-surface)] ${
              position.isFlipped
                ? '-bottom-2 border-t-transparent border-l-transparent'
                : '-top-2 border-b-transparent border-r-transparent'
            }`}
            style={{ left: position.caretLeft - 7 }}
            aria-hidden
          />
        )}

        {isMobile && (
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1 rounded-full bg-[var(--border-strong)]" aria-hidden />
          </div>
        )}

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
          {isMobile && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close date picker"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-base font-semibold text-[var(--text-primary)] shadow-sm"
            >
              ×
            </button>
          )}
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
};
