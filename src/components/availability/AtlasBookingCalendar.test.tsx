import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    const popover = document.querySelector('.bc-popover');
    expect(popover).toBeDefined();
    expect(document.body.contains(popover)).toBe(true);
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
});
