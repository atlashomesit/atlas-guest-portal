import { useEffect, useState } from "react";
import { buildApiUrl, getApiHeaders } from "../api/client";

type QrTokenResponse = {
  qrToken?: string;
  expiresAtUtc?: string;
};

/**
 * TASK-2563: Mint a short-lived QR token from the booking link nonce; refresh before expiry.
 * Falls back to the link token when the API is unreachable (QR still renders).
 */
export function useGuestBookingQrToken(
  bookingId: number | undefined,
  linkToken: string | undefined,
): { qrToken: string | null; expiresAtUtc: string | null; loading: boolean } {
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [expiresAtUtc, setExpiresAtUtc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bookingId || !linkToken?.trim()) {
      setQrToken(null);
      setExpiresAtUtc(null);
      return;
    }

    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleRefresh = (expiresIso: string) => {
      const msUntilExpiry = new Date(expiresIso).getTime() - Date.now();
      const refreshIn = Math.max(5_000, msUntilExpiry - 60_000);
      refreshTimer = setTimeout(() => {
        if (!cancelled) void fetchQr();
      }, refreshIn);
    };

    const fetchQr = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          buildApiUrl(
            `/api/guest/bookings/${bookingId}/qr-token?t=${encodeURIComponent(linkToken.trim())}`,
          ),
          {
            method: "POST",
            headers: { Accept: "application/json", ...getApiHeaders() },
          },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as QrTokenResponse;
        if (cancelled || !data.qrToken?.trim()) return;
        setQrToken(data.qrToken.trim());
        const exp = data.expiresAtUtc?.trim() ?? null;
        setExpiresAtUtc(exp);
        if (exp) scheduleRefresh(exp);
      } catch {
        if (!cancelled) {
          setQrToken(null);
          setExpiresAtUtc(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchQr();

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [bookingId, linkToken]);

  return { qrToken, expiresAtUtc, loading };
}
