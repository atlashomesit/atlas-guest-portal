/**
 * HSL-034: Age-restricted dorms (e.g. DormMinAge = 18) require the guest to confirm that every
 * sleeper meets the minimum age rule before Razorpay checkout, and optionally validate the
 * youngest guest's date of birth to block underage dorm bookings with a plain-English message.
 */
import React from 'react';
import { ageYearsFromDob, dormNeedsAgeAcknowledgement, formatDormMinAgeBadge } from '@/utils/dormListing';

export interface DormAgeAcknowledgementProps {
  dormMinAge: number | null | undefined;
  accepted: boolean;
  onChange: (next: boolean) => void;
  /** Optional youngest guest DOB (YYYY-MM-DD) for explicit underage check. */
  youngestDob?: string;
  onYoungestDobChange?: (dob: string) => void;
  /** Link to view private rooms at the same property. */
  privateRoomsHref?: string | null;
  /** Shown under the checkbox when the guest tried to pay without ticking or is underage. */
  error?: string;
}

export const DormAgeAcknowledgement: React.FC<DormAgeAcknowledgementProps> = ({
  dormMinAge,
  accepted,
  onChange,
  youngestDob = '',
  onYoungestDobChange,
  privateRoomsHref,
  error,
}) => {
  if (!dormNeedsAgeAcknowledgement(dormMinAge)) return null;
  const minAge = dormMinAge!;
  const inputId = 'gd-dorm-age-ack';
  const dobId = 'gd-dorm-youngest-dob';
  const computedAge = youngestDob ? ageYearsFromDob(youngestDob) : null;
  const isUnderage = computedAge != null && computedAge < minAge;
  const badgeLabel = formatDormMinAgeBadge(minAge);

  return (
    <section className="gd-rules" aria-labelledby={`${inputId}-title`} data-testid="dorm-age-ack-card">
      <h3 id={`${inputId}-title`} className="gd-rules-title">
        {minAge}+ age rule for this dorm
      </h3>
      <p className="gd-rules-text" data-testid="dorm-age-ack-text">
        {badgeLabel}. Children and infants cannot stay in shared dorm beds.
        {privateRoomsHref && (
          <>
            {' '}
            <a
              href={privateRoomsHref}
              className="underline font-semibold"
              data-testid="dorm-age-private-rooms-link"
            >
              View private rooms
            </a>
          </>
        )}
      </p>

      {onYoungestDobChange && (
        <div className="mb-3">
          <label htmlFor={dobId} className="block text-xs font-medium text-neutral-700 mb-1">
            Youngest guest date of birth (optional check)
          </label>
          <input
            id={dobId}
            type="date"
            value={youngestDob}
            onChange={(e) => onYoungestDobChange(e.target.value)}
            aria-invalid={isUnderage}
            data-testid="dorm-youngest-dob-input"
            className="w-full sm:w-56 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
          />
          {isUnderage && (
            <div className="gd-input-help error mt-1" role="alert" data-testid="dorm-age-underage-error">
              Guests under {minAge} cannot stay in this shared dorm (age {computedAge}). Please book a private room instead.
            </div>
          )}
        </div>
      )}

      <div className={`gd-consent-row required${accepted ? ' checked' : ''}`} data-testid="dorm-age-ack-row">
        <input
          id={inputId}
          type="checkbox"
          checked={accepted}
          disabled={isUnderage}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={Boolean(error) || isUnderage}
          aria-describedby={error ? `${inputId}-error` : undefined}
          data-testid="dorm-age-ack-checkbox"
        />
        <div className="gd-consent-body">
          <label htmlFor={inputId}>
            I confirm every guest on this booking is at least {minAge} years old.
          </label>
          <span className="gd-consent-tag">Required before you pay</span>
        </div>
      </div>

      {error && !isUnderage && (
        <div id={`${inputId}-error`} className="gd-input-help error" role="alert" data-testid="dorm-age-ack-error">
          {error}
        </div>
      )}
    </section>
  );
};

export default DormAgeAcknowledgement;
