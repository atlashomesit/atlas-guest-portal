import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BookDirectPerks from './BookDirectPerks';

describe('BookDirectPerks (GUEST-101)', () => {
  it('states the direct-booking fee without a percentage and spaces its two parts', () => {
    render(<BookDirectPerks />);
    const box = screen.getByTestId('book-direct-perks');
    expect(box.textContent).toContain('Zero OTA guest service fee — pay the host directly');
    expect(box.textContent).not.toMatch(/15%/);
    expect(box.textContent).toContain('Direct host communication & priority check-in assistance');
  });
});
