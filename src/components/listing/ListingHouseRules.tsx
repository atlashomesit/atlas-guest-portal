/**
 * GUEST-069: the host's own house rules on the LISTING page, before the guest picks dates (the checkout still asks for the "I accept" tick). Read-only; renders
 * nothing when the host wrote no rules, so a listing with none shows no empty block. The host's own Google Maps link (when the API sends a usable one) is offered
 * as a plain link, so a guest opens the host's pin, not one rebuilt from coordinates.
 */
import React, { useState } from 'react';
import { parseStructuredHouseRules } from '@/utils/houseRules';

export interface ListingHouseRulesProps {
  houseRulesText?: string | null;
  houseRulesPdfUrl?: string | null;
  houseRulesStructured?: string | null;
  googleMapsUrl?: string | null;
}

/** Rules longer than this are collapsed behind "Read all the rules" so the page keeps its shape on a phone. */
const COLLAPSE_AT_CHARS = 320;

const clean = (v: string | null | undefined): string => (typeof v === 'string' ? v.trim() : '');

/** Only an absolute https link is ever put in an href (the API already checks it is a Google Maps host; this keeps the page honest on its own). */
const safeHttps = (v: string | null | undefined): string | null => {
  const raw = clean(v);
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
};

export const ListingHouseRules: React.FC<ListingHouseRulesProps> = ({ houseRulesText, houseRulesPdfUrl, houseRulesStructured, googleMapsUrl }) => {
  const [expanded, setExpanded] = useState(false);
  const chips = parseStructuredHouseRules(houseRulesStructured);
  const text = clean(houseRulesText);
  const pdf = clean(houseRulesPdfUrl);
  const map = safeHttps(googleMapsUrl);
  if (chips.length === 0 && !text && !pdf) return null;

  const long = text.length > COLLAPSE_AT_CHARS;
  const shown = long && !expanded ? `${text.slice(0, COLLAPSE_AT_CHARS).trimEnd()}…` : text;

  return (
    <section
      aria-labelledby="listing-house-rules-title"
      data-testid="listing-house-rules"
      style={{ margin: '24px 0', padding: 16, border: '1px solid var(--border-subtle, #e6e0d8)', borderRadius: 12 }}
    >
      <h2 id="listing-house-rules-title" style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>
        House rules
      </h2>

      {chips.length > 0 && (
        <ul data-testid="listing-house-rules-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, listStyle: 'none', padding: 0, margin: '0 0 8px' }}>
          {chips.map((c) => (
            <li key={c.key} style={{ padding: '2px 10px', borderRadius: 999, fontSize: 13, background: 'var(--bg-muted, #f4efe9)' }}>
              {c.label}
            </li>
          ))}
        </ul>
      )}

      {text && (
        <p data-testid="listing-house-rules-text" style={{ margin: '0 0 8px', whiteSpace: 'pre-line' }}>
          {shown}
          {long && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                data-testid="listing-house-rules-toggle"
                style={{ background: 'none', border: 0, padding: 0, textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
              >
                {expanded ? 'Show less' : 'Read all the rules'}
              </button>
            </>
          )}
        </p>
      )}

      {pdf && safeHttps(pdf) && (
        <p style={{ margin: '0 0 8px' }}>
          <a href={safeHttps(pdf)!} target="_blank" rel="noopener noreferrer" data-testid="listing-house-rules-pdf">
            Open the house rules (PDF)
          </a>
        </p>
      )}

      {map && (
        <p style={{ margin: 0 }}>
          <a href={map} target="_blank" rel="noopener noreferrer" data-testid="listing-host-map-link">
            Open the host&rsquo;s map link
          </a>
        </p>
      )}
    </section>
  );
};

export default ListingHouseRules;
