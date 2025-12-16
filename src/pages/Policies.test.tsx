import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import Policies from './Policies';
import Footer from '../components/commonComponents/footer/Footer';

const sectionTitles = [
  'Cancellation & Refund Policy',
  'Reschedule / Date Change Policy',
  'Check-In & Check-Out Policy',
  'Extra Guests & Visitors Policy',
  'House Rules',
  'Damage, Penalties & Security Deposit',
  'Amenity Usage Policy (Jacuzzi / Home Theater / Lift / Parking)',
  'Payment Terms',
  'ID Verification & Local Law Compliance',
  'Liability & Disclaimer',
];

describe('Policies page', () => {
  const renderPage = () => render(
    <MemoryRouter>
      <Policies />
    </MemoryRouter>
  );

  it('renders the page title for policies', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /ATLAS HOMESTAYS – POLICIES/i })).toBeInTheDocument();
  });

  it('shows all sections in the table of contents', () => {
    renderPage();
    sectionTitles.forEach((title) => {
      expect(screen.getByRole('link', { name: title })).toBeInTheDocument();
    });
  });

  it('provides anchors for each section target', () => {
    const { container } = renderPage();
    const firstLink = screen.getByRole('link', { name: sectionTitles[0] });
    fireEvent.click(firstLink);
    expect(container.querySelector('#cancellation-refund-policy')).not.toBeNull();
  });
});

describe('Policies links in footer', () => {
  it('contains quick links to policy anchors', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByText('Policies').closest('a')).toHaveAttribute('href', '/policies');
    expect(screen.getByText('Cancellation Policy').closest('a')).toHaveAttribute(
      'href',
      '/policies#cancellation-refund-policy'
    );
    expect(screen.getByText('House Rules').closest('a')).toHaveAttribute('href', '/policies#house-rules');
  });
});
