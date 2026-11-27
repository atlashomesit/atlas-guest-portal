/**
 * PAY-053: Per-booking Razorpay Smart Collect virtual bank account card (NEFT / RTGS / IMPS).
 * Displayed on `/pay/:token` (and guest checkout/booking pages) when the host has generated a dedicated virtual account.
 * Transfers are auto-reconciled by webhook — no screenshot needed.
 */
import React, { useState } from 'react';

export interface VirtualBankAccount {
  accountNumber: string;
  ifsc: string;
  beneficiaryName: string;
  bankName?: string | null;
  expiresAtUtc?: string | null;
  amountExpectedInr?: number | null;
  status?: string | null;
}

interface Props {
  account: VirtualBankAccount;
  currency?: string;
}

function formatInr(amount: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `₹${amount}`;
  }
}

export const VirtualBankAccountCard: React.FC<Props> = ({ account, currency = 'INR' }) => {
  const [copiedField, setCopiedField] = useState<'account' | 'ifsc' | 'all' | null>(null);

  const copyText = async (text: string, field: 'account' | 'ifsc' | 'all') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField((cur) => (cur === field ? null : cur)), 2000);
    } catch {
      setCopiedField(null);
    }
  };

  const allDetailsText = [
    `Beneficiary: ${account.beneficiaryName}`,
    `Account Number: ${account.accountNumber}`,
    `IFSC: ${account.ifsc}`,
    account.bankName ? `Bank: ${account.bankName}` : null,
    typeof account.amountExpectedInr === 'number' && account.amountExpectedInr > 0
      ? `Amount: ${formatInr(account.amountExpectedInr, currency)}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <section
      className="mt-4 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-800"
      aria-labelledby="va-card-title"
      data-testid="virtual-bank-account-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="va-card-title" className="text-base font-semibold text-stone-900">
          Pay via Bank Transfer (NEFT / RTGS / IMPS)
        </h2>
        <button
          type="button"
          onClick={() => void copyText(allDetailsText, 'all')}
          className="rounded-md border border-stone-300 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-800 hover:bg-stone-100"
          data-testid="va-copy-all"
        >
          {copiedField === 'all' ? 'Copied all' : 'Copy all details'}
        </button>
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <dt className="text-stone-600">Beneficiary</dt>
          <dd className="font-medium text-stone-900" data-testid="va-beneficiary">
            {account.beneficiaryName}
          </dd>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <dt className="text-stone-600">Account Number</dt>
          <dd className="flex items-center gap-2">
            <code className="rounded bg-stone-100 px-2 py-0.5 font-mono text-stone-900" data-testid="va-account-number">
              {account.accountNumber}
            </code>
            <button
              type="button"
              onClick={() => void copyText(account.accountNumber, 'account')}
              className="rounded-md border border-stone-300 bg-white px-2 py-0.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
              data-testid="va-copy-account"
            >
              {copiedField === 'account' ? 'Copied' : 'Copy'}
            </button>
          </dd>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <dt className="text-stone-600">IFSC Code</dt>
          <dd className="flex items-center gap-2">
            <code className="rounded bg-stone-100 px-2 py-0.5 font-mono text-stone-900" data-testid="va-ifsc">
              {account.ifsc}
            </code>
            <button
              type="button"
              onClick={() => void copyText(account.ifsc, 'ifsc')}
              className="rounded-md border border-stone-300 bg-white px-2 py-0.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
              data-testid="va-copy-ifsc"
            >
              {copiedField === 'ifsc' ? 'Copied' : 'Copy'}
            </button>
          </dd>
        </div>

        {account.bankName && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-stone-600">Bank</dt>
            <dd className="font-medium text-stone-900" data-testid="va-bank-name">
              {account.bankName}
            </dd>
          </div>
        )}

        {typeof account.amountExpectedInr === 'number' && account.amountExpectedInr > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-stone-600">Amount</dt>
            <dd className="font-semibold text-stone-900" data-testid="va-amount">
              {formatInr(account.amountExpectedInr, currency)}
            </dd>
          </div>
        )}
      </dl>

      <p className="mt-3 text-xs text-stone-600">
        Transfers to this dedicated booking account are matched automatically — no screenshot needed.
      </p>
    </section>
  );
};
