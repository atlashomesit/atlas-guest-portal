import React from 'react';

export interface PaymentMethodDowntimeNotice {
  method: 'UPI' | 'CARD' | 'NETBANKING';
  issuerName: string;
  severity: 'degraded' | 'down';
  recommendedAlternative: string;
}

export interface PaymentDowntimeBannerProps {
  incidents: PaymentMethodDowntimeNotice[];
  onSelectAlternative?: (alternative: string) => void;
}

export const PaymentDowntimeBanner: React.FC<PaymentDowntimeBannerProps> = ({
  incidents,
  onSelectAlternative,
}) => {
  if (!incidents.length) return null;
  const primary = incidents[0];

  return (
    <div
      role="status"
      data-testid="payment-downtime-banner"
      className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950"
    >
      <p className="font-semibold text-amber-900">
        {primary.issuerName} ({primary.method}) is experiencing{' '}
        {primary.severity === 'down' ? 'an outage' : 'high failure rates'} right now
      </p>
      <p className="mt-1 text-amber-800">
        For instant confirmation, we recommend paying via{' '}
        <span className="font-semibold">{primary.recommendedAlternative}</span>.
      </p>
      {onSelectAlternative && (
        <button
          type="button"
          onClick={() => onSelectAlternative(primary.recommendedAlternative)}
          className="mt-2 rounded-lg bg-amber-900 px-3 py-1.5 font-semibold text-white hover:bg-amber-800"
        >
          Switch to {primary.recommendedAlternative}
        </button>
      )}
    </div>
  );
};
