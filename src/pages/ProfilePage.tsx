import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import SEO from "../components/SEO";
import { buildApiUrl, getApiHeaders } from "../api/client";
import { toast } from "react-toastify";
import { messageFromApiResponse } from "../utils/serverErrorFromResponse";

interface GuestProfile {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
}

const PHONE_RE = /^[6-9]\d{9}$/;

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

  useEffect(() => {
    if (!bookingId || !token) {
      setError("Profile link is missing booking details. Please use the link from your booking confirmation.");
      setLoading(false);
      return;
    }
    const url = buildApiUrl(`/api/public/bookings/${bookingId}/guest-profile?t=${encodeURIComponent(token)}`);
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
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [bookingId, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError("");

    const trimPhone = phone.trim();
    if (trimPhone && !PHONE_RE.test(trimPhone)) {
      setPhoneError("Enter a valid 10-digit Indian mobile number starting with 6–9.");
      return;
    }

    setSaving(true);
    try {
      const url = buildApiUrl(`/api/public/bookings/${bookingId}/guest-profile?t=${encodeURIComponent(token ?? "")}`);
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
      toast.success("Profile updated.");
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Could not update profile. Try again.";
      toast.error(message);
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

  if (error || !profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="text-4xl">👤</div>
          <h1 className="text-xl font-bold text-text-primary">Profile not found</h1>
          <p className="text-sm text-text-secondary">{error ?? "We could not find your profile."}</p>
          <Link to="/" className="inline-block mt-2 text-sm text-brand-primary underline underline-offset-2">Return to homepage</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO title="My Profile" description="Update your contact information." />
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-text-primary">My Profile</h1>
          <p className="text-sm text-text-secondary">Update your contact details below.</p>
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
              className="w-full rounded-xl border border-border-subtle bg-bg-surface px-4 py-2.5 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
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
              className="w-full rounded-xl border border-border-subtle bg-bg-surface px-4 py-2.5 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="profile-phone" className="text-sm font-medium text-text-primary">Phone</label>
            <input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
              maxLength={10}
              inputMode="numeric"
              placeholder="10-digit Indian mobile"
              className={`w-full rounded-xl border bg-bg-surface px-4 py-2.5 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary ${phoneError ? "border-red-400" : "border-border-subtle"}`}
            />
            {phoneError && <p className="text-xs text-red-600">{phoneError}</p>}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold py-3 text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
