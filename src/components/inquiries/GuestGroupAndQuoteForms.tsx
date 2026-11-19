import React, { useState } from 'react';
import { buildApiUrl, getApiHeaders } from '@/api/client';
import { getTenantContext } from '@/tenant/tenantContext';

export interface GroupInquirySubmission {
  city: string;
  checkIn: string;
  checkOut: string;
  groupSize: number;
  requirements?: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
}

export interface QuoteLeadSubmission {
  listingId: number;
  guestName: string;
  phone: string;
  email?: string;
  checkIn?: string;
  checkOut?: string;
  message?: string;
}

export type InquirySubmitOutcome =
  | { ok: true; message: string }
  | { ok: false; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateGroupInquiry(input: {
  city: string;
  checkIn: string;
  checkOut: string;
  groupSize: string | number;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
}): string | null {
  if (!input.city.trim()) return 'Please enter the city or property name.';
  if (!input.checkIn.trim()) return 'Please select a check-in date.';
  if (!input.checkOut.trim()) return 'Please select a check-out date.';
  if (input.checkOut <= input.checkIn) return 'Check-out date must be after check-in date.';
  const size = Number(input.groupSize);
  if (!Number.isFinite(size) || size < 1 || size > 500) {
    return 'Please enter a group size between 1 and 500 guests.';
  }
  if (!input.contactName.trim()) return 'Please enter your name.';
  const digits = input.contactPhone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return 'Please enter a valid 7 to 15 digit phone number.';
  }
  if (input.contactEmail && input.contactEmail.trim() && !EMAIL_RE.test(input.contactEmail.trim())) {
    return 'Please enter a valid email address.';
  }
  return null;
}

export function validateQuoteLead(input: {
  listingId: number | string | null | undefined;
  guestName: string;
  phone: string;
  email?: string;
  checkIn?: string;
  checkOut?: string;
}): string | null {
  const numericListingId = Number(input.listingId);
  if (!Number.isFinite(numericListingId) || numericListingId <= 0) {
    return 'Please select a valid property before requesting a quote.';
  }
  if (!input.guestName.trim()) return 'Please enter your name.';
  const digits = input.phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return 'Please enter a valid 7 to 15 digit phone number.';
  }
  if (input.email && input.email.trim() && !EMAIL_RE.test(input.email.trim())) {
    return 'Please enter a valid email address.';
  }
  if (input.checkIn && input.checkOut && input.checkOut <= input.checkIn) {
    return 'Check-out date must be after check-in date.';
  }
  return null;
}

async function parseErrorMessage(response: Response): Promise<string> {
  if (response.status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  try {
    const body = await response.json();
    if (body && typeof body === 'object') {
      const msg = (body as { message?: unknown; detail?: unknown; title?: unknown }).message
        ?? (body as { detail?: unknown }).detail
        ?? (body as { title?: unknown }).title;
      if (typeof msg === 'string' && msg.trim()) {
        return msg.trim();
      }
    }
  } catch {
    // Fall through to default plain-sentence error
  }
  if (response.status >= 400 && response.status < 500) {
    return 'Please check your details and try again.';
  }
  return 'We could not send your enquiry right now. Please try again.';
}

export async function submitGroupInquiry(
  payload: GroupInquirySubmission,
  tenantSlug?: string | null,
): Promise<InquirySubmitOutcome> {
  const slug = tenantSlug ?? getTenantContext()?.slug ?? undefined;
  try {
    const response = await fetch(buildApiUrl('/api/group-inquiries'), {
      method: 'POST',
      headers: {
        ...getApiHeaders(slug),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        city: payload.city.trim(),
        checkIn: payload.checkIn,
        checkOut: payload.checkOut,
        groupSize: payload.groupSize,
        requirements: payload.requirements?.trim() || undefined,
        contactName: payload.contactName.trim(),
        contactPhone: payload.contactPhone.trim(),
        contactEmail: payload.contactEmail?.trim() || undefined,
      }),
    });

    if (response.ok) {
      return { ok: true, message: 'Your enquiry has been sent to the host.' };
    }
    return { ok: false, message: await parseErrorMessage(response) };
  } catch {
    return { ok: false, message: 'We could not send your enquiry right now. Please try again.' };
  }
}

