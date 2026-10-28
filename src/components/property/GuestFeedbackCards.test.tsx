/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import GuestFeedbackSection from './GuestFeedbackCards';
import { normalizeGuestFeedback } from './guestFeedback';

afterEach(() => cleanup());

const cards = (count: number) =>
  normalizeGuestFeedback(
    Array.from({ length: count }, (_, index) => ({
      guestName: `Guest${index} Surname`,
      rating: index % 2 === 0 ? 5 : 4,
      comment: `Note number ${index}`,
      date: `2026-10-${String(28 - index).padStart(2, '0')}`,
      label: 'Guest feedback',
    })),
  );

describe('GuestFeedbackSection (REV-046)', () => {
  it('renders nothing when there is no guest feedback', () => {
    const { container } = render(<GuestFeedbackSection items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders each note as a card labelled "Guest feedback" with first name, stars, note and month', () => {
    render(
      <GuestFeedbackSection
        items={normalizeGuestFeedback([
          { guestName: 'Asha Rao', rating: 5, comment: 'Lovely garden breakfast', date: '2026-10-28', label: 'Guest feedback' },
        ])}
      />,
    );

    const section = screen.getByTestId('guest-feedback-section');
    expect(within(section).getByRole('heading', { level: 2, name: 'Guest feedback' })).toBeInTheDocument();

    const [card] = screen.getAllByTestId('guest-feedback-card');
    expect(within(card).getByTestId('guest-feedback-label')).toHaveTextContent('Guest feedback');
    expect(within(card).getByText('Asha')).toBeInTheDocument();
    expect(within(card).queryByText('Asha Rao')).not.toBeInTheDocument();
    expect(within(card).getByText('Lovely garden breakfast')).toBeInTheDocument();
    expect(within(card).getByLabelText('5 out of 5 stars')).toHaveTextContent('★★★★★');
    expect(within(card).getByText('October 2026')).toBeInTheDocument();
    expect(card.querySelector('time')).toHaveAttribute('datetime', '2026-10-28');
  });

  it('shows four stars as four filled and one empty', () => {
    render(
      <GuestFeedbackSection
        items={normalizeGuestFeedback([{ guestName: 'Ravi', rating: 4, comment: 'Good', date: '2026-10-01' }])}
      />,
    );
    expect(screen.getByLabelText('4 out of 5 stars')).toHaveTextContent('★★★★☆');
  });

  it('has no verified-stay badge and no source logo', () => {
    render(<GuestFeedbackSection items={cards(3)} />);

    const section = screen.getByTestId('guest-feedback-section');
    expect(section).not.toHaveTextContent(/verified/i);
    expect(section.querySelector('.pp-review-verified')).toBeNull();
    for (const source of ['Google', 'Airbnb', 'Booking']) {
      expect(section).not.toHaveTextContent(source);
    }
    expect(section.querySelector('img')).toBeNull();
    expect(screen.getAllByTestId('guest-feedback-label')).toHaveLength(3);
  });

  it('says in words that these notes are outside the star rating, without printing any count', () => {
    render(<GuestFeedbackSection items={cards(2)} />);
    const section = screen.getByTestId('guest-feedback-section');
    expect(section).toHaveTextContent('Notes shared by guests. These are not part of the star rating.');
    expect(section.textContent ?? '').not.toMatch(/\b\d+\s+(reviews?|guests?|notes?)\b/i);
  });

  it('shows six, then the rest on request, with a toggle that carries no count', () => {
    render(<GuestFeedbackSection items={cards(9)} />);

    expect(screen.getAllByTestId('guest-feedback-card')).toHaveLength(6);
    const toggle = screen.getByTestId('guest-feedback-toggle');
    expect(toggle).toHaveTextContent('Show more guest feedback');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(screen.getAllByTestId('guest-feedback-card')).toHaveLength(9);
    expect(screen.getByTestId('guest-feedback-toggle')).toHaveTextContent('Show less guest feedback');

    fireEvent.click(screen.getByTestId('guest-feedback-toggle'));
    expect(screen.getAllByTestId('guest-feedback-card')).toHaveLength(6);
  });

  it('has no toggle for six or fewer', () => {
    render(<GuestFeedbackSection items={cards(6)} />);
    expect(screen.queryByTestId('guest-feedback-toggle')).not.toBeInTheDocument();
  });

  it('uses a neutral initial for a guest who left no name', () => {
    render(
      <GuestFeedbackSection
        items={normalizeGuestFeedback([{ guestName: null, rating: 5, comment: 'Peaceful', date: '2026-10-01' }])}
      />,
    );
    const [card] = screen.getAllByTestId('guest-feedback-card');
    expect(within(card).getByText('A guest')).toBeInTheDocument();
    expect(card.querySelector('.pp-v2-review-avatar')).toHaveTextContent('G');
  });
});
