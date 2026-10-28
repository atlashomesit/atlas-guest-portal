import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ReviewLocaleChip from './ReviewLocaleChip';

describe('ReviewLocaleChip (REV-041)', () => {
  it('shows a readable language label and keeps the raw code in the tooltip', () => {
    render(<ReviewLocaleChip locale="fr-FR" />);
    const chip = screen.getByTestId('review-locale-chip');
    expect(chip).toHaveTextContent('French (France)');
    expect(chip).toHaveAttribute('title', 'fr-FR');
    expect(chip).toHaveAttribute('lang', 'en');
  });

  it('falls back to the raw code when the language is not known', () => {
    render(<ReviewLocaleChip locale="zz-ZZ" />);
    expect(screen.getByTestId('review-locale-chip')).toHaveTextContent('zz-ZZ');
  });

  it('renders nothing for a missing or malformed locale, and never injects markup', () => {
    const { container, rerender } = render(<ReviewLocaleChip locale={null} />);
    expect(container.firstChild).toBeNull();
    rerender(<ReviewLocaleChip locale="   " />);
    expect(container.firstChild).toBeNull();
    rerender(<ReviewLocaleChip locale={'<img src=x onerror=alert(1)>'} />);
    expect(container.firstChild).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});
