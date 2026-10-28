import React from 'react';
import { PAYMENT_METHOD_BADGES } from './paymentMethodBadges';

export interface GuestCheckoutPaymentBadgesProps {
  className?: string;
}

export const GuestCheckoutPaymentBadges: React.FC<GuestCheckoutPaymentBadgesProps> = ({ className }) => {
  return (
    <div
      className={`gd-pay-rail${className ? ` ${className}` : ''}`}
      data-testid="checkout-payment-rail-badges"
      aria-label="Supported payment methods"
    >
      <span className="gd-pay-rail-label">Pay with</span>
      <div className="gd-pay-rail-badges" role="list" aria-label="Available payment methods">
        {PAYMENT_METHOD_BADGES.map((badge) => (
          <span
            key={badge.id}
            role="listitem"
            className={`gd-pay-mark gd-pay-mark--${badge.id}${badge.id === 'razorpay' ? ' razorpay' : ''}`}
            aria-label={badge.label}
            data-testid={`payment-badge-${badge.id}`}
          >
            {badge.name}
          </span>
        ))}
      </div>
    </div>
  );
};

export default GuestCheckoutPaymentBadges;
