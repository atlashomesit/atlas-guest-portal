import React, { useMemo, useState } from "react";
import { api } from "../../api/client";

export type LostItemStatus = "Reported" | "Found" | "Returned" | "Not found";

export interface LostItemReport {
  id: number;
  itemDescription: string;
  whereLeft?: string | null;
  status: LostItemStatus | string;
  courierTrackingNote?: string | null;
  createdAtUtc?: string | null;
}

export interface LostItemReportCardProps {
  bookingId: number | string;
  token?: string | null;
  status?: string | null;
  checkoutDateIso?: string | null;
  guestReportedCheckoutAtUtc?: string | null;
  initialReports?: LostItemReport[];
  now?: Date;
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isWithinLostItemWindow(args: {
  status?: string | null;
  checkoutDateIso?: string | null;
  guestReportedCheckoutAtUtc?: string | null;
  now?: Date;
}): boolean {
  const now = args.now ?? new Date();
  const normalizedStatus = (args.status ?? "").toLowerCase();
  const isCheckedOut =
    normalizedStatus.includes("checkedout") ||
    normalizedStatus.includes("checked_out") ||
    normalizedStatus.includes("completed") ||
    Boolean(args.guestReportedCheckoutAtUtc);

  if (!args.checkoutDateIso) {
    return isCheckedOut;
  }

  const checkoutDate = new Date(`${args.checkoutDateIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(checkoutDate.getTime())) {
    return isCheckedOut;
  }

  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const checkoutUtc = checkoutDate.getTime();
  const daysSinceCheckout = Math.floor((todayUtc - checkoutUtc) / (24 * 60 * 60 * 1000));

  if (daysSinceCheckout > 30) {
    return false;
  }

  return isCheckedOut || daysSinceCheckout >= 0;
}

function statusBadgeClasses(status: string): string {
  const s = status.toLowerCase();
  if (s === "returned") return "bg-green-100 text-green-800";
  if (s === "found") return "bg-blue-100 text-blue-800";
  if (s === "not found" || s === "not_found") return "bg-slate-200 text-slate-700";
  return "bg-amber-100 text-amber-800";
}

export const LostItemReportCard: React.FC<LostItemReportCardProps> = ({
  bookingId,
  token,
  status,
  checkoutDateIso,
  guestReportedCheckoutAtUtc,
  initialReports = [],
  now,
}) => {
  const eligible = useMemo(
    () =>
      isWithinLostItemWindow({
        status,
        checkoutDateIso,
        guestReportedCheckoutAtUtc,
        now,
      }),
    [status, checkoutDateIso, guestReportedCheckoutAtUtc, now],
  );

  const [open, setOpen] = useState(false);
  const [reports, setReports] = useState<LostItemReport[]>(initialReports);
  const [itemDescription, setItemDescription] = useState("");
  const [whereLeft, setWhereLeft] = useState("");
  const [returnAddress, setReturnAddress] = useState("");
  const [returnPhone, setReturnPhone] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!eligible) {
    return null;
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setPhotoFile(null);
      return;
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setPhotoFile(null);
      setPhotoError("Please upload a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoFile(null);
      setPhotoError("Photo must be 5 MB or smaller.");
      return;
    }
    setPhotoFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedDesc = itemDescription.trim();
    if (!trimmedDesc) {
      setErrorMsg("Please describe the item you left behind.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("itemDescription", trimmedDesc);
      if (whereLeft.trim()) formData.append("whereLeft", whereLeft.trim());
      if (returnAddress.trim()) formData.append("returnShippingAddress", returnAddress.trim());
      if (returnPhone.trim()) formData.append("returnPhone", returnPhone.trim());
      if (photoFile) formData.append("photo", photoFile);

      const res = await api.post(
        `/public/bookings/${bookingId}/lost-items`,
        formData,
        {
          params: token ? { t: token } : undefined,
        },
      );

      const created: LostItemReport = {
        id: res?.data?.id ?? Date.now(),
        itemDescription: res?.data?.itemDescription ?? trimmedDesc,
        whereLeft: res?.data?.whereLeft ?? (whereLeft.trim() || null),
        status: res?.data?.status ?? "Reported",
        courierTrackingNote: res?.data?.courierTrackingNote ?? null,
        createdAtUtc: res?.data?.createdAtUtc ?? new Date().toISOString(),
      };

      setReports((prev) => [created, ...prev]);
      setItemDescription("");
      setWhereLeft("");
      setReturnAddress("");
      setReturnPhone("");
      setPhotoFile(null);
      setOpen(false);
      setSuccessMsg("Your lost item report has been sent to the host.");
    } catch {
      setErrorMsg("Could not submit your report right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      data-testid="lost-item-card"
      className="rounded-2xl border border-border-subtle bg-bg-surface p-5 shadow-sm mb-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Lost &amp; Found</h3>
          <p className="text-xs text-text-secondary mt-0.5">
            Forgot a charger, jewellery, or documents? Report it within 30 days of checkout.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          data-testid="lost-item-open-btn"
          className="min-h-[44px] rounded-xl border border-brand-primary px-4 py-2 text-sm font-semibold text-brand-primary hover:bg-brand-primary/5 transition"
        >
          {open ? "Close form" : "Left something behind?"}
        </button>
      </div>

      {successMsg && (
        <div
          data-testid="lost-item-success"
          className="mt-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs font-medium text-green-800"
        >
          ✓ {successMsg}
        </div>
      )}

      {open && (
        <form
          onSubmit={handleSubmit}
          data-testid="lost-item-form"
          className="mt-4 space-y-3 border-t border-border-subtle pt-4"
        >
          <div>
            <label htmlFor="lost-item-desc" className="block text-xs font-medium text-text-primary mb-1">
              What did you leave behind? *
            </label>
            <textarea
              id="lost-item-desc"
              data-testid="lost-item-desc"
              rows={2}
              maxLength={400}
              required
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              placeholder="E.g. Black USB-C laptop charger"
              className="w-full rounded-lg border border-border-subtle bg-bg-page px-3 py-2 text-sm text-text-primary"
            />
          </div>

          <div>
            <label htmlFor="lost-item-where" className="block text-xs font-medium text-text-primary mb-1">
              Room or where you think it was left
            </label>
            <input
              id="lost-item-where"
              data-testid="lost-item-where"
              type="text"
              maxLength={200}
              value={whereLeft}
              onChange={(e) => setWhereLeft(e.target.value)}
              placeholder="E.g. Master bedroom nightstand"
              className="w-full min-h-[44px] rounded-lg border border-border-subtle bg-bg-page px-3 py-2 text-sm text-text-primary"
            />
          </div>

          <div>
            <label htmlFor="lost-item-photo" className="block text-xs font-medium text-text-primary mb-1">
              Optional photo (JPG, PNG, or WebP, max 5 MB)
            </label>
            <input
              id="lost-item-photo"
              data-testid="lost-item-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
              className="w-full text-xs text-text-secondary"
            />
            {photoError && (
              <p data-testid="lost-item-photo-error" className="mt-1 text-xs text-red-600">
                {photoError}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="lost-item-address" className="block text-xs font-medium text-text-primary mb-1">
                Return shipping address
              </label>
              <input
                id="lost-item-address"
                data-testid="lost-item-address"
                type="text"
                maxLength={300}
                value={returnAddress}
                onChange={(e) => setReturnAddress(e.target.value)}
                placeholder="Street, city, PIN code"
                className="w-full min-h-[44px] rounded-lg border border-border-subtle bg-bg-page px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div>
              <label htmlFor="lost-item-phone" className="block text-xs font-medium text-text-primary mb-1">
                Contact phone for courier
              </label>
              <input
                id="lost-item-phone"
                data-testid="lost-item-phone"
                type="tel"
                maxLength={30}
                value={returnPhone}
                onChange={(e) => setReturnPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full min-h-[44px] rounded-lg border border-border-subtle bg-bg-page px-3 py-2 text-sm text-text-primary"
              />
            </div>
          </div>

          {errorMsg && (
            <p data-testid="lost-item-error" className="text-xs text-red-600">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            data-testid="lost-item-submit-btn"
            className="min-h-[44px] w-full sm:w-auto rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60 transition"
          >
            {submitting ? "Submitting…" : "Submit lost item report"}
          </button>
        </form>
      )}

      {reports.length > 0 && (
        <div data-testid="lost-item-list" className="mt-4 space-y-2 border-t border-border-subtle pt-3">
          {reports.map((rep) => (
            <div
              key={rep.id}
              data-testid={`lost-item-row-${rep.id}`}
              className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-bg-page border border-border-subtle p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary break-words">{rep.itemDescription}</p>
                {rep.whereLeft && (
                  <p className="text-xs text-text-secondary mt-0.5">Location: {rep.whereLeft}</p>
                )}
                {rep.courierTrackingNote && (
                  <p className="text-xs text-text-secondary mt-0.5">Tracking: {rep.courierTrackingNote}</p>
                )}
              </div>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClasses(rep.status)}`}
              >
                {rep.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default LostItemReportCard;
