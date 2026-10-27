/**
 * TASK-10299094: Sanitizes and strips HTML tags from review text while preserving
 * emoticons like '<3', mathematical/comparison expressions like '< 20 sqm' or '<5000',
 * and standard punctuation.
 *
 * Naive regex like `/<.*?>/g` or `/<[^>]*>/g` deletes everything between '<' and '>',
 * corrupting review text when guests write '<3'.
 * We match only genuine HTML tags (opening/closing/self-closing tags starting with ASCII alpha).
 */

const HTML_TAG_REGEX = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gi;

export function stripHtmlPreservingEmoticons(raw?: string | null): string {
  if (!raw) return '';
  return raw.replace(HTML_TAG_REGEX, '');
}

export function sanitizeReviewText(raw?: string | null): string {
  if (!raw) return '';
  return stripHtmlPreservingEmoticons(raw).trim();
}
