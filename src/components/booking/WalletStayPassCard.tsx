import React from 'react';

export interface WalletStayPassProps {
  bookingCode: string;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  googleWalletUrl?: string | null;
  applePassUrl?: string | null;
}

export function buildWalletPassFallbackPayload(props: WalletStayPassProps) {
  return {
    type: 'atlas_offline_stay_pass',
    bookingCode: props.bookingCode,
    propertyName: props.propertyName,
    guestName: props.guestName,
    checkInDate: props.checkInDate,
    checkOutDate: props.checkOutDate,
  };
}

export const WalletStayPassCard: React.FC<WalletStayPassProps> = (props) => {
  const { bookingCode, propertyName, googleWalletUrl, applePassUrl } = props;
  const fallbackHref = `data:application/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(buildWalletPassFallbackPayload(props), null, 2)
  )}`;

  return (
    <div
      data-testid="wallet-stay-pass-card"
      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
    >
      <p className="text-sm font-semibold text-slate-900">
        Save Offline Stay Pass
      </p>
      <p className="mt-0.5 text-xs text-slate-600">
        Keep {propertyName} ({bookingCode}) handy in your phone wallet even without signal.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={googleWalletUrl || fallbackHref}
          download={googleWalletUrl ? undefined : `stay-pass-${bookingCode}.json`}
          target={googleWalletUrl ? '_blank' : undefined}
          rel={googleWalletUrl ? 'noopener noreferrer' : undefined}
          data-testid="save-google-wallet-link"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Add to Google Wallet
        </a>
        <a
          href={applePassUrl || fallbackHref}
          download={applePassUrl ? `stay-pass-${bookingCode}.pkpass` : `stay-pass-${bookingCode}.json`}
          data-testid="save-apple-wallet-link"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100"
        >
          Add to Apple Wallet (.pkpass)
        </a>
      </div>
    </div>
  );
};
