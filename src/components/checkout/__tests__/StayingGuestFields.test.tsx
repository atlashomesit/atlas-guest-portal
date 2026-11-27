import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StayingGuestFields, validateStayingGuestInput } from '@/components/checkout/StayingGuestFields';

describe('GUEST-085: Staying guest fields at checkout', () => {
  it('validates staying guest name, phone, and optional email', () => {
    const bad = validateStayingGuestInput({ name: '', phone: '123', email: 'not-an-email' });
    expect(bad.nameError).toBeTruthy();
    expect(bad.phoneError).toBeTruthy();
    expect(bad.emailError).toBeTruthy();

    const ok = validateStayingGuestInput({ name: 'Priya Sharma', phone: '+919876543210', email: '' });
    expect(ok.nameError).toBeUndefined();
    expect(ok.phoneError).toBeUndefined();
    expect(ok.emailError).toBeUndefined();
  });

  it('toggles staying guest inputs cleanly', () => {
    const onToggle = vi.fn();
    const onName = vi.fn();
    const { rerender } = render(
      <StayingGuestFields
        enabled={false}
        onToggle={onToggle}
        name=""
        onNameChange={onName}
        phone=""
        onPhoneChange={vi.fn()}
        email=""
        onEmailChange={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('checkout-staying-guest-fields')).toBeNull();
    fireEvent.click(screen.getByTestId('checkout-staying-guest-toggle'));
    expect(onToggle).toHaveBeenCalledWith(true);

    rerender(
      <StayingGuestFields
        enabled={true}
        onToggle={onToggle}
        name=""
        onNameChange={onName}
        phone=""
        onPhoneChange={vi.fn()}
        email=""
        onEmailChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('checkout-staying-guest-fields')).toBeTruthy();
    fireEvent.change(screen.getByTestId('checkout-staying-guest-name'), { target: { value: 'Priya Sharma' } });
    expect(onName).toHaveBeenCalledWith('Priya Sharma');
  });
});
