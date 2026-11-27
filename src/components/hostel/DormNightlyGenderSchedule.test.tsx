import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  DormNightlyGenderSchedule,
  isStayEligibleForDormGenderSchedule,
} from './DormNightlyGenderSchedule';

describe('HSL-043 DormNightlyGenderSchedule', () => {
  const slots = [
    { date: '2026-12-01', genderMode: 'Mixed' as const, availableBeds: 4 },
    { date: '2026-12-02', genderMode: 'FemaleOnly' as const, availableBeds: 3 },
  ];

  it('validates night-by-night Mixed and FemaleOnly eligibility', () => {
    expect(isStayEligibleForDormGenderSchedule(slots, 'FemaleOnly', 2).eligible).toBe(true);
    const maleCheck = isStayEligibleForDormGenderSchedule(slots, 'MaleOnly', 1);
    expect(maleCheck.eligible).toBe(false);
    expect(maleCheck.blockingDates).toEqual(['2026-12-02']);
  });

  it('renders per-night dorm gender chips', () => {
    render(<DormNightlyGenderSchedule slots={slots} />);
    expect(screen.getByTestId('dorm-nightly-gender-schedule')).toBeTruthy();
    expect(screen.getByText('Female-Only')).toBeTruthy();
  });
});
