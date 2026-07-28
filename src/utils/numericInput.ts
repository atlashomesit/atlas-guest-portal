/**
 * Helpers for <input type="number"> count / quantity fields that must stay editable on
 * mobile virtual keyboards.
 *
 * Mirrors atlas-admin-portal/src/utils/numericInput.ts — keep the two in sync.
 *
 * Background: a controlled numeric input whose onChange coerced and rejected empty —
 * `parseInt(value) || 1`, `Number(value) || 1` — forced an emptied field straight back to
 * the fallback. On desktop this is masked by the spinner arrows and easy select-all-then-
 * type; on a phone the only natural way to change "1" to "2"/"3" is to backspace to empty
 * first, which the coercion instantly overwrote. The value looked stuck and could only be
 * appended to. Found on the admin side first (PRDS Ventures, live prod, 2026-07-25) and
 * then here on the guest booking widget.
 *
 * The fix: bind state as `number | ''`, run onChange through {@link toEditableInt} (which
 * permits a transient empty string), and clamp back to a valid floor with {@link clampMin}
 * on blur and again wherever the value is actually consumed.
 */

/** Parse a raw input string to an int, allowing '' while the user is mid-edit. */
export function toEditableInt(raw: string): number | "" {
  if (raw === "") return "";
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? "" : n;
}

/** Coerce a possibly-empty editable value to a finite number no lower than `min`. */
export function clampMin(value: number | "", min: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= min ? n : min;
}
