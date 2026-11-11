import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DormRoomSelector from './DormRoomSelector';

describe('DormRoomSelector (TASK-1039778: bed type labels, gender restrictions, amenity alignment)', () => {
  it('renders clear bed type labels with formatted text and clean badges', () => {
    render(
      <DormRoomSelector
        dormGenderPolicy="Mixed"
        bedOptions={[
          { id: 'lb', bedType: 'lower_bunk', availableBeds: 3 },
          { id: 'ub', bedType: 'upper_bunk', availableBeds: 3 },
          { id: 'sb', bedType: 'single_bed', availableBeds: 1 },
        ]}
      />
    );

    const labels = screen.getAllByTestId('dorm-bed-type-label').map((el) => el.textContent);
    expect(labels).toContain('Lower Bunk');
    expect(labels).toContain('Upper Bunk');
    expect(labels).toContain('Single Bed');
  });

  it('renders gender restrictions with clean badge styling', () => {
    const { rerender } = render(
      <DormRoomSelector dormGenderPolicy="FemaleOnly" />
    );
    expect(screen.getByTestId('hostel-gender-badge-female')).toHaveTextContent(/Female/i);

    rerender(<DormRoomSelector dormGenderPolicy="MaleOnly" />);
    expect(screen.getByTestId('hostel-gender-badge-male')).toHaveTextContent(/Male/i);

    rerender(<DormRoomSelector dormGenderPolicy="Mixed" />);
    expect(screen.getByTestId('hostel-gender-badge-mixed')).toHaveTextContent('Mixed Dorm');
  });

  it('renders aligned amenity tags', () => {
    render(<DormRoomSelector />);
    const amenityTags = screen.getByTestId('dorm-amenity-tags');
    expect(amenityTags).toHaveTextContent('Personal Locker');
    expect(amenityTags).toHaveTextContent('Reading Light');
    expect(amenityTags).toHaveTextContent('Free WiFi');
  });

  it('allows selecting bed type and changing bed quantity', () => {
    const onSelectBed = vi.fn();
    const onCountChange = vi.fn();

    render(
      <DormRoomSelector
        selectedBedsCount={2}
        maxBedsSelectable={4}
        onSelectBed={onSelectBed}
        onCountChange={onCountChange}
      />
    );

    fireEvent.click(screen.getByTestId('dorm-bed-option-upper-bunk'));
    expect(onSelectBed).toHaveBeenCalledWith('upper-bunk');

    fireEvent.click(screen.getByTestId('dorm-beds-increase'));
    expect(onCountChange).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByTestId('dorm-beds-decrease'));
    expect(onCountChange).toHaveBeenCalledWith(1);
  });

  it('TASK-10299109 & TASK-1039779: renders gender filter selector and per bed price indicator', () => {
    const onGenderFilterChange = vi.fn();
    render(
      <DormRoomSelector
        onGenderFilterChange={onGenderFilterChange}
        bedOptions={[
          { id: 'b1', bedType: 'Lower Bunk', pricePerBed: 599, genderPolicy: 'Mixed' },
          { id: 'b2', bedType: 'Upper Bunk', pricePerBed: 549, genderPolicy: 'FemaleOnly' },
          { id: 'b3', bedType: 'Single Bed', pricePerBed: 699, genderPolicy: 'MaleOnly' },
        ]}
      />
    );

    const filterSelector = screen.getByTestId('dorm-gender-filter-selector');
    expect(filterSelector).toBeInTheDocument();

    const allBtn = screen.getByTestId('gender-filter-all');
    const mixedBtn = screen.getByTestId('gender-filter-mixed-dorm');
    const femaleBtn = screen.getByTestId('gender-filter-female-only');
    const maleBtn = screen.getByTestId('gender-filter-male-only');

    expect(allBtn).toHaveTextContent('All');
    expect(mixedBtn).toHaveTextContent('Mixed Dorm');
    expect(femaleBtn).toHaveTextContent('Female Only');
    expect(maleBtn).toHaveTextContent('Male Only');

    // Test per bed price indicator
    const perBedBadges = screen.getAllByTestId('per-bed-indicator');
    expect(perBedBadges.length).toBeGreaterThan(0);
    expect(perBedBadges[0]).toHaveTextContent('per bed');

    // Test clicking female only filter
    fireEvent.click(femaleBtn);
    expect(onGenderFilterChange).toHaveBeenCalledWith('Female Only');
  });
});
