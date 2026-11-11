/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, test } from 'vitest';
import ListingHouseRules from './ListingHouseRules';

describe('ListingHouseRules (GUEST-069)', () => {
  test('shows the host rules as chips and text under a House rules heading', () => {
    render(
      <ListingHouseRules
        houseRulesText={'No loud music after 10 pm.\nShoes off inside.'}
        houseRulesStructured={'{"smoking":false,"pets":true,"quietHoursStart":"22:00","quietHoursEnd":"08:00"}'}
      />,
    );
    expect(screen.getByRole('heading', { name: 'House rules' })).toBeInTheDocument();
    expect(screen.getByTestId('listing-house-rules-text')).toHaveTextContent('No loud music after 10 pm.');
    const chips = screen.getByTestId('listing-house-rules-chips').textContent ?? '';
    expect(chips).toContain('No smoking');
    expect(chips).toContain('Pets allowed');
    expect(chips).toContain('Quiet hours 22:00 to 08:00');
  });

  test('renders nothing when the host wrote no rules (no empty block)', () => {
    const { container } = render(<ListingHouseRules houseRulesText="   " houseRulesStructured={null} houseRulesPdfUrl={null} googleMapsUrl="https://maps.app.goo.gl/x" />);
    expect(container).toBeEmptyDOMElement();
  });

  test('a long rule text is collapsed behind Read all the rules and expands', () => {
    const long = 'A rule. '.repeat(80);
    render(<ListingHouseRules houseRulesText={long} />);
    const toggle = screen.getByTestId('listing-house-rules-toggle');
    expect(toggle).toHaveTextContent('Read all the rules');
    expect(screen.getByTestId('listing-house-rules-text').textContent).toContain('…');
    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent('Show less');
    expect(screen.getByTestId('listing-house-rules-text').textContent).not.toContain('…');
  });

  test('offers the PDF and the host map link only as https links', () => {
    const { rerender } = render(
      <ListingHouseRules houseRulesText="Rules" houseRulesPdfUrl="https://files.example.com/rules.pdf" googleMapsUrl="https://maps.app.goo.gl/AbCd" />,
    );
    expect(screen.getByTestId('listing-house-rules-pdf')).toHaveAttribute('href', 'https://files.example.com/rules.pdf');
    expect(screen.getByTestId('listing-host-map-link')).toHaveAttribute('href', 'https://maps.app.goo.gl/AbCd');
    expect(screen.getByTestId('listing-host-map-link')).toHaveAttribute('rel', 'noopener noreferrer');

    rerender(<ListingHouseRules houseRulesText="Rules" houseRulesPdfUrl="javascript:alert(1)" googleMapsUrl="http://maps.google.com/?q=1,2" />);
    expect(screen.queryByTestId('listing-house-rules-pdf')).not.toBeInTheDocument();
    expect(screen.queryByTestId('listing-host-map-link')).not.toBeInTheDocument();
  });

  test('a PDF alone is enough to show the block', () => {
    render(<ListingHouseRules houseRulesPdfUrl="https://files.example.com/rules.pdf" />);
    expect(screen.getByTestId('listing-house-rules')).toBeInTheDocument();
  });
});
