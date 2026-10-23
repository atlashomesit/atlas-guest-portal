/**
 * HSL-011: women-only / men-only dorms make the guest tick "everyone in this booking fits the rule" before Pay.
 * Controlled by the checkout page (same shape as HouseRulesAcceptance). Renders NOTHING for a mixed dorm, a
 * non-dorm listing, or a dorm whose policy the API did not state.
 *
 * The copy states the rule only. It makes NO refund or cancellation claim: the ruled cancellation policy is the
 * listing's own (Strict 7-day), shown elsewhere on the page.
 */
import React from 'react';
import { dormNeedsGenderAcknowledgement, type DormGenderPolicy } from '@/utils/dormListing';

interface Props {
  policy: DormGenderPolicy | null | undefined;
  accepted: boolean;
  onChange: (next: boolean) => void;
  /** Shown under the checkbox when the guest tried to pay without ticking. */
  error?: string;
}

export const DormGenderAcknowledgement: React.FC<Props> = ({ policy, accepted, onChange, error }) => {
  if (!dormNeedsGenderAcknowledgement(policy)) return null;
  const women = policy === 'FemaleOnly';
  const who = women ? 'women' : 'men';
  const inputId = 'gd-dorm-gender-ack';

  return (
    <section className="gd-rules" aria-labelledby={`${inputId}-title`} data-testid="dorm-gender-ack-card">
      <h3 id={`${inputId}-title`} className="gd-rules-title">
        {women ? 'Women-only dorm' : 'Men-only dorm'}
      </h3>
      <p className="gd-rules-text" data-testid="dorm-gender-ack-text">
        This dorm is for {who} only. Every guest on this booking must be {women ? 'a woman' : 'a man'}.
      </p>
      <div className={`gd-consent-row required${accepted ? ' checked' : ''}`} data-testid="dorm-gender-ack-row">
        <input
          id={inputId}
          type="checkbox"
          checked={accepted}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          data-testid="dorm-gender-ack-checkbox"
        />
        <div className="gd-consent-body">
          <label htmlFor={inputId}>I confirm every guest on this booking is {women ? 'a woman' : 'a man'}.</label>
          <span className="gd-consent-tag">Required before you pay</span>
        </div>
      </div>
      {error && (
        <div id={`${inputId}-error`} className="gd-input-help error" role="alert">
          {error}
        </div>
      )}
    </section>
  );
};

export default DormGenderAcknowledgement;
