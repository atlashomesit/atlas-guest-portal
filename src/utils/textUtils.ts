/**
 * Utilities for repairing text encoding issues and normalizing strings in the Guest Portal.
 */

/**
 * Repairs double-encoded UTF-8 mojibake commonly found in imported OTA listing descriptions
 * (e.g. Vistara Stays, Airbnb, Booking.com channel sync) and normalizes carriage returns.
 *
 * Replaces double-encoded UTF-8 sequences:
 * - "â€¢" -> "•" (bullet U+2022)
 * - "âœ”" -> "✔" (heavy check mark U+2714)
 * - "âœ…" -> "✅" (check mark box U+2705)
 * - "â€™" -> "’" (right single quotation mark / apostrophe U+2019)
 * - "â€˜" -> "‘" (left single quotation mark U+2018)
 * - "â€œ" -> "“" (left double quotation mark U+201C)
 * - "â€\x9d" or "â€\u009d" / "â€" -> "”" (right double quotation mark U+201D)
 * - "â€“" -> "–" (en dash U+2013)
 * - "â€”" -> "—" (em dash U+2014)
 * - "Â " -> " " (double-encoded space / non-breaking space)
 * - normalizes raw literal "\\r\\n" or carriage returns ("\r\n", "\r") to clean line breaks ("\n").
 */
export function repairMojibake(text: string | null | undefined): string {
  if (!text) return '';
  if (typeof text !== 'string') return String(text);

  let cleaned = text;

  // 1. Multi-character / specific sequences ordered so longer prefixes are replaced first
  cleaned = cleaned.replace(/â€¢/g, '•');
  cleaned = cleaned.replace(/âœ”/g, '✔');
  cleaned = cleaned.replace(/âœ…/g, '✅');
  cleaned = cleaned.replace(/â€™/g, '’');
  cleaned = cleaned.replace(/â€˜/g, '‘');
  cleaned = cleaned.replace(/â€œ/g, '“');
  cleaned = cleaned.replace(/â€(?:\u009d|\x9d)/g, '”');
  cleaned = cleaned.replace(/â€“/g, '–');
  cleaned = cleaned.replace(/â€”/g, '—');
  cleaned = cleaned.replace(/â€¦/g, '…');
  cleaned = cleaned.replace(/â€š/g, '„');
  cleaned = cleaned.replace(/â„¢/g, '™');

  // Double-encoded non-breaking space and Latin-1 space
  cleaned = cleaned.replace(/Â[\u00A0 ]/g, ' ');

  // Lone "â€" (where 0x9D was stripped or unprintable right double quote)
  cleaned = cleaned.replace(/â€/g, '”');

  // 2. Normalize raw literal "\r\n", raw literal "\r", and actual carriage returns
  cleaned = cleaned.replace(/\\r\\n/g, '\n');
  cleaned = cleaned.replace(/\\r/g, '\n');
  cleaned = cleaned.replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/\r/g, '\n');

  return cleaned;
}
