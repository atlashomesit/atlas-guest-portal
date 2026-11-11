/**
 * Founder ruling 2026-10-19: show the host's own house rules on the details step and require
 * "I accept the house rules" before Pay. Renders NOTHING when the host has written no rules — a listing with no
 * rules never blocks a booking on missing host data (the host is nudged in the admin portal instead).
 */
import React, { useState } from 'react';
import { parseStructuredHouseRules } from '@/utils/houseRules';

export interface HouseRulesInfo {
  hasHouseRules: boolean;
  houseRulesText: string | null;
  houseRulesPdfUrl: string | null;
  houseRulesStructuredJson: string | null;
  hostName: string | null;
}

interface Props {
  info: HouseRulesInfo | null;
  accepted: boolean;
  onChange: (next: boolean) => void;
  /** Shown under the checkbox when the guest tried to pay without ticking. */
  error?: string;
  /** `details` matches the GuestDetailsPage `.gd-*` look; `embed` uses the embed widget's utility classes. */
  variant?: 'details' | 'embed';
}

/** Rules longer than this are collapsed behind "Read all the rules" so the Pay button stays within reach. */
const COLLAPSE_AT_CHARS = 320;

export const HouseRulesAcceptance: React.FC<Props> = ({ info, accepted, onChange, error, variant = 'details' }) => {
  const [expanded, setExpanded] = useState(false);
  if (!info || !info.hasHouseRules) return null;

  const chips = parseStructuredHouseRules(info.houseRulesStructuredJson);
  const text = (info.houseRulesText ?? '').trim();
  const long = text.length > COLLAPSE_AT_CHARS;
  const shown = long && !expanded ? `${text.slice(0, COLLAPSE_AT_CHARS).trimEnd()}…` : text;
  const host = info.hostName?.trim();
  const inputId = variant === 'embed' ? 'embed-house-rules' : 'gd-house-rules';
  const isEmbed = variant === 'embed';

  return (
    <section
      className={isEmbed ? 'mb-3 rounded-lg border border-border-subtle p-3 text-sm' : 'gd-rules'}
      aria-labelledby={`${inputId}-title`}
      data-testid="house-rules-card"
    >
      <h3 id={`${inputId}-title`} className={isEmbed ? 'mb-2 font-medium' : 'gd-rules-title'}>
        House rules{host ? ` of ${host}` : ''}
      </h3>

      {chips.length > 0 && (
        <ul className={isEmbed ? 'mb-2 flex flex-wrap gap-1.5' : 'gd-rules-chips'} data-testid="house-rules-chips">
          {chips.map((c) => (
            <li
              key={c.key}
              className={isEmbed ? 'rounded-full bg-bg-muted px-2 py-0.5 text-xs' : `gd-rules-chip gd-rules-chip--${c.tone}`}
            >
              {c.label}
            </li>
          ))}
        </ul>
      )}

      {text && (
        <p className={isEmbed ? 'mb-2 whitespace-pre-line text-text-secondary' : 'gd-rules-text'} data-testid="house-rules-text">
          {shown}
          {long && (
            <>
              {' '}
              <button
                type="button"
                className={isEmbed ? 'font-medium underline' : 'gd-rules-more'}
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                data-testid="house-rules-toggle"
              >
                {expanded ? 'Show less' : 'Read all the rules'}
              </button>
            </>
          )}
        </p>
      )}

      {info.houseRulesPdfUrl && (
        <p className={isEmbed ? 'mb-2' : 'gd-rules-pdf'}>
          <a href={info.houseRulesPdfUrl} target="_blank" rel="noopener noreferrer" data-testid="house-rules-pdf">
            Open the house rules (PDF)
          </a>
        </p>
      )}

      <div className={isEmbed ? 'flex items-start gap-2' : `gd-consent-row required${accepted ? ' checked' : ''}`} data-testid="house-rules-accept-row">
        <input
          id={inputId}
          type="checkbox"
          checked={accepted}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          data-testid="guest-booking-house-rules"
        />
        <div className={isEmbed ? 'text-xs' : 'gd-consent-body'}>
          <label htmlFor={inputId}>
            I accept the house rules{host ? <> of <b>{host}</b></> : null}.
          </label>
          <span className={isEmbed ? 'ml-1 text-text-muted' : 'gd-consent-tag'}>Required before you pay</span>
        </div>
      </div>
      {error && (
        <div id={`${inputId}-error`} className={isEmbed ? 'mt-1 text-xs text-red-600' : 'gd-input-help error'} role="alert">
          {error}
        </div>
      )}
    </section>
  );
};

export default HouseRulesAcceptance;
