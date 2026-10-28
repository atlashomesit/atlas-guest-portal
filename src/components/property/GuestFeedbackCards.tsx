/**
 * REV-046: the "Guest feedback" block on a listing page (founder ruling 2026-10-28).
 *
 * Rendered by the listing page AFTER its reviews section, as a block of its own. It deliberately takes
 * only the already-normalised cards and has no access to the review list, the count or the average, so
 * nothing here can change "4.8 from 12 guests", the star bars, the filter pills or the JSON-LD.
 *
 * A card shows first name, stars, the note and month/year, plus the "Guest feedback" label. It has no
 * verified-stay badge and no source logo: these notes come from a QR code anyone can scan, so they cannot
 * be proven to be from confirmed stays.
 *
 * Styling reuses the listing page's own `pp-v2-review-*` classes (the classic and heritage pages both
 * define them), so the cards sit in the same grid language as the reviews above them.
 */
import { useState } from 'react';
import {
  GUEST_FEEDBACK_LABEL,
  ANONYMOUS_GUEST_NAME,
  formatGuestFeedbackDate,
  type GuestFeedbackItem,
} from './guestFeedback';

/** Cards shown before "Show more guest feedback". */
const INITIAL_VISIBLE = 6;

const labelStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  marginBottom: 8,
  borderRadius: 999,
  background: 'var(--brand-soft, #fdf2e9)',
  border: '1px solid var(--border-strong, #e5cfc0)',
  color: 'var(--text-primary, #4a3535)',
  fontSize: 11,
  fontWeight: 600,
} as const;

export default function GuestFeedbackSection({ items }: { items: GuestFeedbackItem[] }) {
  const [showAll, setShowAll] = useState(false);
  if (items.length === 0) return null;

  const visible = showAll ? items : items.slice(0, INITIAL_VISIBLE);

  return (
    <section className="pp-section" aria-label={GUEST_FEEDBACK_LABEL} data-testid="guest-feedback-section">
      <div className="pp-section-head">
        <h2>{GUEST_FEEDBACK_LABEL}</h2>
      </div>
      <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--text-muted, #6b5a55)' }}>
        Notes shared by guests. These are not part of the star rating.
      </p>
      <div className="pp-v2-review-grid" data-testid="guest-feedback-grid">
        {visible.map((item) => {
          const monthYear = formatGuestFeedbackDate(item.date);
          const initial = item.firstName === ANONYMOUS_GUEST_NAME ? 'G' : item.firstName.charAt(0).toUpperCase();
          return (
            <article key={item.key} className="pp-v2-review-card" data-testid="guest-feedback-card">
              <span className="pp-v2-review-quote" aria-hidden="true">&ldquo;</span>
              <span style={labelStyle} data-testid="guest-feedback-label">{GUEST_FEEDBACK_LABEL}</span>
              <div
                style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-primary, #4a3535)' }}
                aria-label={`${item.rating} out of 5 stars`}
              >
                {'★'.repeat(item.rating)}{'☆'.repeat(Math.max(0, 5 - item.rating))}
              </div>
              <p className="pp-v2-review-body">{item.comment}</p>
              <div className="pp-v2-review-foot">
                <div
                  className="pp-v2-review-avatar"
                  aria-hidden="true"
                  style={{ background: '#f5ebe0', color: '#6b5a55' }}
                >
                  {initial}
                </div>
                <div>
                  <div className="pp-v2-review-name">{item.firstName}</div>
                  {monthYear ? (
                    <div className="pp-v2-review-date">
                      <time dateTime={item.date}>{monthYear}</time>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {items.length > INITIAL_VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="pp-prose-more"
          style={{ marginTop: 16 }}
          aria-expanded={showAll}
          data-testid="guest-feedback-toggle"
        >
          {showAll ? 'Show less guest feedback' : 'Show more guest feedback'}
        </button>
      )}
    </section>
  );
}
