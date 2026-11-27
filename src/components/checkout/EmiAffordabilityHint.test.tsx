import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmiAffordabilityHint, calculateLowestMonthlyEmi } from './EmiAffordabilityHint';

describe('PAY-056 EmiAffordabilityHint', () => {
  it('calculates lowest monthly EMI and renders hint when enabled above threshold', () => {
    expect(calculateLowestMonthlyEmi(12000, 6)).toBe(2000);
    render(<EmiAffordabilityHint totalInr={12000} emiEnabled payLaterEnabled />);
    expect(screen.getByTestId('emi-affordability-hint').textContent).toContain('₹2,000/mo');
    expect(screen.getByTestId('emi-affordability-hint').textContent).toContain('Pay Later');
  });

  it('hides hint when disabled or below minimum order amount', () => {
    const { container } = render(<EmiAffordabilityHint totalInr={1500} emiEnabled />);
    expect(container.firstChild).toBeNull();
  });
});
