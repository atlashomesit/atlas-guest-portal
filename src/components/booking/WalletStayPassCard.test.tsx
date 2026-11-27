import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WalletStayPassCard } from './WalletStayPassCard';

describe('GUEST-092 WalletStayPassCard', () => {
  it('renders Google Wallet and Apple Wallet (.pkpass) links', () => {
    render(
      <WalletStayPassCard
        bookingCode="ATL-5520"
        propertyName="Ooty Mist Cottage"
        checkInDate="2026-12-10"
        checkOutDate="2026-12-12"
        guestName="Priya Nair"
        googleWalletUrl="https://pay.google.com/gp/v/save/test"
        applePassUrl="/api/bookings/ATL-5520/pass.pkpass"
      />
    );
    expect(screen.getByTestId('wallet-stay-pass-card')).toBeTruthy();
    expect(screen.getByTestId('save-google-wallet-link').getAttribute('href')).toContain('pay.google.com');
    expect(screen.getByTestId('save-apple-wallet-link').getAttribute('href')).toContain('pass.pkpass');
  });
});
