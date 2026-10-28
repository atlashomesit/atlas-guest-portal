import type { CSSProperties } from 'react';
import { formatReviewLocaleLabel } from './reviewMerge';

/**
 * REV-041: small language chip on a guest review card ("French (France)"), so a review written in another
 * language is visibly an international guest. The label comes from Intl.DisplayNames and falls back to the raw
 * code; the raw code is also the tooltip. A missing or malformed locale renders nothing. React text only: no
 * review-supplied value is ever put in as HTML.
 */
const chipStyle: CSSProperties = {
  display: 'inline-block',
  marginTop: 2,
  padding: '1px 8px',
  borderRadius: 999,
  border: '1px solid var(--border-strong, #e5cfc0)',
  fontSize: 10.5,
  fontWeight: 600,
  lineHeight: 1.5,
  color: 'var(--text-muted, #6b5a55)',
  whiteSpace: 'nowrap',
};

export default function ReviewLocaleChip({ locale }: { locale?: string | null }) {
  const label = formatReviewLocaleLabel(locale);
  if (!label) return null;
  return (
    <span style={chipStyle} title={(locale ?? '').trim().replace(/_/g, '-')} lang="en" data-testid="review-locale-chip">
      {label}
    </span>
  );
}
