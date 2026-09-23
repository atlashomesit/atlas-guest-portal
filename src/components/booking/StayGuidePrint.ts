/**
 * TASK-102057 — printable Stay Receipt & Stay Guide for tenant whitelabel portals.
 *
 * Both documents are built from booking data ALREADY on the booking confirmation
 * page (no new API calls) and pushed to a new window via document.open + write,
 * then print() is invoked. The pop-up carries inline `<style>` for `@media
 * print` so the user gets a clean A4 layout, then on-screen styles that mirror
 * the in-app document card.
 *
 * Reusing the existing /voucher PDF endpoint for the receipt would be the
 * trivially-correct path — the voucher IS the booking folio — but the task
 * requires an in-portal, branded, page-derived receipt: this module renders
 * one from the same BookingSummary the page already shows, so the wording
 * matches what the guest sees on screen (no second source of truth).
 */

import { formatCurrency } from "../../utils/formatting";

export interface StayGuidePrintArgs {
  bookingId: number;
  guestName?: string;
  propertyName: string;
  listingName?: string;
  checkinDate: string;
  checkoutDate: string;
  nights: number;
  propertyAddress: string;
  propertyPhone: string;
  checkInTime?: string;
  checkOutTime?: string;
  wifiVisible?: boolean;
  wifiName?: string;
  wifiPassword?: string;
  checkinInstructions?: string;
  brandName: string;
  /** Tenant-level fallback phone (never leaks the Atlas default for whitelabel tenants). */
  fallbackPhone?: string;
  /** Tenant-level fallback email. */
  fallbackEmail?: string;
  /** Currency code (e.g. INR). Defaults to INR. */
  currency?: string;
  /** Total booking amount incl. GST — shown on the receipt only. */
  totalAmount?: number;
  /** Optional GST invoice number — shown on the receipt when present. */
  gstInvoiceNumber?: string | null;
  /** House rules / checkout checklist from the host guidebook. */
  guidebookCheckoutChecklistText?: string | null;
  /** House-rules body text from the listing. */
  guidebookTrashParkingText?: string | null;
  /** Nearby landmarks — useful for directions. */
  nearbyLandmarks?: string[];
}

/** Common `<style>` for both receipt and stay guide. Single source of truth. */
const PRINT_STYLE = `
  :root { color-scheme: light; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
         color: #0F172A; background: #FFFFFF; margin: 0; padding: 24px; line-height: 1.45; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; }
  h3 { font-size: 13px; margin: 12px 0 4px; color: #334155; }
  .muted { color: #64748B; font-size: 12px; }
  .brand { font-weight: 600; font-size: 16px; }
  .header { border-bottom: 2px solid #0F172A; padding-bottom: 12px; margin-bottom: 16px; display: flex; align-items: baseline; justify-content: space-between; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
  .row { display: flex; flex-direction: column; gap: 2px; padding: 8px 0; border-bottom: 1px solid #E2E8F0; }
  .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748B; font-weight: 500; }
  .value { font-size: 14px; color: #0F172A; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 500; background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; }
  .section { margin-bottom: 14px; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #64748B; }
  ul { margin: 6px 0 0; padding-left: 18px; }
  li { margin-bottom: 4px; font-size: 13px; }
  pre { white-space: pre-wrap; font-family: inherit; margin: 0; }
  @media print {
    @page { margin: 16mm; }
    body { padding: 0; }
    .no-print { display: none !important; }
  }
`;

