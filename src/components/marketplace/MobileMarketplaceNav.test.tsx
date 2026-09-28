import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import MobileMarketplaceNav from '@/components/marketplace/MobileMarketplaceNav';

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <MobileMarketplaceNav />
    </MemoryRouter>,
  );
}

describe('MobileMarketplaceNav (TASK-102165)', () => {
  it('renders the four marketplace tabs with the expected destinations', () => {
    renderAt('/');

    expect(screen.getByTestId('marketplace-bottom-nav-explore')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('marketplace-bottom-nav-wishlists')).toHaveAttribute('href', '/favorites');
    expect(screen.getByTestId('marketplace-bottom-nav-bookings')).toHaveAttribute('href', '/my-bookings');
    expect(screen.getByTestId('marketplace-bottom-nav-support')).toHaveAttribute('href', '/contact');
  });

  it('highlights the active tab with the brand accent and aria-current', () => {
    renderAt('/favorites');

    const active = screen.getByTestId('marketplace-bottom-nav-wishlists');
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active.className).toMatch(/text-accent-primary/);

    const inactive = screen.getByTestId('marketplace-bottom-nav-explore');
    expect(inactive).not.toHaveAttribute('aria-current');
    expect(inactive.className).toMatch(/text-text-muted/);
  });

  it('is mobile-only (hidden at md breakpoint and up)', () => {
    renderAt('/');
    expect(screen.getByTestId('marketplace-bottom-nav').className).toMatch(/md:hidden/);
  });
});
