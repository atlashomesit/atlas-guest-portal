import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  PerMorningBreakfastSelector,
  calculatePerMorningBreakfastTotal,
} from './PerMorningBreakfastSelector';

describe('BNB-046 PerMorningBreakfastSelector', () => {
  it('computes separate adult and reduced child breakfast pricing per selected morning', () => {
    expect(calculatePerMorningBreakfastTotal(['2026-12-02', '2026-12-03'], 2, 1, 250, 125)).toBe(1250);
  });

  it('toggles individual mornings and displays live add-on total', () => {
    const onChange = vi.fn();
    render(
      <PerMorningBreakfastSelector
        mornings={['2026-12-02', '2026-12-03']}
        adults={2}
        children={1}
        adultPriceInr={250}
        childPriceInr={125}
        selectedMornings={['2026-12-02']}
        onChange={onChange}
      />
    );
    expect(screen.getByTestId('breakfast-total').textContent).toContain('₹625');
    fireEvent.click(screen.getByRole('button', { name: '2026-12-03' }));
    expect(onChange).toHaveBeenCalledWith(['2026-12-02', '2026-12-03']);
  });
});
