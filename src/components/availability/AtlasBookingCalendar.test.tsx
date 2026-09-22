import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AtlasBookingCalendar } from './AtlasBookingCalendar';

describe('AtlasBookingCalendar — Month Visibility & Layout', () => {
  const mockOnClose = vi.fn();
  const mockOnChange = vi.fn();
  const mockOnShownDateChange = vi.fn();

  const createAnchor = () => {
    const btn = document.createElement('button');
    btn.getBoundingClientRect = () => ({
      top: 300,
      bottom: 350,
      left: 600,
      right: 750,
      width: 150,
      height: 50,
      x: 600,
      y: 300,
      toJSON: () => {},
    });
    document.body.appendChild(btn);
    return { current: btn };
  };

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    anchorRef: createAnchor(),
    value: { startDate: new Date('2026-09-16'), endDate: new Date('2026-09-17') },
    onChange: mockOnChange,
    today: new Date('2026-09-16'),
    minDate: new Date('2026-09-15'),
    maxDate: new Date('2027-09-16'),
    disabledDay: () => false,
    dateStatusMap: new Map(),
    calendarDailyPrices: new Map([['2026-09-16', 4500], ['2026-09-17', 4500]]),
    fallbackPrice: 4500,
    pricingLoading: false,
    shownDate: new Date(2026, 8, 1), // September 2026
    onShownDateChange: mockOnShownDateChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders both months clearly with month names and years', () => {
    render(<AtlasBookingCalendar {...defaultProps} />);

    // Month titles should be present and clearly formatted
    const monthTitles = document.querySelectorAll('.bc-month-title');
    expect(monthTitles.length).toBe(2);

    expect(monthTitles[0].textContent).toContain('September');
    expect(monthTitles[0].textContent).toContain('2026');

    expect(monthTitles[1].textContent).toContain('October');
    expect(monthTitles[1].textContent).toContain('2026');
  });

  it('renders previous and next month navigation buttons with clear accessible labels', () => {
    render(<AtlasBookingCalendar {...defaultProps} />);

    const prevBtn = screen.getByLabelText('Previous month');
    const nextBtn = screen.getByLabelText('Next month');

    expect(prevBtn).toBeDefined();
    expect(nextBtn).toBeDefined();

    // Clicking next month invokes onShownDateChange with next month (October 2026)
    fireEvent.click(nextBtn);
    expect(mockOnShownDateChange).toHaveBeenCalled();
    const calledDate = mockOnShownDateChange.mock.calls[0][0];
    expect(calledDate.getMonth()).toBe(9); // October
  });

  it('renders into document.body via portal with high z-index', () => {
    render(<AtlasBookingCalendar {...defaultProps} />);

    // Popover should be in document.body, not trapped inside container
    const popover = document.querySelector('.bc-popover') as HTMLElement;
    expect(popover).toBeDefined();
    expect(document.body.contains(popover)).toBe(true);
    expect(popover.style.position).toBe('fixed');
    // Above the fixed page chrome that overlaps the booking column — navbar (--z-sticky 20),
    // "Chat with us"/assistant buttons (--z-floating 30), mobile sticky Reserve bar (50) — which
    // otherwise intercepts clicks on day cells.
    expect(Number(popover.style.zIndex)).toBeGreaterThan(50);
  });

  it('does not render popover when open is false', () => {
    render(<AtlasBookingCalendar {...defaultProps} open={false} />);
    const popover = document.querySelector('.bc-popover');
    expect(popover).toBeNull();
  });

  it('renders quick presets like Tonight and This weekend', () => {
    render(<AtlasBookingCalendar {...defaultProps} />);

    expect(screen.getByText('Tonight')).toBeDefined();
    expect(screen.getByText('This weekend')).toBeDefined();
    expect(screen.getByText('Next weekend')).toBeDefined();
  });

  it('positions popover directly below the anchor button', () => {
    render(<AtlasBookingCalendar {...defaultProps} />);
    const popover = document.querySelector('.bc-popover') as HTMLElement;
    expect(popover).toBeDefined();
    // Anchor bottom is 350, MARGIN is 8 -> top should be 358px
    expect(popover.style.top).toBe('358px');
  });

  it('does not flip above the anchor when the anchor is lower in the viewport', () => {
    const bottomAnchor = {
      current: (() => {
        const btn = document.createElement('button');
        btn.getBoundingClientRect = () => ({
          top: 600,
          bottom: 650,
          left: 600,
          right: 750,
          width: 150,
          height: 50,
          x: 600,
          y: 600,
          toJSON: () => {},
        });
        document.body.appendChild(btn);
        return btn;
      })(),
    };
    render(<AtlasBookingCalendar {...defaultProps} anchorRef={bottomAnchor} />);
    const popover = document.querySelector('.bc-popover') as HTMLElement;
    expect(popover).toBeDefined();
    // Anchor bottom is 650, MARGIN is 8 -> top should be 658px (never flips above to 600 - 350 - 8 = 242px)
    expect(popover.style.top).toBe('658px');
  });

  describe('keeps every day cell on screen and clickable', () => {
    const POPOVER_HEIGHT = 340;
    const originalInnerHeight = window.innerHeight;
    const originalMatchMedia = window.matchMedia;
    const heightProps = ['scrollHeight', 'offsetHeight', 'clientHeight'] as const;
    const originalDescriptors = heightProps.map(
      (prop) => [prop, Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop)] as const,
    );
    const extraNodes: HTMLElement[] = [];

    const anchorWithBottom = (bottom: number) => {
      const btn = document.createElement('button');
      btn.getBoundingClientRect = () =>
        ({ top: bottom - 60, bottom, left: 900, right: 1170, width: 270, height: 60, x: 900, y: bottom - 60, toJSON: () => {} }) as DOMRect;
      document.body.appendChild(btn);
      extraNodes.push(btn);
      return { current: btn };
    };

    const addFixedNavbar = (bottom: number) => {
      const header = document.createElement('header');
      header.id = 'navbar_container';
      header.getBoundingClientRect = () =>
        ({ top: 0, bottom, left: 0, right: 1280, width: 1280, height: bottom, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
      document.body.appendChild(header);
      extraNodes.push(header);
    };

    const setViewportHeight = (value: number) => {
      Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value });
    };

    beforeEach(() => {
      // jsdom has no layout: give the popover (only) a realistic rendered height.
      for (const prop of heightProps) {
        Object.defineProperty(HTMLElement.prototype, prop, {
          configurable: true,
          get(this: HTMLElement) {
            return this.classList?.contains('bc-popover') ? POPOVER_HEIGHT : 0;
          },
        });
      }
    });

    afterEach(() => {
      for (const [prop, descriptor] of originalDescriptors) {
        if (descriptor) Object.defineProperty(HTMLElement.prototype, prop, descriptor);
      }
      setViewportHeight(originalInnerHeight);
      window.matchMedia = originalMatchMedia;
      extraNodes.splice(0).forEach((node) => node.remove());
    });

    it('opens directly below the field when the calendar fits below it', () => {
      setViewportHeight(1080);
      addFixedNavbar(136);
      render(<AtlasBookingCalendar {...defaultProps} anchorRef={anchorWithBottom(570)} />);
      const popover = document.querySelector('.bc-popover') as HTMLElement;
      expect(popover.style.top).toBe('578px');
      expect(popover.style.maxHeight).toBe('');
      expect(popover.style.clipPath).toBe('');
    });

    it('slides up just enough to stay fully on screen when the field sits low on a 720px viewport', () => {
      // Measured on dev 2026-09-17 at 1280x720: field bottom 489, popover spanned y 497-803, so
      // 11 selectable days were below the fold (fixed popover beside a sticky column: page
      // scrolling never reveals them).
      setViewportHeight(720);
      addFixedNavbar(136);
      render(<AtlasBookingCalendar {...defaultProps} anchorRef={anchorWithBottom(489)} />);
      const popover = document.querySelector('.bc-popover') as HTMLElement;
      // 720 - 8 margin - 340 = 372: bottom edge at 712, still overlapping the field rather than
      // flipping above it (489 - 60 - 340 - 8 = 81 would be a flip).
      expect(popover.style.top).toBe('372px');
      expect(parseFloat(popover.style.top) + POPOVER_HEIGHT).toBeLessThanOrEqual(720 - 8);
      expect(popover.style.maxHeight).toBe('');
      expect(popover.style.clipPath).toBe('');
    });

    it('never slides above the navbar and caps its height when the viewport is too short', () => {
      setViewportHeight(450);
      addFixedNavbar(136);
      render(<AtlasBookingCalendar {...defaultProps} anchorRef={anchorWithBottom(400)} />);
      const popover = document.querySelector('.bc-popover') as HTMLElement;
      expect(popover.style.top).toBe('144px'); // navbar bottom 136 + 8
      expect(popover.style.maxHeight).toBe('298px'); // 450 - 8 - 144: the grid scrolls inside
      expect(popover.style.clipPath).toBe('');
    });

    it('slides under the fixed navbar while scrolling instead of painting over it', () => {
      setViewportHeight(720);
      addFixedNavbar(136);
      // The field has scrolled up beneath the navbar: popover top 108 is 28px under its bottom edge.
      render(<AtlasBookingCalendar {...defaultProps} anchorRef={anchorWithBottom(100)} />);
      const popover = document.querySelector('.bc-popover') as HTMLElement;
      expect(popover.style.top).toBe('108px');
      expect(popover.style.clipPath).toBe('inset(28px 0 0 0)');
      expect(Number(popover.style.zIndex)).toBeGreaterThan(50);
    });

    it('leaves placement to the CSS bottom sheet on narrow viewports but keeps it above the Reserve bar', () => {
      setViewportHeight(727);
      addFixedNavbar(81);
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === '(max-width: 620px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia;
      render(<AtlasBookingCalendar {...defaultProps} anchorRef={anchorWithBottom(700)} />);
      const popover = document.querySelector('.bc-popover') as HTMLElement;
      expect(popover.style.maxHeight).toBe('');
      expect(popover.style.clipPath).toBe('');
      expect(Number(popover.style.zIndex)).toBeGreaterThan(50);
    });
  });
});


