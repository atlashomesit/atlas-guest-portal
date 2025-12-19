const VISIBLE_MODAL_SELECTORS = [
  "dialog[open]",
  "[role='dialog']",
  "[aria-modal='true']",
  ".modal.show",
  ".modal[open]",
  ".fixed.inset-0",
  "[data-radix-portal]",
];

export const hasVisibleModal = () => {
  if (typeof document === "undefined") return false;

  return VISIBLE_MODAL_SELECTORS.some((selector) => {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return false;

    const styles = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      styles.display !== "none" &&
      styles.visibility !== "hidden" &&
      parseFloat(styles.opacity || "1") > 0 &&
      rect.width > 0 &&
      rect.height > 0
    );
  });
};
