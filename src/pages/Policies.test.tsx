import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import Policies from './Policies';
import Footer from '../components/commonComponents/footer/Footer';
import { policySections } from '../content/legal/policies';

describe('Policies page', () => {
  const renderPage = () => render(
    <MemoryRouter>
      <Policies />
    </MemoryRouter>
  );

  it('renders the page title for policies', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Guest Policies \| Atlas Guest Portal/i })).toBeInTheDocument();
  });

  it('shows all sections in the section nav', () => {
    renderPage();
    policySections.forEach((section) => {
      expect(screen.getByRole('link', { name: section.title })).toBeInTheDocument();
    });
  });

  it('provides anchors for each section target', () => {
    const { container } = renderPage();
    const firstLink = screen.getByRole('link', { name: policySections[0].title });
    fireEvent.click(firstLink);
    expect(container.querySelector(`#${policySections[0].id}`)).not.toBeNull();
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
