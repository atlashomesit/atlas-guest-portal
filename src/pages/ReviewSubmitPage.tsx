import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import SEO from "../components/SEO";
import { buildApiUrl, getApiHeaders } from "../api/client";
import { sanitizeGuestImageUrl } from "../utils/guestImageUrl";
import { buildHomeUnitPath, getPropertySlug } from "../utils/navigation";
import { messageFromApiResponse } from "../utils/serverErrorFromResponse";
import { getTenantBrandName } from "../tenant/displayBrand";

interface ReviewEligibility {
  bookingId: number;
  guestName: string;
  propertyName: string;
  listingName: string;
  listingId: number;
  checkedOut: boolean;
  alreadyReviewed: boolean;
  checkoutDate: string;
}

function StarButton({ value, selected, hovered, onHover, onClick }: {
  value: number; selected: boolean; hovered: boolean;
  onHover: (v: number) => void; onClick: (v: number) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${value} star${value !== 1 ? "s" : ""}`}
      onClick={() => onClick(value)}
      onMouseEnter={() => onHover(value)}
      onMouseLeave={() => onHover(0)}
      className="text-4xl transition-transform hover:scale-110 focus:outline-none focus:scale-110"
    >
      <span className={selected || hovered ? "text-amber-400" : "text-gray-300"}>★</span>
    </button>
  );
}

const ratingLabels: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Excellent",
};

type SubKey = "cleanliness" | "value" | "checkin" | "communication";

const SUB_CATEGORY_ROWS: { key: SubKey; label: string }[] = [
  { key: "cleanliness", label: "Cleanliness" },
  { key: "value", label: "Value" },
  { key: "checkin", label: "Check-in" },
  { key: "communication", label: "Host communication" },
];

function SubcategoryStars({
  label,
  value,
  hover,
  onHover,
  onPick,
}: {
  label: string;
  value: number;
  hover: number;
  onHover: (v: number) => void;
  onPick: (v: number) => void;
}) {
  const active = hover || value;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text-primary">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((v) => (
          <StarButton
            key={v}
            value={v}
            selected={v <= value}
            hovered={v <= hover}
            onHover={onHover}
            onClick={onPick}
          />
        ))}
      </div>
      {active > 0 && <p className="text-xs font-semibold text-amber-600">{ratingLabels[active]}</p>}
    </div>
  );
}

const emptySubRatings = (): Record<SubKey, number> => ({
  cleanliness: 0,
  value: 0,
  checkin: 0,
  communication: 0,
});

export default function ReviewSubmitPage() {
  const brandName = getTenantBrandName();
  const { bookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t");

  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [subRatings, setSubRatings] = useState<Record<SubKey, number>>(emptySubRatings);
  const [subHover, setSubHover] = useState<Record<SubKey, number>>(emptySubRatings);
  /** TASK-1890: URLs from POST /api/reviews/upload-photo (max 3). */
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId || !token) {
      setError("Invalid review link. Please use the link from your check-out message.");
      setLoading(false);
      return;
    }

    const url = buildApiUrl(`/api/reviews/check/${bookingId}?t=${encodeURIComponent(token)}`);
    fetch(url, { headers: { Accept: "application/json", ...getApiHeaders() } })
      .then(async (res) => {
        if (res.status === 404) throw new Error("Review link not found. Please use the link from your message.");
        if (!res.ok) throw new Error(await messageFromApiResponse(res));
        return res.json() as Promise<ReviewEligibility>;
      })
      .then(setEligibility)
      .catch((err: Error) => {
        // TASK-2896: never surface raw server strings to the guest.
        console.error("Review form load failed:", err);
        setError("We couldn't load your review form. Please use the link from your check-out message again, or try later.");
      })
      .finally(() => setLoading(false));
  }, [bookingId, token]);

  const handlePhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = "";
    if (!files?.length || !bookingId || !token) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      const additions: string[] = [];
      for (const file of Array.from(files)) {
        if (photoUrls.length + additions.length >= 3) break;
        if (file.size > 16 * 1024 * 1024) {
          setPhotoError(`"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Please use a photo under 16 MB.`);
          continue;
        }
        const fd = new FormData();
        fd.append("bookingId", String(bookingId));
        fd.append("bookingToken", token);
        fd.append("file", file);
        const res = await fetch(buildApiUrl("/api/reviews/upload-photo"), {
          method: "POST",
          headers: { Accept: "application/json", ...getApiHeaders() },
          body: fd,
        });
        if (!res.ok) {
          throw new Error(await messageFromApiResponse(res));
        }
        const data = (await res.json()) as { url?: string };
        if (data.url) additions.push(data.url);
      }
      if (additions.length > 0) {
        setPhotoUrls((prev) => [...prev, ...additions].slice(0, 3));
      }
    } catch (err: unknown) {
      console.error("Review photo upload failed:", err); // TASK-2896
      setPhotoError("That photo couldn't be uploaded. Please try a different image.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const bodyLen = body.trim().length;
  const bodyTooShort = useMemo(() => bodyLen > 0 && bodyLen < 20, [bodyLen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { setSubmitError("Please select a star rating."); return; }
    if (!body.trim()) { setSubmitError("Please share a bit about your stay."); return; }
    if (bodyLen < 20) { setSubmitError("Please write at least 20 characters."); return; }
    if (bodyLen > 500) { setSubmitError("Review text must be 500 characters or fewer."); return; }
    if (SUB_CATEGORY_ROWS.some(({ key }) => subRatings[key] < 1)) {
      setSubmitError("Please rate cleanliness, value, check-in, and host communication.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const url = buildApiUrl("/api/reviews");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...getApiHeaders() },
        body: JSON.stringify({
          bookingId: Number(bookingId),
          rating,
          title: title.trim() || undefined,
          body: body.trim(),
          bookingToken: token,
          ratings: {
            cleanliness: subRatings.cleanliness,
            value: subRatings.value,
            checkin: subRatings.checkin,
            communication: subRatings.communication,
          },
          ...(photoUrls.length > 0 ? { photoUrls } : {}),
        }),
      });

      if (res.status === 409) throw new Error("You have already submitted a review for this stay.");
      if (!res.ok) throw new Error(await messageFromApiResponse(res));

      setSubmitted(true);
    } catch (err: unknown) {
      console.error("Review submit failed:", err); // TASK-2896
      setSubmitError("We couldn't submit your review just now. Please try again in a moment.");
    } finally {
      setSubmitting(false);
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

  if (error || !eligibility) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="text-4xl">🔍</div>
          <h1 className="text-xl font-bold text-text-primary">Link not found</h1>
          <p className="text-sm text-text-secondary">{error ?? "We could not find this review link."}</p>
          <Link to="/" className="inline-block mt-2 text-sm text-brand-primary underline underline-offset-2">Return to homepage</Link>
        </div>
      </div>
    );
  }

  if (!eligibility.checkedOut) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="text-4xl">🏠</div>
          <h1 className="text-xl font-bold text-text-primary">Not checked out yet</h1>
          <p className="text-sm text-text-secondary">
            You can leave a review after your stay at <strong>{eligibility.propertyName}</strong> ends on {eligibility.checkoutDate}.
          </p>
          <Link to="/" className="inline-block mt-2 text-sm text-brand-primary underline underline-offset-2">Return to homepage</Link>
        </div>
      </div>
    );
  }

  if (eligibility.alreadyReviewed || submitted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="text-4xl">🙏</div>
          <h1 className="text-xl font-bold text-text-primary">
            {submitted ? "Thank you for your review!" : "Review already submitted"}
          </h1>
          <p className="text-sm text-text-secondary">
            {submitted
              ? `Your feedback about ${eligibility.propertyName} means a lot. We hope to welcome you back soon!`
              : "You have already submitted a review for this stay. Thank you!"}
          </p>
          <div className="flex flex-col items-center justify-center gap-3 mt-4">
            <Link
              to={buildHomeUnitPath(getPropertySlug({ property_name: eligibility.propertyName }), eligibility.listingId)}
              data-testid="review-success-book-again"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white hover:bg-brand-primary/90 transition-colors"
            >
              Book {eligibility.propertyName} again
            </Link>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap">
              <Link
                to={buildHomeUnitPath(getPropertySlug({ property_name: eligibility.propertyName }), eligibility.listingId)}
                data-testid="review-success-view-property"
                className="inline-block text-sm font-medium text-brand-primary underline underline-offset-2"
              >
                View property
              </Link>
              <span className="hidden sm:inline text-text-muted text-sm" aria-hidden>
                ·
              </span>
              <Link to="/" className="inline-block text-sm text-brand-primary underline underline-offset-2">
                Return to homepage
              </Link>
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`I just stayed at ${eligibility.propertyName} — highly recommend it! Book here: ${window.location.origin}${buildHomeUnitPath(getPropertySlug({ property_name: eligibility.propertyName }), eligibility.listingId)}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="review-success-whatsapp-share"
              className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Share {eligibility.propertyName} with friends
            </a>
          </div>
        </div>
      </div>
    );
  }

  const activeRating = hoveredRating || rating;

  return (
    <>
      <SEO
        title={`Leave a review — ${eligibility.propertyName}`}
        description={`Share your experience staying at ${eligibility.propertyName}.`}
      />
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-10 space-y-6">

        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-text-primary">How was your stay?</h1>
          <p className="text-sm text-text-secondary">
            {eligibility.guestName ? `Hi ${eligibility.guestName.split(" ")[0]}, share` : "Share"} your experience at <strong>{eligibility.propertyName}</strong>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Star rating */}
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-3">
            <p className="text-sm font-medium text-text-primary">Overall rating</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((v) => (
                <StarButton
                  key={v} value={v}
                  selected={v <= rating}
                  hovered={v <= hoveredRating}
                  onHover={setHoveredRating}
                  onClick={setRating}
                />
              ))}
            </div>
            {activeRating > 0 && (
              <p className="text-sm font-semibold text-amber-600">{ratingLabels[activeRating]}</p>
            )}
          </div>

          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-5">
            <p className="text-sm font-medium text-text-primary">Rate specific aspects</p>
            <div className="space-y-5 divide-y divide-border-subtle">
              {SUB_CATEGORY_ROWS.map(({ key, label }) => (
                <div key={key} className="pt-5 first:pt-0">
                  <SubcategoryStars
                    label={label}
                    value={subRatings[key]}
                    hover={subHover[key]}
                    onHover={(v) => setSubHover((h) => ({ ...h, [key]: v }))}
                    onPick={(v) => setSubRatings((s) => ({ ...s, [key]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="review-title" className="text-sm font-medium text-text-primary">
              Headline <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <input
              id="review-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="A few words to sum it up"
              maxLength={100}
              className="w-full rounded-xl border border-border-subtle bg-bg-surface px-4 py-2.5 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <label htmlFor="review-body" className="text-sm font-medium text-text-primary">
              Your experience <span className="text-support-error">*</span>
            </label>
            <textarea
              id="review-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Tell us about the property, cleanliness, host responsiveness, check-in experience…"
              rows={5}
              maxLength={500}
              required
              aria-invalid={bodyTooShort || bodyLen > 500}
              className={`w-full rounded-xl border bg-bg-surface px-4 py-2.5 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary resize-none ${bodyTooShort ? "border-support-error" : "border-border-subtle"}`}
            />
            <p className="text-xs text-text-muted">
              {bodyLen}/20 minimum · {body.length}/500 maximum
            </p>
            {bodyTooShort ? (
              <p className="text-xs text-support-error" role="alert">
                Please write at least 20 characters.
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5 space-y-3">
            <p className="text-sm font-medium text-text-primary">Photos <span className="text-text-muted font-normal">(optional, max 3)</span></p>
            <p className="text-xs text-text-secondary">JPEG, PNG, WebP, or GIF — up to 16 MB each (TASK-2072). Help future guests see what your stay looked like.</p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              disabled={photoBusy || photoUrls.length >= 3}
              data-testid="review-photo-input"
              onChange={handlePhotoPick}
              className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-brand-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50"
            />
            {photoBusy && <p className="text-xs text-text-muted">Uploading&hellip;</p>}
            {photoError && <p className="text-xs text-support-error">{photoError}</p>}
            {photoUrls.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {photoUrls.map((u, idx) => {
                  const safe = sanitizeGuestImageUrl(u);
                  return (
                    <div key={`${u}-${idx}`} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border-subtle bg-bg-muted shrink-0">
                      {safe ? (
                        <img src={safe} alt="Review photo" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      ) : null}
                      <button
                        type="button"
                        aria-label="Remove photo"
                        className="absolute top-1 right-1 rounded-full bg-black/60 text-white text-xs px-1.5 py-0.5 hover:bg-black/80"
                        onClick={() => setPhotoUrls((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {submitError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="w-full rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold py-3 text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting && (
              // TASK-837: inline spinner reassures guests on slow connections
              // that the submission is in-flight (prevents double-taps).
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            )}
            <span>{submitting ? "Submitting…" : "Submit Review"}</span>
          </button>
        </form>

        <div className="text-center pt-2">
          <Link to="/" className="text-sm text-text-muted underline underline-offset-2 hover:text-text-primary">
            ← Back to {brandName}
          </Link>
        </div>
      </div>
    </>
  );
}
