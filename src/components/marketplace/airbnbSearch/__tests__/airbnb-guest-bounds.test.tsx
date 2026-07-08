import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AirbnbGuestSelector } from '../AirbnbGuestSelector';

describe('AirbnbGuestSelector infants and pets bounds (TASK-4474)', () => {
  it('should cap infants at 5 and disable + button at max', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AirbnbGuestSelector
        value={{ adults: 1, children: 0, infants: 4, pets: 0 }}
        onChange={onChange}
        isOpen={true}
        onToggle={() => {}}
        onClose={() => {}}
        summary="1 guest"
      />
    );

    // Click + button to increment infants from 4 to 5
    const infantsButtons = screen.getAllByRole('button');
    const infantsPlusBtn = infantsButtons.find(b => b.getAttribute('aria-label') === 'Increase infants');

    fireEvent.click(infantsPlusBtn!);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ infants: 5 }));

    // At max (5), + button should be disabled
    rerender(
      <AirbnbGuestSelector
        value={{ adults: 1, children: 0, infants: 5, pets: 0 }}
        onChange={onChange}
        isOpen={true}
        onToggle={() => {}}
        onClose={() => {}}
        summary="1 guest"
      />
    );

    const updatedButtons = screen.getAllByRole('button');
    const updatedInfantsPlusBtn = updatedButtons.find(b => b.getAttribute('aria-label') === 'Increase infants');
    expect(updatedInfantsPlusBtn).toBeDisabled();
  });

  it('should cap pets at 5 and disable + button at max', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AirbnbGuestSelector
        value={{ adults: 1, children: 0, infants: 0, pets: 4 }}
        onChange={onChange}
        isOpen={true}
        onToggle={() => {}}
        onClose={() => {}}
        summary="1 guest"
      />
    );

    // Click + button to increment pets from 4 to 5
    const buttons = screen.getAllByRole('button');
    const petsPlusBtn = buttons.find(b => b.getAttribute('aria-label') === 'Increase pets');

    fireEvent.click(petsPlusBtn!);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ pets: 5 }));

    // At max (5), + button should be disabled
    rerender(
      <AirbnbGuestSelector
        value={{ adults: 1, children: 0, infants: 0, pets: 5 }}
        onChange={onChange}
        isOpen={true}
        onToggle={() => {}}
        onClose={() => {}}
        summary="1 guest"
      />
    );

    const updatedButtons = screen.getAllByRole('button');
    const updatedPetsPlusBtn = updatedButtons.find(b => b.getAttribute('aria-label') === 'Increase pets');
    expect(updatedPetsPlusBtn).toBeDisabled();
  });
});
