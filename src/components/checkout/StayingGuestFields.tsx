import React from 'react';
import { UserPlus } from 'lucide-react';

export interface StayingGuestFieldsProps {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  name: string;
  onNameChange: (val: string) => void;
  phone: string;
  onPhoneChange: (val: string) => void;
  email: string;
  onEmailChange: (val: string) => void;
  nameError?: string;
  phoneError?: string;
  emailError?: string;
}

export function validateStayingGuestInput(args: {
  name: string;
  phone: string;
  email: string;
}): { nameError?: string; phoneError?: string; emailError?: string } {
  const errors: { nameError?: string; phoneError?: string; emailError?: string } = {};
  const trimmedName = args.name.trim();
  const trimmedPhone = args.phone.trim();
  const trimmedEmail = args.email.trim();

  if (!trimmedName || trimmedName.length < 2) {
    errors.nameError = 'Enter the staying guest’s full name.';
  }

  const digits = trimmedPhone.replace(/\D/g, '');
  if (!trimmedPhone || digits.length < 8 || digits.length > 15) {
    errors.phoneError = 'Enter a valid phone number (e.g. +919876543210).';
  }

  if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.emailError = 'Enter a valid email address or leave blank.';
  }

  return errors;
}

/**
 * GUEST-085: "I'm booking for someone else" toggle & staying-guest fields on GuestDetailsPage.
 */
export const StayingGuestFields: React.FC<StayingGuestFieldsProps> = ({
  enabled,
  onToggle,
  name,
  onNameChange,
  phone,
  onPhoneChange,
  email,
  onEmailChange,
  nameError,
  phoneError,
  emailError,
}) => {
  return (
    <div
      className="rounded-2xl border border-border-subtle bg-bg-surface p-4 mb-4"
      data-testid="checkout-staying-guest-section"
    >
      <label className="flex items-center justify-between gap-3 cursor-pointer">
        <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <UserPlus className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
          I&apos;m booking for someone else
        </span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 rounded border-border-strong accent-accent-primary"
          data-testid="checkout-staying-guest-toggle"
        />
      </label>

      {enabled && (
        <div className="mt-3 pt-3 border-t border-border-subtle space-y-3" data-testid="checkout-staying-guest-fields">
          <p className="text-xs text-text-secondary">
            You&apos;ll receive the payment receipt. The staying guest will receive check-in instructions, Wi-Fi, and arrival messages directly.
          </p>

          <div>
            <label htmlFor="gd-staying-guest-name" className="block text-xs font-medium text-text-secondary mb-1">
              Staying guest full name
            </label>
            <input
              id="gd-staying-guest-name"
              type="text"
              maxLength={120}
              placeholder="e.g. Priya Sharma"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="gd-input w-full"
              data-testid="checkout-staying-guest-name"
            />
            {nameError && (
              <p className="mt-1 text-xs text-red-600" role="alert" data-testid="checkout-staying-guest-name-error">
                {nameError}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="gd-staying-guest-phone" className="block text-xs font-medium text-text-secondary mb-1">
              Staying guest phone (with country code)
            </label>
            <input
              id="gd-staying-guest-phone"
              type="tel"
              maxLength={20}
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              className="gd-input w-full"
              data-testid="checkout-staying-guest-phone"
            />
            {phoneError && (
              <p className="mt-1 text-xs text-red-600" role="alert" data-testid="checkout-staying-guest-phone-error">
                {phoneError}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="gd-staying-guest-email" className="block text-xs font-medium text-text-secondary mb-1">
              Staying guest email (optional)
            </label>
            <input
              id="gd-staying-guest-email"
              type="email"
              maxLength={160}
              placeholder="priya@example.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              className="gd-input w-full"
              data-testid="checkout-staying-guest-email"
            />
            {emailError && (
              <p className="mt-1 text-xs text-red-600" role="alert" data-testid="checkout-staying-guest-email-error">
                {emailError}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