function esc(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function printBtnHtml(): string {
  return `<div class="no-print" style="margin: 16px 0;">
    <button type="button" onclick="window.print()" style="padding: 10px 18px; border-radius: 8px; border: 1px solid #0F172A; background: #0F172A; color: white; font-weight: 600; cursor: pointer;">
      Print this page
    </button>
    <span class="muted" style="margin-left: 12px;">Use your browser's print dialog to save as PDF.</span>
  </div>`;
}

/**
 * Build a self-contained HTML document for the booking receipt / folio.
 * Pure function — no DOM access — so the build is unit-testable.
 */
export function buildReceiptHtml(args: StayGuidePrintArgs): string {
  const currency = args.currency ?? "INR";
  // `Number.isFinite` takes `unknown` and returns a plain `boolean` (not a `value is number`
  // type predicate), so it does not narrow `args.totalAmount` here — add an explicit `typeof`
  // check so TS can see `total` is a `number`, same runtime behavior as before.
  const total = typeof args.totalAmount === "number" && Number.isFinite(args.totalAmount) ? args.totalAmount : 0;
  const totalLine = `<div class="row">
      <span class="label">Total paid (incl. GST)</span>
      <span class="value" style="font-weight:700;font-size:16px;">${esc(formatCurrency(total, { currency }))}</span>
    </div>`;
  const invoiceLine = args.gstInvoiceNumber
    ? `<div class="row">
        <span class="label">GST invoice number</span>
        <span class="value mono">${esc(args.gstInvoiceNumber)}</span>
      </div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Stay Receipt — Booking #${esc(args.bookingId)} — ${esc(args.brandName)}</title>
<style>${PRINT_STYLE}</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">${esc(args.brandName)}</div>
    <h1>Stay Receipt</h1>
  </div>
  <div style="text-align:right;">
    <div class="muted">Booking reference</div>
    <div class="value mono">#${esc(args.bookingId)}</div>
  </div>
</div>

<div class="section">
  <h2>Guest</h2>
  <div class="row">
    <span class="value">${esc(args.guestName ?? "Guest")}</span>
  </div>
</div>

<div class="section">
  <h2>Stay</h2>
  <div class="row">
    <span class="label">Property</span>
    <span class="value">${esc(args.propertyName)}</span>
  </div>
  <div class="row">
    <span class="label">Check-in</span>
    <span class="value">${esc(args.checkinDate)}${args.checkInTime ? ` · ${esc(args.checkInTime)}` : ""}</span>
  </div>
  <div class="row">
    <span class="label">Check-out</span>
    <span class="value">${esc(args.checkoutDate)}${args.checkOutTime ? ` · ${esc(args.checkOutTime)}` : ""}</span>
  </div>
  <div class="row">
    <span class="label">Duration</span>
    <span class="value">${esc(args.nights)} ${args.nights === 1 ? "night" : "nights"}</span>
  </div>
  <div class="row">
    <span class="label">Address</span>
    <span class="value">${esc(args.propertyAddress || "Address shared with host")}</span>
  </div>
</div>

<div class="section">
  <h2>Payment</h2>
  ${invoiceLine}
  ${totalLine}
  <p class="muted" style="margin-top:8px;">Accommodation is billed under SAC 9963 (hotel and similar accommodation services) as applicable for Indian GST.</p>
</div>

<div class="section">
  <h2>Status</h2>
  <div class="row">
    <span class="value"><span class="pill">Confirmed</span> This receipt is your proof of booking. Present it on arrival.</span>
  </div>
</div>

${printBtnHtml()}

<div class="footer">
  Generated ${esc(new Date().toLocaleString("en-IN"))} · ${esc(args.brandName)} ·
  Keep this receipt for your records. GST invoicing follows the booking payment status.
</div>
</body>
</html>`;
}

/**
 * Build a self-contained HTML document for the printable Stay Guide (check-in
 * instructions, WiFi, directions, host contacts). Pure function for tests.
 */
export function buildStayGuideHtml(args: StayGuidePrintArgs): string {
  const wifiVisible = !!args.wifiVisible;
  const wifiName = (args.wifiName ?? "").trim();
  const wifiPassword = (args.wifiPassword ?? "").trim();
  const wifiBlock = (wifiVisible && (wifiName || wifiPassword))
    ? `<div class="section">
        <h2>WiFi</h2>
        ${wifiName ? `<div class="row"><span class="label">Network</span><span class="value mono">${esc(wifiName)}</span></div>` : ""}
        ${wifiPassword ? `<div class="row"><span class="label">Password</span><span class="value mono">${esc(wifiPassword)}</span></div>` : ""}
      </div>`
    : "";

  const houseRules = (args.checkinInstructions ?? "").trim();
  const checkoutList = (args.guidebookCheckoutChecklistText ?? "").trim();
  const parkingList = (args.guidebookTrashParkingText ?? "").trim();
  const houseRulesBlock = (houseRules || checkoutList || parkingList)
    ? `<div class="section">
        <h2>House rules &amp; check-out</h2>
        ${houseRules ? `<div class="row"><pre>${esc(houseRules)}</pre></div>` : ""}
        ${checkoutList ? `<div class="row"><span class="label">Check-out checklist</span><pre>${esc(checkoutList)}</pre></div>` : ""}
        ${parkingList ? `<div class="row"><span class="label">Trash &amp; parking</span><pre>${esc(parkingList)}</pre></div>` : ""}
      </div>`
    : "";

  const directionsBlock = args.propertyAddress
    ? `<div class="section">
        <h2>Directions</h2>
        <div class="row">
          <span class="value">${esc(args.propertyAddress)}</span>
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(args.propertyAddress)}" target="_blank" rel="noopener noreferrer" class="muted" style="margin-top:4px;display:inline-block;">Open in Google Maps →</a>
        </div>
        ${args.nearbyLandmarks?.length ? `<h3>Nearby</h3><ul>${args.nearbyLandmarks.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
      </div>`
    : "";

  const hostPhone = (args.propertyPhone ?? "").trim() || (args.fallbackPhone ?? "").trim();
  const hostEmail = (args.fallbackEmail ?? "").trim();
  const contactsBlock = (hostPhone || hostEmail)
    ? `<div class="section">
        <h2>Host contacts</h2>
        ${hostPhone ? `<div class="row"><span class="label">Phone / WhatsApp</span><span class="value mono">${esc(hostPhone)}</span></div>` : ""}
        ${hostEmail ? `<div class="row"><span class="label">Email</span><span class="value mono">${esc(hostEmail)}</span></div>` : ""}
      </div>`
    : "";

  const checkInTime = (args.checkInTime ?? "").trim();
  const checkOutTime = (args.checkOutTime ?? "").trim();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Stay Guide — Booking #${esc(args.bookingId)} — ${esc(args.brandName)}</title>
<style>${PRINT_STYLE}</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">${esc(args.brandName)}</div>
    <h1>Stay Guide</h1>
    <div class="muted">Everything you need for a smooth arrival and check-out.</div>
  </div>
  <div style="text-align:right;">
    <div class="muted">Booking reference</div>
    <div class="value mono">#${esc(args.bookingId)}</div>
  </div>
</div>

<div class="section">
  <h2>Quick reference</h2>
  <div class="grid">
    <div class="row"><span class="label">Property</span><span class="value">${esc(args.propertyName)}</span></div>
    <div class="row"><span class="label">Guest</span><span class="value">${esc(args.guestName ?? "Guest")}</span></div>
    <div class="row"><span class="label">Check-in</span><span class="value">${esc(args.checkinDate)}${checkInTime ? ` · ${esc(checkInTime)}` : ""}</span></div>
    <div class="row"><span class="label">Check-out</span><span class="value">${esc(args.checkoutDate)}${checkOutTime ? ` · ${esc(checkOutTime)}` : ""}</span></div>
  </div>
</div>

${wifiBlock}
${houseRulesBlock}
${directionsBlock}
${contactsBlock}

${printBtnHtml()}

<div class="footer">
  Generated ${esc(new Date().toLocaleString("en-IN"))} · ${esc(args.brandName)} ·
  Save this page or print it to keep the details at hand during your stay.
</div>
</body>
</html>`;
}

/**
 * Open a new window containing the given HTML and invoke its print dialog.
 * Browser-popup-blockers typically allow windows opened synchronously from a
 * user-gesture event handler, which is the only context we call this from.
 *
 * Returns the opened window when successful; null when the pop-up was blocked
 * or the runtime has no window/document (e.g. SSR).
 */
export function openPrintableHtml(html: string): Window | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return null;
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Best-effort: print when the document is ready. Most browsers honor this
  // because the user gesture is the click that triggered openPrintableHtml.
  const trigger = () => {
    try {
      win.focus();
      win.print();
    } catch {
      /* pop-up blocked or sandboxed; user can still use the in-page button */
    }
  };
  if (win.document.readyState === "complete") {
    setTimeout(trigger, 50);
  } else {
    win.addEventListener("load", trigger, { once: true });
  }
  return win;
}