export async function submitQuoteLead(
  payload: QuoteLeadSubmission,
  tenantSlug?: string | null,
): Promise<InquirySubmitOutcome> {
  const slug = tenantSlug ?? getTenantContext()?.slug ?? undefined;
  try {
    const response = await fetch(buildApiUrl('/api/leads'), {
      method: 'POST',
      headers: {
        ...getApiHeaders(slug),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        listingId: payload.listingId,
        guestName: payload.guestName.trim(),
        phone: payload.phone.trim(),
        email: payload.email?.trim() || undefined,
        checkIn: payload.checkIn || undefined,
        checkOut: payload.checkOut || undefined,
        message: payload.message?.trim() || undefined,
        source: 'quote_form',
      }),
    });

    if (response.ok) {
      return { ok: true, message: 'Your enquiry has been sent to the host.' };
    }
    return { ok: false, message: await parseErrorMessage(response) };
  } catch {
    return { ok: false, message: 'We could not send your enquiry right now. Please try again.' };
  }
}

export interface GuestGroupAndQuoteFormsProps {
  listingId?: number | string | null;
  listingName?: string | null;
  defaultCity?: string | null;
  defaultCheckIn?: string | null;
  defaultCheckOut?: string | null;
  defaultGuests?: number | null;
  tenantSlug?: string | null;
  showGroupTrigger?: boolean;
  showQuoteTrigger?: boolean;
}

