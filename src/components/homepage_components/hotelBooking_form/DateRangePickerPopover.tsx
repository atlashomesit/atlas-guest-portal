import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface DateRangePickerPopoverProps {
  anchorRef: React.RefObject<HTMLElement>;
  calendarRef: React.RefObject<HTMLDivElement>;
  contentId: string;
  heading: string;
  labelId: string;
  loadingLabel: string;
  onClose: () => void;
  open: boolean;
  children: React.ReactNode;
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
  labelId,
  loadingLabel,
  onClose,
  open,
  children,
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 420, caretLeft: 24 });
  const localPopoverRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const setPopoverRef = (node: HTMLDivElement | null) => {
    localPopoverRef.current = node;
    if (calendarRef) {
      (calendarRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  };

  useEffect(() => {
    if (!open || !isMobile) return;

    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';

    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [open, isMobile]);

  useLayoutEffect(() => {
    if (!open || isMobile || typeof window === 'undefined') return;

    const updatePosition = () => {
      if (!anchorRef.current) return;

      const anchorRect = anchorRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportLeft = window.scrollX;
      const margin = 12;
      const measuredWidth = localPopoverRef.current?.offsetWidth ?? 0;
      const minWidth = Math.max(anchorRect.width, 320);
      const fallbackWidth = Math.max(measuredWidth, 420);
      const availableWidth = viewportWidth - margin * 2;
      const desiredWidth = Math.max(minWidth, fallbackWidth);
      const width = clamp(desiredWidth, Math.min(minWidth, availableWidth), availableWidth);

      const unclampedLeft = anchorRect.left + viewportLeft;
      const maxLeft = viewportLeft + viewportWidth - width - margin;
      const left = clamp(unclampedLeft, viewportLeft + margin, maxLeft);
      const top = anchorRect.bottom + window.scrollY + 10;

      const caretLeft = clamp(anchorRect.left + anchorRect.width / 2 - left + viewportLeft, 16, width - 16);

      setPosition({ top, left, width, caretLeft });
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

  const desktopStyles = !isMobile
    ? {
        top: position.top,
        left: position.left,
        width: position.width,
        maxWidth: 'min(720px, calc(100vw - 24px))',
      }
    : undefined;

  return createPortal(
    <>
      <div
        className={`fixed inset-0 ${
          isMobile ? 'bg-black/50 backdrop-blur-[1px]' : 'pointer-events-none bg-transparent'
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
        className={`booking-calendar-popover ${
          isMobile
            ? 'fixed inset-x-0 bottom-0 z-[95] max-h-[80vh] rounded-t-3xl border border-border-subtle bg-bg-surface shadow-level3'
            : 'absolute z-[95] rounded-xl border border-border-subtle bg-bg-surface shadow-level2'
        }`}
        style={desktopStyles}
        onClick={(event) => event.stopPropagation()}
      >
        {!isMobile && (
          <div
            className="pointer-events-none absolute -top-2 h-4 w-4 rotate-45 border border-border-subtle border-b-transparent border-r-transparent bg-bg-surface"
            style={{ left: position.caretLeft - 8 }}
            aria-hidden
          />
        )}

        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-bg-muted/60">
          <p id={labelId} className="text-sm font-semibold text-text-primary">
            {heading}
          </p>
          {isMobile ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close date picker"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle bg-bg-surface text-lg font-semibold text-text-primary shadow-sm"
            >
              ×
            </button>
          ) : (
            <span className="text-xs text-text-muted">Press Escape to close</span>
          )}
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-3 sm:p-4">
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
