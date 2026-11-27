import React from 'react';

export interface BlockedGuestErrorPayload {
  code?: string;
  errorCode?: string;
  message?: string;
  hostPhone?: string;
  hostEmail?: string;
  propertyName?: string;
}

const BLOCKED_CODES = new Set([
  'GUEST_BLOCKED',
  'DO_NOT_RENT',
  'GUEST_BANNED',
  'BLOCKED_GUEST',
]);

export function isBlockedGuestError(
  status?: number,
  payload?: BlockedGuestErrorPayload | null
): boolean {
  const code = (payload?.code || payload?.errorCode || '').toUpperCase().trim();
  if (BLOCKED_CODES.has(code)) return true;
  if (status === 403 && payload?.message && /do[- ]not[- ]rent|unable to complete|restricted/i.test(payload.message)) {
    return true;
  }
  return false;
}

export interface BlockedGuestNoticeProps {
  propertyName?: string;
  hostPhone?: string;
  hostEmail?: string;
  onDismiss?: () => void;
}

export const BlockedGuestNotice: React.FC<BlockedGuestNoticeProps> = ({
  propertyName = 'this property',
  hostPhone,
  hostEmail,
  onDismiss,
}) => {
  return (
    <div
      role="alert"
      data-testid="blocked-guest-notice"
      className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm"
    >
      <p className="font-semibold text-amber-900">
        Online booking is currently unavailable for these details
      </p>
      <p className="mt-1 text-amber-800">
        We could not complete an instant online reservation at {propertyName}. Please contact the host directly to confirm availability.
      </p>
      {(hostPhone || hostEmail) && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium">
          {hostPhone && (
            <a
              href={`tel:${hostPhone.replace(/\s+/g, '')}`}
              className="rounded-lg bg-amber-900 px-3 py-1.5 text-white hover:bg-amber-800"
            >
              Call host ({hostPhone})
            </a>
          )}
          {hostEmail && (
            <a
              href={`mailto:${hostEmail}`}
              className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-amber-900 hover:bg-amber-100"
            >
              Email host
            </a>
          )}
        </div>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="mt-3 text-xs underline text-amber-900 hover:text-amber-700"
        >
          Back to stay details
        </button>
      )}
    </div>
  );
};
