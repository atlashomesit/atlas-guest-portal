/**
 * GUEST-039: 1-tap Copy for Wi-Fi credentials and the door code, plus a standard scan-to-connect Wi-Fi QR.
 * Shared by the booking confirmation page and the self check-in page so both behave the same on a phone at the gate.
 */
import React from "react";
import { QRCodeSVG } from "qrcode.react";

/** The characters the WIFI: QR format reserves are backslash-escaped, so a password like `a;b"c` still scans. */
export function escapeWifiQrValue(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

/** Standard `WIFI:S:<ssid>;T:WPA;P:<password>;;` payload that iOS Camera and Android scanners join with one tap. */
export function buildWifiQrPayload(ssid: string, password?: string | null): string {
  const s = escapeWifiQrValue(ssid);
  if (!password) return `WIFI:S:${s};T:nopass;;`;
  return `WIFI:S:${s};T:WPA;P:${escapeWifiQrValue(password)};;`;
}

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* fall through to the textarea fallback (older browsers, non-secure contexts) */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

type CopyButtonProps = {
  value: string;
  /** Idle text, e.g. "Copy" or "Copy Code". */
  label?: string;
  /** Spoken name, e.g. "Copy Wi-Fi password". */
  ariaLabel: string;
  testId: string;
};

/** Copy button that says "Copied! ✓" for 2 seconds after a successful copy. */
export const CopyButton: React.FC<CopyButtonProps> = ({ value, label = "Copy", ariaLabel, testId }) => {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const onClick = async () => {
    if (!(await writeToClipboard(value))) return;
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-label={ariaLabel}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border-subtle bg-bg-page px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-surface transition-colors"
    >
      <span aria-live="polite">{copied ? "Copied! ✓" : label}</span>
    </button>
  );
};

type CopyableInfoRowProps = {
  label: string;
  value: string;
  mono?: boolean;
  copyLabel?: string;
  copyAriaLabel: string;
  copyTestId: string;
  valueTestId?: string;
};

/** A label/value row with a Copy button on the right. */
export const CopyableInfoRow: React.FC<CopyableInfoRowProps> = ({
  label, value, mono, copyLabel, copyAriaLabel, copyTestId, valueTestId,
}) => {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-border-subtle last:border-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs text-text-muted uppercase tracking-wider font-medium">{label}</span>
        <span className={`break-words text-sm text-text-primary ${mono ? "font-mono" : ""}`} data-testid={valueTestId}>{value}</span>
      </div>
      <CopyButton value={value} label={copyLabel} ariaLabel={copyAriaLabel} testId={copyTestId} />
    </div>
  );
};

/** "Scan to Connect": reveals a Wi-Fi QR so a second phone joins without typing the password. */
export const WifiScanToConnect: React.FC<{ ssid: string; passphrase?: string | null }> = ({ ssid, passphrase }) => {
  const [open, setOpen] = React.useState(false);
  if (!ssid) return null;
  const payload = buildWifiQrPayload(ssid, passphrase);
  return (
    <div className="pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-testid="wifi-scan-to-connect-btn"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-page px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-surface transition-colors"
      >
        {open ? "Hide QR code" : "Scan to Connect"}
      </button>
      {open && (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-border-subtle bg-white p-4" data-testid="wifi-qr-card">
          <span data-testid="wifi-qr-payload" data-payload={payload} className="sr-only">{payload}</span>
          <QRCodeSVG value={payload} size={176} level="M" includeMargin />
          <p className="text-center text-xs text-text-secondary">Open your phone camera and point it here to join {ssid}.</p>
        </div>
      )}
    </div>
  );
};
