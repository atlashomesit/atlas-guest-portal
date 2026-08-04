import { buildApiUrl, getApiHeaders } from './client';

/**
 * TASK-4017: Guest OTP auth API client
 * Handles email/OTP login flow for guests
 */

export interface GuestSendOtpRequest {
  email: string;
}

export interface GuestSendOtpResponse {
  message: string;
  /** TASK-7429: support/reference id when delivery is uncertain or for recovery. */
  correlationId?: string;
  /** TASK-7429: optional hint about delivery status (e.g. delayed / check spam). */
  deliveryHint?: string;
}

export interface GuestVerifyOtpRequest {
  email: string;
  otp: string;
}

export interface GuestVerifyOtpResponse {
  token: string;
  email: string;
  guestId?: number;
}

export const guestAuthClient = {
  async sendOtp(email: string): Promise<GuestSendOtpResponse> {
    const url = buildApiUrl('/api/guest/auth/send-otp');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getApiHeaders(),
      },
      body: JSON.stringify({ email } as GuestSendOtpRequest),
    });

    if (!response.ok) {
      // TASK-7440: missing tenant (and similar misconfig) must surface — not look like success.
      let detail = response.statusText || `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { error?: string; message?: string };
        detail = body.error || body.message || detail;
      } catch {
        /* keep statusText */
      }
      throw new Error(`Failed to send OTP: ${detail}`);
    }

    return response.json() as Promise<GuestSendOtpResponse>;
  },

  async verifyOtp(email: string, otp: string): Promise<GuestVerifyOtpResponse> {
    const url = buildApiUrl('/api/guest/auth/verify-otp');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getApiHeaders(),
      },
      body: JSON.stringify({ email, otp } as GuestVerifyOtpRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to verify OTP: ${errorText}`);
    }

    return response.json() as Promise<GuestVerifyOtpResponse>;
  },
};
