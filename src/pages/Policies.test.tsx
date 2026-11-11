import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Policies from './Policies';
import Footer from '../components/commonComponents/footer/Footer';
import { policySections } from '../content/legal/policies';

vi.mock('../tenant/displayBrand', () => ({
  getTenantBrandName: () => 'Atlastays',
  MARKETPLACE_BRAND_BASELINE: 'Atlastays',
}));

describe('Policies page', () => {
  const renderPage = () => render(
    <MemoryRouter>
      <Policies />
    </MemoryRouter>
  );

  it('renders the page title for policies', () => {
    renderPage();
    // TASK-4304: visible H1 is the human heading only ("Guest Policies"); the " | <brand>"
    // suffix lives in the document <title> (SEO), not the on-page heading.
    expect(screen.getByRole('heading', { name: /^Guest Policies$/i })).toBeInTheDocument();
  });

  it('shows all sections in the section nav', () => {
    renderPage();
    policySections.forEach((section) => {
      expect(screen.getByRole('link', { name: section.title })).toBeInTheDocument();
    });
  });

  it('provides anchors for each section target', async () => {
    // SectionNav moves focus and scrolls from a requestAnimationFrame callback after the click. Fake
    // timers let the test own that frame: it runs inside this test, not after it has ended.
    vi.useFakeTimers();
    try {
      const { container } = renderPage();
      const target = container.querySelector<HTMLElement>(`#${policySections[0].id}`);
      expect(target).not.toBeNull();
      // jsdom does not implement scrollIntoView. Without this stub the frame callback throws and
      // vitest fails the whole run on an unhandled error (exit 1) although every test passed.
      const scrollIntoView = vi.fn();
      target!.scrollIntoView = scrollIntoView;

      fireEvent.click(screen.getByRole('link', { name: policySections[0].title }));
      await vi.advanceTimersByTimeAsync(16);

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
      expect(target).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders a stable anchor list snapshot', () => {
    const { container } = renderPage();
    const anchors = Array.from(
      container.querySelectorAll('nav[aria-label="Section navigation"] a')
    ).map((link) => link.textContent);

    expect(anchors).toMatchInlineSnapshot(`
      [
        "Cancellation & Refunds",
        "Reschedules & Date Changes",
        "Check-in & Check-out",
        "Guests, Extra Guests & Visitors",
        "House Rules & Community Etiquette",
        "Amenity Usage (Jacuzzi, Lift, Parking, Home Theatre)",
        "Damages, Deposits & Incidentals",
        "Compliance, Safety & Liability",
      ]
    `);
  });
});

describe('Policies links in footer', () => {
  it('contains quick links to policy anchors', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    const policyLinks = screen.getAllByText('Policies').map((node) => node.closest('a'));
    expect(policyLinks.some((link) => link?.getAttribute('href') === '/policies')).toBe(true);

    const faqLinks = screen.getAllByText('FAQs').map((node) => node.closest('a'));
    expect(faqLinks.some((link) => link?.getAttribute('href') === '/faq')).toBe(true);

    const termsLinks = screen.getAllByText('Terms').map((node) => node.closest('a'));
    expect(termsLinks.some((link) => link?.getAttribute('href') === '/terms')).toBe(true);
  });
});
