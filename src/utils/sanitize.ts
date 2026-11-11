/**
 * TASK-10299094: Safe sanitization utilities.
 * Re-exports review text sanitizers that preserve '<3' emoticons, comparisons ('<5000', '< 20 sqm'),
 * and strips destructive HTML tags safely without corrupting user text.
 */

export { sanitizeReviewText, stripHtmlPreservingEmoticons } from './sanitizeReviewText';

/**
 * Escapes HTML special characters into safe HTML entities.
 */
export function escapeHtml(raw?: string | null): string {
  if (!raw) return '';
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
