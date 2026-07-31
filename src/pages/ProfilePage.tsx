import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import SEO from "../components/SEO";
import { getTenantBrandName } from "../tenant/displayBrand";
import StateMessage from "../components/StateMessage";
import { buildApiUrl, getApiHeaders } from "../api/client";
import { toast } from "react-toastify";
import { messageFromApiResponse } from "../utils/serverErrorFromResponse";
import { isValidPhoneNumber } from "libphonenumber-js";

interface GuestProfile {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
}

/**
 * TASK-5370 / ADR-0088: widened from the India-only /^[6-9]\d{9}$/ block to any E.164-valid
 * number, with bare digits still defaulting to India — mirrors the server contract in
 * GuestPhoneNormalizer and the checkout picker's libphonenumber-js validation.
 */
function isValidGuestPhone(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  return trimmed.startsWith("+")
    ? isValidPhoneNumber(trimmed)
    : isValidPhoneNumber(trimmed, "IN");
}
const MAX_AVATAR_BYTES = 512_000;

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const a = parts[0][0];
  const b = parts[parts.length - 1][0];
  return (a + b).toUpperCase();
}

export default function ProfilePage() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  const token = searchParams.get("t");

  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);

  const profileQuery = bookingId && token
    ? `?t=${encodeURIComponent(token)}`
    : "";

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarError("");
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !bookingId || !token) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("Photo must be under 512 KB.");
      return;
    }

    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const url = buildApiUrl(`/api/public/bookings/${bookingId}/guest-profile/photo${profileQuery}`);
      const res = await fetch(url, {
        method: "POST",
        headers: { Accept: "application/json", ...getApiHeaders() },
        body: form,
      });
      if (!res.ok) throw new Error(await messageFromApiResponse(res));
      const data = await res.json() as { photoUrl?: string; url?: string };
      const nextUrl = data.photoUrl ?? data.url ?? null;
      setAvatarUrl(nextUrl);
      setProfile((prev) => (prev ? { ...prev, photoUrl: nextUrl } : prev));
      toast.success("Profile photo updated.");
    } catch (err: unknown) {
      console.error("Profile photo upload failed:", err);
      setAvatarError("We couldn't upload your photo. Please try a smaller JPG or PNG.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarRemove = async () => {
    if (!bookingId || !token) return;
    setAvatarError("");
    setAvatarUploading(true);
    try {
      const url = buildApiUrl(`/api/public/bookings/${bookingId}/guest-profile/photo${profileQuery}`);
      const res = await fetch(url, {
        method: "DELETE",
        headers: { Accept: "application/json", ...getApiHeaders() },
      });
      if (!res.ok) throw new Error(await messageFromApiResponse(res));
      setAvatarUrl(null);
      setProfile((prev) => (prev ? { ...prev, photoUrl: null } : prev));
      toast.success("Profile photo removed.");
    } catch (err: unknown) {
      console.error("Profile photo remove failed:", err);
      setAvatarError("We couldn't remove your photo right now. Please try again.");
    } finally {
      setAvatarUploading(false);
    }
  };

  useEffect(() => {
    if (!bookingId || !token) {
      setError("Profile link is missing booking details. Please use the link from your booking confirmation.");
      setLoading(false);
      return;
    }
    const url = buildApiUrl(`/api/public/bookings/${bookingId}/guest-profile${profileQuery}`);
    fetch(url, { headers: { Accept: "application/json", ...getApiHeaders() } })
      .then(async (res) => {
        if (res.status === 404) throw new Error("Profile link not found. Please use the link from your booking confirmation.");
        if (!res.ok) throw new Error(await messageFromApiResponse(res));
        return res.json() as Promise<GuestProfile>;
      })
      .then((p) => {
        setProfile(p);
        setName(p.name ?? "");
        setEmail(p.email ?? "");
        setPhone(p.phone ?? "");
        setAvatarUrl(p.photoUrl ?? null);
      })
      .catch((err: Error) => {
        console.error(err);
        setError("We couldn't load your profile — please try again.");
      })
      .finally(() => setLoading(false));
  }, [bookingId, token, profileQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError("");

    const trimPhone = phone.trim();
    if (trimPhone && !isValidGuestPhone(trimPhone)) {
      setPhoneError("Enter a valid phone number (include + and country code for non-Indian numbers).");
      return;
    }

    setSaving(true);
    try {
      const url = buildApiUrl(`/api/public/bookings/${bookingId}/guest-profile${profileQuery}`);
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...getApiHeaders() },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          phone: trimPhone || undefined,
        }),
      });
      if (res.status === 400) {
        throw new Error(await messageFromApiResponse(res));
      }
      if (!res.ok) throw new Error(await messageFromApiResponse(res));
      const updated = await res.json() as GuestProfile;
      setProfile(updated);
      setAvatarUrl(updated.photoUrl ?? null);
      toast.success("Profile updated.");
    } catch (err: unknown) {
      console.error("Profile update failed:", err);
      toast.error("We couldn't save your profile right now. Please check your details and try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-border-subtle border-t-brand-primary rounded-full animate-spin" />
          <p className="text-sm text-text-secondary">Loading&hellip;</p>
        </div>
      </div>
    );
  }

  if (!bookingId || !token) {
    return (
      <StateMessage
        data-testid="profile-missing-token-state"
        icon="👤"
        title="Open your booking profile"
        message="Your profile is linked to a booking. Open it from your booking confirmation email or My Bookings."
        primaryAction={{ label: "My bookings", to: "/my-bookings" }}
        secondaryActions={[{ label: "Return to homepage", to: "/" }]}
      />
    );
  }

  if (error || !profile) {
    return (
      <StateMessage
        data-testid="profile-error-state"
        icon="👤"
        title="Profile not found"
        message={error ?? "We couldn’t load your profile right now. Please try again in a moment."}
        primaryAction={{ label: "Try again", onClick: () => window.location.reload() }}
        secondaryActions={[
          { label: "My bookings", to: "/my-bookings" },
          { label: "Return to homepage", to: "/" },
        ]}
      />
    );
  }

  return (
    <>
      <SEO title={`My Profile | ${getTenantBrandName()}`} description={`Update your contact information for ${getTenantBrandName()} bookings.`} />
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-text-primary">My Profile</h1>
          <p className="text-sm text-text-secondary">Update your contact details below.</p>
        </div>

        <div className="flex flex-col items-center gap-3 py-1" id="profile-photo" data-testid="profile-photo-section">
          <div
            className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-primary/15 text-xl font-semibold tracking-tight text-brand-primary"
            title={avatarUrl ? "Your profile photo" : "From your name"}
            aria-label={
              avatarUrl
                ? "Your profile photo"
                : `Profile initials: ${initialsFromName((name || profile?.name || "").trim() || "Guest")}`
            }
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initialsFromName((name || profile?.name || "").trim() || "Guest")
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-border-subtle bg-bg-surface px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-bg-muted transition-colors ${avatarUploading ? "pointer-events-none opacity-60" : ""}`}>
              {avatarUploading ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={avatarUploading}
                onChange={handleAvatarChange}
              />
            </label>
            {avatarUrl ? (
              <button
                type="button"
                onClick={handleAvatarRemove}
                disabled={avatarUploading}
                className="inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold text-text-muted hover:text-text-primary disabled:opacity-60"
              >
                Remove
              </button>
            ) : null}
          </div>
          <p className="text-center text-xs text-text-muted max-w-xs">
            Optional — JPG or PNG up to 512 KB. Saved to your guest profile across bookings.
          </p>
          {avatarError ? <p className="text-xs text-red-600" role="alert">{avatarError}</p> : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="profile-name" className="text-sm font-medium text-text-primary">Full Name</label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              className="w-full rounded-xl border border-border-subtle bg-bg-surface px-4 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="profile-email" className="text-sm font-medium text-text-primary">
              Email <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={200}
              className="w-full rounded-xl border border-border-subtle bg-bg-surface px-4 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="profile-phone" className="text-sm font-medium text-text-primary">Phone</label>
            <input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
              maxLength={20}
              inputMode="tel"
              placeholder="9876543210 or +7 916 123 4567"
              className={`w-full rounded-xl border bg-bg-surface px-4 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary ${phoneError ? "border-red-400" : "border-border-subtle"}`}
            />
            {phoneError && <p className="text-xs text-red-600">{phoneError}</p>}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[48px] rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold py-3 text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>

        {bookingId && token && (
          <div className="text-center pt-2">
            <Link
              to={`/booking/${bookingId}?t=${encodeURIComponent(token)}`}
              className="text-sm text-text-muted underline underline-offset-2 hover:text-text-primary"
            >
              ← Back to booking
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
