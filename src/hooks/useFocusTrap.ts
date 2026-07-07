// TASK-4439: shared focus management for modal dialogs (WCAG 2.4.3 / 2.1.2).
// - Moves focus into the dialog when it opens.
// - Traps Tab / Shift+Tab within the dialog while it is open.
// - Restores focus to the previously-focused element (the trigger) on close.
import { useEffect, useRef, type MutableRefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Focus trap for `role="dialog"` containers.
 *
 * Usage:
 *   const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
 *   <div ref={dialogRef} role="dialog" aria-modal="true">…</div>
 *
 * Components that already own a container ref can pass it as `externalRef`
 * instead of attaching the returned ref.
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  externalRef?: MutableRefObject<T | null>,
): MutableRefObject<T | null> {
  const internalRef = useRef<T | null>(null);
  const containerRef = externalRef ?? internalRef;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.getAttribute("aria-hidden") !== "true",
      );

    // Move focus into the dialog on open (unless something inside already has it,
    // e.g. a component that autofocuses its own input).
    if (!container.contains(document.activeElement)) {
      const first = getFocusable()[0];
      if (first) {
        first.focus();
      } else {
        if (!container.hasAttribute("tabindex")) container.setAttribute("tabindex", "-1");
        container.focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (e.shiftKey) {
        if (current === first || !container.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last || !container.contains(current)) {
        e.preventDefault();
        first.focus();
      }
    };

    // Capture phase so the trap wins even if inner handlers stop propagation.
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      // Return focus to the trigger on close (skip if it was unmounted meanwhile).
      if (previouslyFocused && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [active, containerRef]);

  return containerRef;
}

export default useFocusTrap;
