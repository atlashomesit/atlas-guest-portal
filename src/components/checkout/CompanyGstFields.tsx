import React from 'react';
import { Receipt } from 'lucide-react';
import { normalizeGstin } from '@/utils/gstin';

export interface CompanyGstFieldsProps {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  companyName: string;
  onCompanyNameChange: (val: string) => void;
  guestGstin: string;
  onGuestGstinChange: (val: string) => void;
  companyNameError?: string;
  gstinError?: string;
}

/**
 * GUEST-084: Collapsible B2B GST tax invoice fields on GuestDetailsPage.
 */
export const CompanyGstFields: React.FC<CompanyGstFieldsProps> = ({
  enabled,
  onToggle,
  companyName,
  onCompanyNameChange,
  guestGstin,
  onGuestGstinChange,
  companyNameError,
  gstinError,
}) => {
  return (
    <div
      className="rounded-2xl border border-border-subtle bg-bg-surface p-4 mb-4"
      data-testid="checkout-company-gst-section"
    >
      <label className="flex items-center justify-between gap-3 cursor-pointer">
        <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Receipt className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
          Need a GST invoice for your company?
        </span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 rounded border-border-strong accent-accent-primary"
          data-testid="checkout-gst-toggle"
        />
      </label>

      {enabled && (
        <div className="mt-3 pt-3 border-t border-border-subtle space-y-3" data-testid="checkout-gst-fields">
          <div>
            <label htmlFor="gd-company-name" className="block text-xs font-medium text-text-secondary mb-1">
              Company name
            </label>
            <input
              id="gd-company-name"
              type="text"
              maxLength={120}
              placeholder="e.g. Acme Technologies Pvt Ltd"
              value={companyName}
              onChange={(e) => onCompanyNameChange(e.target.value)}
              className="gd-input w-full"
              data-testid="checkout-company-name-input"
            />
            {companyNameError && (
              <p className="mt-1 text-xs text-red-600" role="alert" data-testid="checkout-company-name-error">
                {companyNameError}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="gd-company-gstin" className="block text-xs font-medium text-text-secondary mb-1">
              Company GSTIN (15 characters)
            </label>
            <input
              id="gd-company-gstin"
              type="text"
              maxLength={15}
              placeholder="29ABCDE1234F1Z5"
              value={guestGstin}
              onChange={(e) => onGuestGstinChange(normalizeGstin(e.target.value))}
              className="gd-input w-full uppercase font-mono tracking-wide"
              data-testid="checkout-gstin-input"
            />
            {gstinError && (
              <p className="mt-1 text-xs text-red-600" role="alert" data-testid="checkout-gstin-error">
                {gstinError}
              </p>
            )}
            <p className="mt-1 text-[11px] text-text-muted">
              Printed on your B2B GST tax invoice for input tax credit (ITC).
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
