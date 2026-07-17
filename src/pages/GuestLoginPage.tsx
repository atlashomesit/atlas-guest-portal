import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { guestAuthClient } from '@/api/guestAuthClient';
import { useGuestAuth } from '@/contexts/GuestAuthContext';
import { toast } from 'react-toastify';

/**
 * TASK-4017: Guest email/OTP login flow
 * Step 1: Enter email → send OTP
 * Step 2: Enter 6-digit OTP → verify and login
 */

export default function GuestLoginPage() {
  const navigate = useNavigate();
  const { login } = useGuestAuth();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!email.includes('@')) {
        setError('Please enter a valid email address');
        return;
      }

      await guestAuthClient.sendOtp(email);
      setStep('otp');
      toast.success('OTP sent to your email');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send OTP. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        setError('Please enter a valid 6-digit OTP');
        return;
      }

      const response = await guestAuthClient.verifyOtp(email, otp);
      login(response.token, response.email, response.guestId);
      toast.success('Login successful! Redirecting...');

      // Navigate to my bookings or home
      setTimeout(() => {
        navigate('/my-bookings', { replace: true });
      }, 500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to verify OTP. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: '700', marginBottom: '0.5rem', textAlign: 'center' }}>
            Login to Your Account
          </h1>
          <p style={{ color: '#6b7280', textAlign: 'center', marginBottom: '2rem' }}>
            {step === 'email' ? 'Enter your email to receive a one-time password' : 'Enter the 6-digit OTP sent to your email'}
          </p>

          {error && (
            <div style={{ backgroundColor: '#fee2e2', borderLeft: '4px solid #dc2626', color: '#991b1b', padding: '1rem', marginBottom: '1rem', borderRadius: '4px' }}>
              {error}
            </div>
          )}

          <form onSubmit={step === 'email' ? handleSendOtp : handleVerifyOtp}>
            {step === 'email' ? (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    marginBottom: '1rem',
                  }}
                  required
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: isLoading ? '#b8a89f' : 'var(--cta-primary, #c45a3f)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isLoading ? 'Sending...' : 'Send OTP'}
                </button>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  One-Time Password
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1.5rem',
                    textAlign: 'center',
                    letterSpacing: '0.25rem',
                    boxSizing: 'border-box',
                    marginBottom: '1rem',
                  }}
                  required
                />
                <button
                  type="submit"
                  disabled={isLoading || otp.length !== 6}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: isLoading || otp.length !== 6 ? '#b8a89f' : 'var(--cta-primary, #c45a3f)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: isLoading || otp.length !== 6 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isLoading ? 'Verifying...' : 'Verify & Login'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setOtp('');
                    setError(null);
                  }}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    marginTop: '1rem',
                    padding: '0.75rem',
                    backgroundColor: 'transparent',
                    color: 'var(--cta-primary, #c45a3f)',
                    border: '1px solid var(--cta-primary, #c45a3f)',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Edit Email
                </button>
              </div>
            )}
          </form>

          <div style={{ marginTop: '1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
            No account needed — we'll create one when you verify your email.
          </div>
        </div>
      </div>
    </div>
  );
}