export const GuestGroupAndQuoteForms: React.FC<GuestGroupAndQuoteFormsProps> = ({
  listingId,
  listingName,
  defaultCity,
  defaultCheckIn,
  defaultCheckOut,
  defaultGuests,
  tenantSlug,
  showGroupTrigger = true,
  showQuoteTrigger = true,
}) => {
  const [activeModal, setActiveModal] = useState<'group' | 'quote' | null>(null);

  // Group inquiry fields
  const [city, setCity] = useState<string>(defaultCity || listingName || '');
  const [groupCheckIn, setGroupCheckIn] = useState<string>(defaultCheckIn || '');
  const [groupCheckOut, setGroupCheckOut] = useState<string>(defaultCheckOut || '');
  const [groupSize, setGroupSize] = useState<string>(
    defaultGuests && defaultGuests >= 4 ? String(defaultGuests) : '6',
  );
  const [requirements, setRequirements] = useState<string>('');
  const [contactName, setContactName] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');

  // Quote lead fields
  const [quoteName, setQuoteName] = useState<string>('');
  const [quotePhone, setQuotePhone] = useState<string>('');
  const [quoteEmail, setQuoteEmail] = useState<string>('');
  const [quoteCheckIn, setQuoteCheckIn] = useState<string>(defaultCheckIn || '');
  const [quoteCheckOut, setQuoteCheckOut] = useState<string>(defaultCheckOut || '');
  const [quoteMessage, setQuoteMessage] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const numericListingId = Number(listingId);
  const canShowQuote = showQuoteTrigger && Number.isFinite(numericListingId) && numericListingId > 0;

  const openModal = (mode: 'group' | 'quote') => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (mode === 'group' && !city.trim()) {
      setCity(defaultCity || listingName || '');
    }
    setActiveModal(mode);
  };

  const closeModal = () => {
    setActiveModal(null);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    const validationErr = validateGroupInquiry({
      city,
      checkIn: groupCheckIn,
      checkOut: groupCheckOut,
      groupSize,
      contactName,
      contactPhone,
      contactEmail,
    });
    if (validationErr) {
      setErrorMsg(validationErr);
      return;
    }

    setSubmitting(true);
    const res = await submitGroupInquiry(
      {
        city,
        checkIn: groupCheckIn,
        checkOut: groupCheckOut,
        groupSize: Number(groupSize),
        requirements,
        contactName,
        contactPhone,
        contactEmail,
      },
      tenantSlug,
    );
    setSubmitting(false);

    if (res.ok) {
      setSuccessMsg(res.message);
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    const validationErr = validateQuoteLead({
      listingId: numericListingId,
      guestName: quoteName,
      phone: quotePhone,
      email: quoteEmail,
      checkIn: quoteCheckIn,
      checkOut: quoteCheckOut,
    });
    if (validationErr) {
      setErrorMsg(validationErr);
      return;
    }

    setSubmitting(true);
    const res = await submitQuoteLead(
      {
        listingId: numericListingId,
        guestName: quoteName,
        phone: quotePhone,
        email: quoteEmail,
        checkIn: quoteCheckIn,
        checkOut: quoteCheckOut,
        message: quoteMessage,
      },
      tenantSlug,
    );
    setSubmitting(false);

    if (res.ok) {
      setSuccessMsg(res.message);
    } else {
      setErrorMsg(res.message);
    }
  };

  if (!showGroupTrigger && !canShowQuote) return null;

  return (
    <div
      data-testid="guest-inquiry-triggers"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      {showGroupTrigger && (
        <button
          type="button"
          data-testid="booking-for-group-trigger"
          onClick={() => openModal('group')}
          style={{
            flex: '1 1 140px',
            minHeight: 40,
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid #d6c5b8',
            background: '#fffaf5',
            color: '#4a3535',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            boxSizing: 'border-box',
          }}
        >
          Booking for a group?
        </button>
      )}

      {canShowQuote && (
        <button
          type="button"
          data-testid="send-me-quote-trigger"
          onClick={() => openModal('quote')}
          style={{
            flex: '1 1 140px',
            minHeight: 40,
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid #d6c5b8',
            background: '#ffffff',
            color: '#4a3535',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            boxSizing: 'border-box',
          }}
        >
          Send me a quote
        </button>
      )}

      {activeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-inquiry-modal-title"
          data-testid={activeModal === 'group' ? 'group-inquiry-modal' : 'send-quote-modal'}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 440,
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: '#ffffff',
              borderRadius: 16,
              padding: 16,
              boxSizing: 'border-box',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <h3
                id="guest-inquiry-modal-title"
                style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}
              >
                {activeModal === 'group' ? 'Booking for a group?' : 'Send me a quote'}
              </h3>
              <button
                type="button"
                aria-label="Close"
                data-testid="guest-inquiry-close"
                onClick={closeModal}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: 18,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  color: '#475569',
                }}
              >
                ✕
              </button>
            </div>

            {successMsg ? (
              <div data-testid="guest-inquiry-success" style={{ padding: '12px 0' }}>
                <p
                  style={{
                    margin: '0 0 12px 0',
                    fontSize: 14,
                    color: '#065f46',
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  {successMsg}
                </p>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: 'none',
                    backgroundColor: '#1e293b',
                    color: '#ffffff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Done
                </button>
              </div>
            ) : activeModal === 'group' ? (
              <form onSubmit={handleGroupSubmit} noValidate data-testid="group-inquiry-form">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
                    <span>City or property</span>
                    <input
                      type="text"
                      name="city"
                      data-testid="group-inquiry-city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Hyderabad or Penthouse"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: 14,
                        boxSizing: 'border-box',
                      }}
                    />
                  </label>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <label
                      style={{
                        flex: '1 1 130px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <span>Check-in</span>
                      <input
                        type="date"
                        name="checkIn"
                        data-testid="group-inquiry-checkin"
                        value={groupCheckIn}
                        onChange={(e) => setGroupCheckIn(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          fontSize: 14,
                          boxSizing: 'border-box',
                        }}
                      />
                    </label>
                    <label
                      style={{
                        flex: '1 1 130px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <span>Check-out</span>
                      <input
                        type="date"
                        name="checkOut"
                        data-testid="group-inquiry-checkout"
                        value={groupCheckOut}
                        onChange={(e) => setGroupCheckOut(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          fontSize: 14,
                          boxSizing: 'border-box',
                        }}
                      />
                    </label>
                  </div>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
                    <span>Group size (guests)</span>
                    <input
                      type="number"
                      name="groupSize"
                      min={1}
                      max={500}
                      data-testid="group-inquiry-size"
                      value={groupSize}
                      onChange={(e) => setGroupSize(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: 14,
                        boxSizing: 'border-box',
                      }}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
                    <span>Your name</span>
                    <input
                      type="text"
                      name="contactName"
                      data-testid="group-inquiry-name"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Full name"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: 14,
                        boxSizing: 'border-box',
                      }}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
                    <span>Phone number</span>
                    <input
                      type="tel"
                      name="contactPhone"
                      data-testid="group-inquiry-phone"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: 14,
                        boxSizing: 'border-box',
                      }}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
                    <span>Email (optional)</span>
                    <input
                      type="email"
                      name="contactEmail"
                      data-testid="group-inquiry-email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="you@example.com"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: 14,
                        boxSizing: 'border-box',
                      }}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
                    <span>Requirements (optional)</span>
                    <textarea
                      name="requirements"
                      rows={2}
                      data-testid="group-inquiry-requirements"
                      value={requirements}
                      onChange={(e) => setRequirements(e.target.value)}
                      placeholder="Rooms needed, special requests..."
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: 14,
                        boxSizing: 'border-box',
                      }}
                    />
                  </label>

                  {errorMsg && (
                    <p
                      role="alert"
                      data-testid="guest-inquiry-error"
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: '#b91c1c',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 8,
                        padding: '8px 10px',
                      }}
                    >
                      {errorMsg}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    data-testid="group-inquiry-submit"
                    style={{
                      width: '100%',
                      minHeight: 42,
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: 'none',
                      backgroundColor: '#b8472f',
                      color: '#ffffff',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {submitting ? 'Sending…' : 'Send group enquiry'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleQuoteSubmit} noValidate data-testid="send-quote-form">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
                    <span>Your name</span>
                    <input
                      type="text"
                      name="guestName"
                      data-testid="quote-lead-name"
                      value={quoteName}
                      onChange={(e) => setQuoteName(e.target.value)}
                      placeholder="Full name"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: 14,
                        boxSizing: 'border-box',
                      }}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
                    <span>Phone number</span>
                    <input
                      type="tel"
                      name="phone"
                      data-testid="quote-lead-phone"
                      value={quotePhone}
                      onChange={(e) => setQuotePhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: 14,
                        boxSizing: 'border-box',
                      }}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
                    <span>Email (optional)</span>
                    <input
                      type="email"
                      name="email"
                      data-testid="quote-lead-email"
                      value={quoteEmail}
                      onChange={(e) => setQuoteEmail(e.target.value)}
                      placeholder="you@example.com"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: 14,
                        boxSizing: 'border-box',
                      }}
                    />
                  </label>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <label
                      style={{
                        flex: '1 1 130px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <span>Check-in (optional)</span>
                      <input
                        type="date"
                        name="checkIn"
                        data-testid="quote-lead-checkin"
                        value={quoteCheckIn}
                        onChange={(e) => setQuoteCheckIn(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          fontSize: 14,
                          boxSizing: 'border-box',
                        }}
                      />
                    </label>
                    <label
                      style={{
                        flex: '1 1 130px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <span>Check-out (optional)</span>
                      <input
                        type="date"
                        name="checkOut"
                        data-testid="quote-lead-checkout"
                        value={quoteCheckOut}
                        onChange={(e) => setQuoteCheckOut(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          fontSize: 14,
                          boxSizing: 'border-box',
                        }}
                      />
                    </label>
                  </div>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
                    <span>Notes (optional)</span>
                    <textarea
                      name="message"
                      rows={2}
                      data-testid="quote-lead-message"
                      value={quoteMessage}
                      onChange={(e) => setQuoteMessage(e.target.value)}
                      placeholder="Dates, guests, or questions..."
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: 14,
                        boxSizing: 'border-box',
                      }}
                    />
                  </label>

                  {errorMsg && (
                    <p
                      role="alert"
                      data-testid="guest-inquiry-error"
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: '#b91c1c',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 8,
                        padding: '8px 10px',
                      }}
                    >
                      {errorMsg}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    data-testid="quote-lead-submit"
                    style={{
                      width: '100%',
                      minHeight: 42,
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: 'none',
                      backgroundColor: '#b8472f',
                      color: '#ffffff',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {submitting ? 'Sending…' : 'Request quote'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestGroupAndQuoteForms;
