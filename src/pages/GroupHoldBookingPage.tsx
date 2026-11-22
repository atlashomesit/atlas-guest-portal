import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { buildApiUrl, getApiHeaders } from '@/api/client';
import { getTenantContext } from '@/tenant/tenantContext';
import { formatCurrency } from '@/utils/formatting';

export interface GroupHoldRoomDto {
  memberId: number;
  listingId: number;
  listingName: string;
  maxGuests: number;
  amountInr: number;
  currency: string;
}

export interface PublicGroupLinkDto {
  groupId: number;
  groupName: string;
  propertyName?: string | null;
  hostWhatsappPhone?: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  expiresAtUtc?: string | null;
  discountPercent?: number | null;
  ended: boolean;
  allBooked: boolean;
  roomsLeft: number;
  rooms: GroupHoldRoomDto[];
}

export interface ClaimGroupRoomResponse {
  bookingId: number;
  orderId: string;
  amountInr: number;
  amountPaise: number;
  currency: string;
  claimedUntilUtc: string;
}

const GroupHoldBookingPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [group, setGroup] = useState<PublicGroupLinkDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

  const [guestName, setGuestName] = useState<string>('');
  const [guestPhone, setGuestPhone] = useState<string>('');
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [claiming, setClaiming] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadGroupLink = useCallback(async () => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        buildApiUrl(`/api/public/group-links/${encodeURIComponent(token)}`),
        {
          headers: {
            ...getApiHeaders(getTenantContext()?.slug),
            Accept: 'application/json',
          },
        },
      );
      if (!res.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as PublicGroupLinkDto;
      setGroup(data);
      if (data.rooms && data.rooms.length > 0) {
        setSelectedMemberId((prev) =>
          prev && data.rooms.some((r) => r.memberId === prev)
            ? prev
            : data.rooms[0].memberId,
        );
      } else {
        setSelectedMemberId(null);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadGroupLink();
  }, [loadGroupLink]);

  const selectedRoom =
    group?.rooms.find((r) => r.memberId === selectedMemberId) ??
    group?.rooms[0] ??
    null;

  const handleClaimAndPay = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!token || !selectedRoom) {
      setErrorMessage('Please pick a room to continue.');
      return;
    }
    if (!guestName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    const phoneDigits = guestPhone.replace(/\D/g, '');
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      setErrorMessage('Please enter a valid phone number.');
      return;
    }

    setClaiming(true);
    try {
      const res = await fetch(
        buildApiUrl(
          `/api/public/group-links/${encodeURIComponent(token)}/rooms/${selectedRoom.memberId}/claim`,
        ),
        {
          method: 'POST',
          headers: {
            ...getApiHeaders(getTenantContext()?.slug),
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            guestName: guestName.trim(),
            guestPhone: guestPhone.trim(),
            guestEmail: guestEmail.trim() || undefined,
          }),
        },
      );

      if (res.status === 409) {
        let code = '';
        try {
          const body = (await res.json()) as { code?: string; error?: string };
          code = body?.code ?? '';
        } catch {
          // ignore
        }
        if (code === 'GROUP_LINK_ENDED') {
          setGroup((prev) => (prev ? { ...prev, ended: true, rooms: [], roomsLeft: 0 } : prev));
          setErrorMessage('This group link has ended');
        } else {
          setErrorMessage('Someone just booked this room. Pick another');
          await loadGroupLink();
        }
        setClaiming(false);
        return;
      }

      if (!res.ok) {
        setErrorMessage('Could not claim this room right now. Please try again.');
        setClaiming(false);
        return;
      }

      const claimed = (await res.json()) as ClaimGroupRoomResponse;
      navigate(`/booking/${claimed.bookingId}`, {
        state: {
          orderId: claimed.orderId,
          amountInr: claimed.amountInr,
          fromGroupHold: true,
        },
      });
    } catch {
      setErrorMessage('Could not claim this room right now. Please try again.');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div
        data-testid="group-hold-loading"
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '32px 16px',
          boxSizing: 'border-box',
        }}
      >
        <p>Loading group rooms…</p>
      </div>
    );
  }

  if (notFound || !group) {
    return (
      <div
        data-testid="group-hold-ended"
        style={{
          maxWidth: 640,
          margin: '0 auto',
          padding: '40px 16px',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          This group link has ended
        </h1>
        <p style={{ color: '#64748b', fontSize: 15 }}>
          Contact the host if you still need a room for this group stay.
        </p>
      </div>
    );
  }

  const hostDigits = (group.hostWhatsappPhone ?? '').replace(/\D/g, '');
  const hostWaHref = hostDigits
    ? `https://wa.me/${hostDigits}?text=${encodeURIComponent(`Hi, I am checking on the group booking for ${group.groupName}.`)}`
    : null;

  if (group.ended) {
    return (
      <div
        data-testid="group-hold-ended"
        style={{
          maxWidth: 640,
          margin: '0 auto',
          padding: '40px 16px',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          This group link has ended
        </h1>
        <p style={{ color: '#64748b', fontSize: 15, marginBottom: 16 }}>
          The hold for {group.groupName} is no longer active.
        </p>
        {hostWaHref && (
          <a
            href={hostWaHref}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="group-hold-whatsapp-host"
            style={{
              display: 'inline-block',
              padding: '10px 18px',
              borderRadius: 10,
              backgroundColor: '#15803d',
              color: '#ffffff',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Message host on WhatsApp
          </a>
        )}
      </div>
    );
  }

  if (group.allBooked || group.rooms.length === 0) {
    return (
      <div
        data-testid="group-hold-all-booked"
        style={{
          maxWidth: 640,
          margin: '0 auto',
          padding: '40px 16px',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          All rooms in this group are booked
        </h1>
        <p style={{ color: '#64748b', fontSize: 15, marginBottom: 16 }}>
          Every held room in {group.groupName} has already been claimed.
        </p>
        {hostWaHref && (
          <a
            href={hostWaHref}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="group-hold-whatsapp-host"
            style={{
              display: 'inline-block',
              padding: '10px 18px',
              borderRadius: 10,
              backgroundColor: '#15803d',
              color: '#ffffff',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Message host on WhatsApp
          </a>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="group-hold-page"
      style={{
        maxWidth: 1120,
        margin: '0 auto',
        padding: '24px 16px 48px',
        boxSizing: 'border-box',
      }}
    >
      <header style={{ marginBottom: 24 }}>
        {group.propertyName && (
          <p
            style={{
              margin: '0 0 4px 0',
              fontSize: 13,
              fontWeight: 600,
              color: '#b8472f',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {group.propertyName}
          </p>
        )}
        <h1 style={{ margin: '0 0 8px 0', fontSize: 26, fontWeight: 700, color: '#1e293b' }}>
          {group.groupName}
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#475569' }}>
          {group.checkIn} to {group.checkOut} · {group.nights}{' '}
          {group.nights === 1 ? 'night' : 'nights'} · {group.roomsLeft}{' '}
          {group.roomsLeft === 1 ? 'room left' : 'rooms left'}
          {group.discountPercent ? ` · ${group.discountPercent}% group discount applied` : ''}
        </p>
      </header>

      {errorMessage && (
        <div
          role="alert"
          data-testid="group-hold-error"
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 10,
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {errorMessage}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: 24,
          alignItems: 'start',
        }}
      >
        {/* Left column: Held rooms grid */}
        <section aria-label="Held rooms for your group">
          <h2 style={{ margin: '0 0 12px 0', fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
            Pick your room
          </h2>
          <div
            data-testid="group-hold-rooms-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))',
              gap: 12,
            }}
          >
            {group.rooms.map((room) => {
              const isSelected = selectedRoom?.memberId === room.memberId;
              return (
                <button
                  key={room.memberId}
                  type="button"
                  data-testid={`group-room-card-${room.memberId}`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedMemberId(room.memberId)}
                  style={{
                    textAlign: 'left',
                    padding: 16,
                    borderRadius: 14,
                    border: isSelected ? '2px solid #b8472f' : '1px solid #cbd5e1',
                    backgroundColor: isSelected ? '#fffaf5' : '#ffffff',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <strong style={{ fontSize: 16, color: '#1e293b' }}>{room.listingName}</strong>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: isSelected ? '#b8472f' : '#64748b',
                      }}
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 8px 0', fontSize: 13, color: '#64748b' }}>
                    Up to {room.maxGuests} {room.maxGuests === 1 ? 'guest' : 'guests'}
                  </p>
                  <p
                    data-testid={`group-room-price-${room.memberId}`}
                    style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}
                  >
                    {formatCurrency(room.amountInr)}
                    <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b' }}>
                      {' '}
                      total for {group.nights} {group.nights === 1 ? 'night' : 'nights'}
                    </span>
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Right column: Guest details + Summary box */}
        <aside
          data-testid="group-hold-summary-box"
          style={{
            padding: 20,
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            boxSizing: 'border-box',
            width: '100%',
          }}
        >
          <h2 style={{ margin: '0 0 12px 0', fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
            Claim &amp; pay for your room
          </h2>
          {selectedRoom && (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                backgroundColor: '#f8fafc',
                marginBottom: 16,
                fontSize: 14,
              }}
            >
              <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedRoom.listingName}</div>
              <div style={{ color: '#475569', marginTop: 2 }}>
                {group.checkIn} → {group.checkOut} ({group.nights}{' '}
                {group.nights === 1 ? 'night' : 'nights'})
              </div>
              <div
                data-testid="group-selected-room-total"
                style={{ fontWeight: 700, color: '#b8472f', marginTop: 6, fontSize: 16 }}
              >
                Group price: {formatCurrency(selectedRoom.amountInr)}
              </div>
            </div>
          )}

          <form onSubmit={handleClaimAndPay} noValidate data-testid="group-claim-form">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
                <span>Your full name</span>
                <input
                  type="text"
                  data-testid="group-claim-name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Enter guest name"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
                <span>WhatsApp / mobile number</span>
                <input
                  type="tel"
                  data-testid="group-claim-phone"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
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
                  data-testid="group-claim-email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
              </label>

              <button
                type="submit"
                disabled={claiming || !selectedRoom}
                data-testid="group-claim-submit"
                style={{
                  width: '100%',
                  minHeight: 44,
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: 'none',
                  backgroundColor: '#b8472f',
                  color: '#ffffff',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: claiming ? 'not-allowed' : 'pointer',
                }}
              >
                {claiming
                  ? 'Holding your room…'
                  : selectedRoom
                    ? `Pay ${formatCurrency(selectedRoom.amountInr)} via UPI / Razorpay`
                    : 'Pay via UPI / Razorpay'}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
};

export default GroupHoldBookingPage;
