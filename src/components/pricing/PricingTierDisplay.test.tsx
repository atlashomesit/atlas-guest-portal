import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PricingTierDisplay, { isInternalOrDefaultRatePlanName } from './PricingTierDisplay';

describe('PricingTierDisplay', () => {
  it('renders nothing when no tier information is provided', () => {
    const { container } = render(<PricingTierDisplay />);
    expect(container.firstChild).toBeNull();
  });

  it('renders selected rate plan badge when ratePlanName is a non-internal label', () => {
    render(<PricingTierDisplay ratePlanName="Member Early Bird Rate" />);
    const badge = screen.getByTestId('selected-rate-plan-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Member Early Bird Rate');
  });

  it('TASK-10299208: suppresses internal, occupancy, BAR, Standard Rate, Default, and SKU plan names', () => {
    const internalNames = [
      'Atlas101 . Double',
      'Atlas102 . Double',
      'Atlas201 . Double',
      'Atlas501_PH . Double',
      'Atlas201 · Triple',
      'Standard Rate',
      'Standard',
      'Default',
      'Default Rate',
      'BAR',
      'Single Occupancy',
      'Double',
      'Triple',
      'Quadruple',
      'Sextuple',
      'Atlas302',
    ];

    for (const name of internalNames) {
      expect(isInternalOrDefaultRatePlanName(name)).toBe(true);
      const { unmount } = render(<PricingTierDisplay ratePlanName={name} />);
      expect(screen.queryByTestId('selected-rate-plan-badge')).toBeNull();
      unmount();
    }
  });

  it('renders meal plan badge using label and code mapping', () => {
    const { rerender } = render(<PricingTierDisplay mealPlanLabel="Breakfast Included" />);
    let mealBadge = screen.getByTestId('rate-plan-meal-badge');
    expect(mealBadge).toBeInTheDocument();
    expect(mealBadge).toHaveTextContent('Breakfast included');

    rerender(<PricingTierDisplay mealPlanCode="CP" />);
    mealBadge = screen.getByTestId('rate-plan-meal-badge');
    expect(mealBadge).toHaveTextContent('Breakfast included');

    rerender(<PricingTierDisplay mealPlanCode="MAP" />);
    mealBadge = screen.getByTestId('rate-plan-meal-badge');
    expect(mealBadge).toHaveTextContent('Breakfast and dinner included');
  });

  it('renders cancellation policy with formatting for NonRefundable', () => {
    const { rerender } = render(
      <PricingTierDisplay cancellationPolicy="Free cancellation up to 48 hours before check-in" />
    );
    let policy = screen.getByTestId('rate-plan-cancellation-policy');
    expect(policy).toBeInTheDocument();
    expect(policy).toHaveTextContent('Free cancellation up to 48 hours before check-in');

    rerender(<PricingTierDisplay cancellationPolicy="NonRefundable" />);
    policy = screen.getByTestId('rate-plan-cancellation-policy');
    expect(policy).toHaveTextContent('Non-refundable');
  });

  it('renders all tier components together', () => {
    render(
      <PricingTierDisplay
        ratePlanName="Flexible with Breakfast"
        cancellationPolicy="Free cancellation up to 24 hours"
        mealPlanLabel="Breakfast Included"
      />
    );

    expect(screen.getByTestId('selected-rate-plan-badge')).toHaveTextContent('Flexible with Breakfast');
    expect(screen.getByTestId('rate-plan-meal-badge')).toHaveTextContent('Breakfast included');
    expect(screen.getByTestId('rate-plan-cancellation-policy')).toHaveTextContent('Free cancellation up to 24 hours');
  });
});
