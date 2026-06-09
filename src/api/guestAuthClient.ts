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
      throw new Error(`Failed to send OTP: ${response.statusText}`);
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
