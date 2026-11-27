import React from 'react';

export interface OfflineGuidebookData {
  propertyName: string;
  bookingCode: string;
  checkInDate: string;
  checkOutDate: string;
  address?: string;
  wifiNetwork?: string;
  wifiPassword?: string;
  doorPin?: string;
  hostPhone?: string;
  houseRules?: string[];
  localTips?: string[];
}

export function buildPrintableGuidebookHtml(data: OfflineGuidebookData): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rulesHtml = (data.houseRules || []).map((r) => `<li>${esc(r)}</li>`).join('');
  const tipsHtml = (data.localTips || []).map((t) => `<li>${esc(t)}</li>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(data.propertyName)} - Stay Guidebook (${esc(data.bookingCode)})</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #0f172a; max-width: 720px; margin: 24px auto; padding: 0 16px; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .meta { color: #475569; font-size: 13px; margin-bottom: 16px; }
    .card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; margin-bottom: 14px; }
    h2 { font-size: 15px; margin: 0 0 8px; }
    ul { margin: 0; padding-left: 18px; }
  </style>
</head>
<body>
  <h1>${esc(data.propertyName)} — Offline Digital Guidebook</h1>
  <div class="meta">Booking: ${esc(data.bookingCode)} · ${esc(data.checkInDate)} to ${esc(data.checkOutDate)}</div>
  <div class="card">
    <h2>Arrival &amp; Access</h2>
    ${data.address ? `<p><strong>Address:</strong> ${esc(data.address)}</p>` : ''}
    ${data.doorPin ? `<p><strong>Door PIN:</strong> ${esc(data.doorPin)}</p>` : ''}
    ${data.wifiNetwork ? `<p><strong>Wi-Fi:</strong> ${esc(data.wifiNetwork)}${data.wifiPassword ? ` / Password: ${esc(data.wifiPassword)}` : ''}</p>` : ''}
    ${data.hostPhone ? `<p><strong>Host Phone:</strong> ${esc(data.hostPhone)}</p>` : ''}
  </div>
  ${rulesHtml ? `<div class="card"><h2>House Rules</h2><ul>${rulesHtml}</ul></div>` : ''}
  ${tipsHtml ? `<div class="card"><h2>Local Tips</h2><ul>${tipsHtml}</ul></div>` : ''}
</body>
</html>`;
}

export interface OfflineGuidebookDownloadButtonProps {
  guidebook: OfflineGuidebookData;
  onDownload?: (html: string) => void;
}

export const OfflineGuidebookDownloadButton: React.FC<OfflineGuidebookDownloadButtonProps> = ({
  guidebook,
  onDownload,
}) => {
  const handleDownload = () => {
    const html = buildPrintableGuidebookHtml(guidebook);
    if (onDownload) {
      onDownload(html);
      return;
    }
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guidebook-${guidebook.bookingCode.toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      data-testid="download-offline-guidebook-btn"
      onClick={handleDownload}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50"
    >
      Download Offline Guidebook (PDF/HTML)
    </button>
  );
};
