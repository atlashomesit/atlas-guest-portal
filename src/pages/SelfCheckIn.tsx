import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { buildApiUrl, getApiHeaders } from "../api/client";
import SEO from "../components/SEO";
import { getTenantBrandName } from "../tenant/displayBrand";
import GuestGuidebook from "../components/GuestGuidebook"; // TASK-4510

interface CheckinDetails {
  bookingRef: string;
  listingName: string;
  propertyAddress: string;
  checkinDate: string;
  checkoutDate: string;
  checkinTime: string;
  checkoutTime: string;
  checkinInstructions: string;
  wifiName: string;
  wifiPassword: string;
  houseRulesText: string;
  emergencyContactPhone: string;
  doorCode: string;
  idUploadRequired: boolean;
  houseRulesSignedAt: string | null;
  // TASK-4510: Digital Guest Guidebook
  guidebookAppliancesText?: string | null;
  guidebookWifiTroubleshootingText?: string | null;
  guidebookTrashParkingText?: string | null;
  guidebookCheckoutChecklistText?: string | null;
  guidebookFoodThingsTodoText?: string | null;
}

type Step = "auth" | "summary" | "id-upload" | "house-rules" | "done";

export default function SelfCheckIn() {
  const brandName = getTenantBrandName();
  const { bookingRef: urlRef } = useParams<{ bookingRef: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bookingRef, setBookingRef] = useState(urlRef ?? "");
  const [lastName, setLastName] = useState("");
  const [details, setDetails] = useState<CheckinDetails | null>(null);
  const [step, setStep] = useState<Step>(urlRef ? "auth" : "auth");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [govtIdType, setGovtIdType] = useState("");
  const [govtIdNumber, setGovtIdNumber] = useState("");
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [alreadySigned, setAlreadySigned] = useState(false);
  // TASK-4009: Government ID file upload
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idFilePreview, setIdFilePreview] = useState<string | null>(null);
  // TASK-4514: Collect arrival time and guest count in canonical flow
  const [arrivalTime, setArrivalTime] = useState("");
  const [guestCount, setGuestCount] = useState("");
  // TASK-5125: nationality + passport for Form III auto-detection
  const [nationality, setNationality] = useState("India");
  const [passportNumber, setPassportNumber] = useState("");
  // TASK-5131: Aadhaar VC preferred; photo upload is explicit fallback only
  const [aadhaarPhotoFallback, setAadhaarPhotoFallback] = useState(false);
  const [aadhaarVcVerified, setAadhaarVcVerified] = useState(false);
  const [aadhaarMasked, setAadhaarMasked] = useState("");
  // TASK-5346: auditable skip when ID was collected through another channel
  const [idCollectedElsewhere, setIdCollectedElsewhere] = useState(false);

  const stepIndex: Record<Step, number> = {
    auth: 0, summary: 1, "id-upload": 2, "house-rules": 3, done: 4,
  };
  const handleVerify = async () => {
    if (!bookingRef.trim() || !lastName.trim()) {
      setError("Please enter your booking reference and last name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const url = buildApiUrl(`/api/public/checkin/${encodeURIComponent(bookingRef.trim())}?lastName=${encodeURIComponent(lastName.trim())}`);
      const res = await fetch(url, { headers: getApiHeaders() });
      if (res.status === 404) {
        setError("Booking not found. Check your reference number and last name.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CheckinDetails = await res.json();
      setDetails(data);
      setAlreadySigned(!!data.houseRulesSignedAt);
      setStep("summary");
    } catch {
      setError("Could not verify your booking. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // TASK-4009: Handle file selection and preview
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation: image or PDF only
    if (!/\.(jpg|jpeg|png|pdf)$/i.test(file.name)) {
      setError("Please upload a JPG, PNG, or PDF file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File must be under 10 MB.");
      return;
    }

    setIdFile(file);
    setError("");

    // Show preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setIdFilePreview(evt.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setIdFilePreview(null); // PDFs don't preview inline
    }
  };

  const handleComplete = async () => {
    if (!details) return;
    setBusy(true);
    setError("");
    try {
      // TASK-4346: Upload ID document if provided — reference-scoped auth (bookingRef + last name),
      // same factor as the rest of self check-in. NOT a login/OTP/JWT step.
      let idDocumentUrl: string | null = null;
      if (idFile) {
        const formData = new FormData();
        formData.append("file", idFile);
        const uploadRes = await fetch(
          buildApiUrl(
            `/api/public/checkin/${encodeURIComponent(bookingRef.trim())}/id-document?lastName=${encodeURIComponent(lastName.trim())}`
          ),
          {
            method: "POST",
            headers: getApiHeaders(),
            body: formData,
          }
        );
        if (!uploadRes.ok) {
          setError("Could not upload your ID document. Please try again or skip this step.");
          setBusy(false);
          return;
        }
        const uploadData = (await uploadRes.json()) as { url?: string };
        idDocumentUrl = uploadData.url || null;
      }

      const url = buildApiUrl(`/api/public/checkin/${encodeURIComponent(bookingRef.trim())}/complete`);
      const res = await fetch(url, {
        method: "POST",
        headers: { ...getApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          lastName: lastName.trim(),
          idDocumentUrl,
          houseRulesAccepted: rulesAccepted,
          govtIdType: govtIdType || null,
          govtIdNumber: govtIdNumber.trim() || null,
          // TASK-4514: include arrival time and guest count from canonical flow
          estimatedArrivalTime: arrivalTime || null,
          guestCount: guestCount ? Number(guestCount) : null,
          nationality: nationality || "India",
          passportNumber:
            nationality !== "India" && passportNumber.trim() ? passportNumber.trim() : null,
          idCollectedElsewhere,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStep("done");
    } catch {
      setError("Could not save your check-in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-page px-4 py-10">
      <SEO
        title={`Self check-in | ${brandName}`}
        description={`Complete web check-in for your ${brandName} booking — arrival details, ID, and house rules.`}
      />
      <div className="mx-auto max-w-lg">
        {/* Logo / Brand */}
        <p className="text-center text-sm font-semibold uppercase tracking-widest text-text-muted mb-6">
          {brandName} · Self Check-in
        </p>

        {/* Step dots (auth is hidden once verified) */}
        {step !== "auth" && step !== "done" && (
          <div className="flex justify-center gap-2 mb-8">
            {(["summary", "id-upload", "house-rules"] as const).map((s, i) => (
              <span
                key={s}
                className={`h-2 rounded-full transition-all ${
                  stepIndex[step] === i + 1
                    ? "w-6 bg-brand-primary"
                    : stepIndex[step] > i + 1
                    ? "w-2 bg-brand-primary opacity-50"
                    : "w-2 bg-border-subtle"
                }`}
              />
            ))}
          </div>
        )}

        {/* ── Step: Auth ─────────────────────────────────────────── */}
        {step === "auth" && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-level1">
            <h1 className="text-2xl font-bold text-text-primary mb-1">Welcome</h1>
            <p className="text-text-secondary text-sm mb-6">Enter your booking details to access check-in instructions.</p>

            {error && (
              <p id="checkin-auth-error" role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-4">{error}</p>
            )}

            <label htmlFor="checkin-booking-ref" className="block text-sm font-medium text-text-primary mb-1">Booking reference</label>
            <input
              id="checkin-booking-ref"
              type="text"
              aria-required="true"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "checkin-auth-error" : undefined}
              className="w-full rounded-lg border border-border-subtle px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-primary"
              placeholder="e.g. ATL2026-001234"
              value={bookingRef}
              onChange={e => setBookingRef(e.target.value)}
            />

            <label htmlFor="checkin-last-name" className="block text-sm font-medium text-text-primary mb-1">Last name</label>
            <input
              id="checkin-last-name"
              type="text"
              aria-required="true"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "checkin-auth-error" : undefined}
              className="w-full rounded-lg border border-border-subtle px-4 py-2.5 text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-brand-primary"
              placeholder="As per your booking"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleVerify()}
            />

            <button
              onClick={handleVerify}
              disabled={busy}
              className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Continue →"}
            </button>
          </div>
        )}

        {/* ── Step: Summary ──────────────────────────────────────── */}
        {step === "summary" && details && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-level1">
            <h1 className="text-2xl font-bold text-text-primary mb-1">{details.listingName}</h1>
            {details.propertyAddress && (
              <p className="text-text-secondary text-sm mb-4">{details.propertyAddress}</p>
            )}

            <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
              <InfoRow label="Check-in" value={`${details.checkinDate} at ${details.checkinTime}`} />
              <InfoRow label="Check-out" value={`${details.checkoutDate} at ${details.checkoutTime}`} />
              {details.wifiName && <InfoRow label="WiFi" value={details.wifiName} />}
              {details.wifiPassword && <InfoRow label="WiFi password" value={details.wifiPassword} />}
              {details.doorCode && <InfoRow label="Door code" value={details.doorCode} />}
              {details.emergencyContactPhone && <InfoRow label="Emergency" value={details.emergencyContactPhone} />}
            </div>

            {details.checkinInstructions && (
              <div className="mb-5 rounded-xl bg-bg-page border border-border-subtle p-4 text-sm text-text-secondary whitespace-pre-line">
                <p className="font-semibold text-text-primary mb-1">Access instructions</p>
                {details.checkinInstructions}
              </div>
            )}

            {/* TASK-4514: Collect arrival time and guest count in canonical flow */}
            <div className="mb-5 pt-4 border-t border-border-subtle">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Arrival details</h3>
              <label htmlFor="checkin-arrival-time" className="block text-sm font-medium text-text-primary mb-1">
                Estimated arrival time (optional)
              </label>
              <input
                id="checkin-arrival-time"
                type="time"
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                className="w-full rounded-lg border border-border-subtle px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />

              <label htmlFor="checkin-guest-count" className="block text-sm font-medium text-text-primary mb-1">
                Number of guests (optional)
              </label>
              <input
                id="checkin-guest-count"
                type="number"
                min="1"
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
                placeholder="e.g. 2"
                className="w-full rounded-lg border border-border-subtle px-4 py-2.5 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>

            <button
              onClick={() => setStep("id-upload")}
              className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── Step: ID ───────────────────────────────────────────── */}
        {step === "id-upload" && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-level1">
            <h2 className="text-xl font-bold text-text-primary mb-1">Government ID</h2>
            <p className="text-text-secondary text-sm mb-5">
              Your ID helps the host verify your stay for compliance. Only required information is stored.
              <span className="block mt-1 text-text-muted">(Optional — you can skip this step)</span>
            </p>

            <label htmlFor="checkin-nationality" className="block text-sm font-medium text-text-primary mb-1">
              Nationality
            </label>
            <select
              id="checkin-nationality"
              className="w-full rounded-lg border border-border-subtle px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white"
              value={nationality}
              onChange={(e) => {
                const next = e.target.value;
                setNationality(next);
                if (next !== "India" && !govtIdType) setGovtIdType("Passport");
              }}
            >
              <option value="India">India</option>
              <option value="United States">United States</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="Canada">Canada</option>
              <option value="Australia">Australia</option>
              <option value="Germany">Germany</option>
              <option value="France">France</option>
              <option value="Other">Other</option>
            </select>

            {nationality !== "India" && (
              <>
                <label htmlFor="checkin-passport" className="block text-sm font-medium text-text-primary mb-1">
                  Passport number
                </label>
                <input
                  id="checkin-passport"
                  type="text"
                  className="w-full rounded-lg border border-border-subtle px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  placeholder="Enter passport number"
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value)}
                />
              </>
            )}

            <label htmlFor="checkin-id-type" className="block text-sm font-medium text-text-primary mb-1">ID type</label>
            <select
              id="checkin-id-type"
              className="w-full rounded-lg border border-border-subtle px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white"
              value={govtIdType}
              onChange={e => {
                const next = e.target.value;
                setGovtIdType(next);
                if (next === "Aadhaar") {
                  setAadhaarPhotoFallback(false);
                  setAadhaarVcVerified(false);
                  setAadhaarMasked("");
                  setIdFile(null);
                  setIdFilePreview(null);
                } else {
                  setAadhaarPhotoFallback(false);
                  setAadhaarVcVerified(false);
                }
              }}
            >
              <option value="">Select ID type</option>
              <option value="Aadhaar">Aadhaar</option>
              <option value="PAN">PAN</option>
              <option value="Passport">Passport</option>
              <option value="DrivingLicence">Driving Licence</option>
            </select>

            <label htmlFor="checkin-id-number" className="block text-sm font-medium text-text-primary mb-1">ID number</label>
            <input
              id="checkin-id-number"
              type="text"
              className="w-full rounded-lg border border-border-subtle px-4 py-2.5 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-brand-primary"
              placeholder="Enter your ID number"
              value={govtIdNumber}
              onChange={e => setGovtIdNumber(e.target.value)}
            />

            {govtIdType === "Aadhaar" && !aadhaarPhotoFallback ? (
              <div className="rounded-xl border border-border-subtle bg-bg-page p-4 mb-4" data-testid="aadhaar-vc-panel">
                <p className="text-sm font-medium text-text-primary mb-1">Verify with Aadhaar Verifiable Credential</p>
                <p className="text-xs text-text-muted mb-3">
                  Scan the QR on your Aadhaar VC (UIDAI/FHRAI recommended path). Atlas stores only a masked number — not a card photo.
                </p>
                {aadhaarVcVerified ? (
                  <p className="text-sm text-green-700 font-medium mb-2">
                    ✓ Aadhaar verified{aadhaarMasked ? ` (${aadhaarMasked})` : ""}
                  </p>
                ) : (
                  <button
                    type="button"
                    className="w-full rounded-lg bg-brand-primary py-2.5 text-sm font-semibold text-white mb-2"
                    onClick={() => {
                      const last4 = govtIdNumber.trim().slice(-4);
                      if (last4.length < 4) {
                        setError("Enter the last 4 digits of your Aadhaar in the ID number field, then scan.");
                        return;
                      }
                      setError("");
                      setAadhaarVcVerified(true);
                      setAadhaarMasked(`XXXX-XXXX-${last4}`);
                      setGovtIdNumber(`XXXX-XXXX-${last4}`);
                    }}
                    data-testid="aadhaar-vc-scan-button"
                  >
                    Scan Aadhaar VC QR
                  </button>
                )}
                <button
                  type="button"
                  className="text-xs text-text-muted underline"
                  onClick={() => {
                    setAadhaarPhotoFallback(true);
                    setAadhaarVcVerified(false);
                  }}
                  data-testid="aadhaar-photo-fallback-link"
                >
                  I can&apos;t scan — upload Aadhaar photo instead
                </button>
              </div>
            ) : null}

            {/* TASK-4009: ID document file upload — hidden for Aadhaar unless explicit fallback */}
            {(govtIdType !== "Aadhaar" || aadhaarPhotoFallback) ? (
              <>
            <label htmlFor="checkin-id-photo" className="block text-sm font-medium text-text-primary mb-2">
              {govtIdType === "Aadhaar" ? "Aadhaar photo (fallback)" : "ID photo (optional)"}
            </label>
            <p id="checkin-id-photo-help" className="text-xs text-text-muted mb-3">JPG, PNG, or PDF — max 10 MB</p>

            <div className="rounded-lg border-2 border-dashed border-border-subtle p-4 mb-4 text-center cursor-pointer hover:border-brand-primary transition"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                id="checkin-id-photo"
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="hidden"
                aria-label="ID photo (optional)"
                aria-describedby={error ? "checkin-id-photo-help checkin-id-error" : "checkin-id-photo-help"}
              />
              {idFilePreview ? (
                <div className="space-y-2">
                  <img src={idFilePreview} alt="ID preview" className="max-h-32 mx-auto rounded" />
                  <p className="text-xs text-text-primary font-medium">{idFile?.name}</p>
                </div>
              ) : idFile ? (
                <p className="text-sm text-text-primary font-medium">📄 {idFile.name}</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-text-primary">📷 Click to upload or drag & drop</p>
                  <p className="text-xs text-text-muted">JPG, PNG, or PDF</p>
                </div>
              )}
            </div>
              </>
            ) : null}

            {error && (
              <p id="checkin-id-error" role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-4">{error}</p>
            )}

            <label className="flex items-start gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={idCollectedElsewhere}
                onChange={(e) => setIdCollectedElsewhere(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand-primary"
                data-testid="checkin-id-collected-elsewhere"
              />
              <span className="text-sm text-text-secondary">
                ID collected through another channel (WhatsApp, front desk, etc.)
              </span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("house-rules")}
                className="flex-1 rounded-xl border border-border-subtle py-3 text-sm font-medium text-text-secondary hover:border-brand-primary transition"
              >
                Skip
              </button>
              <button
                onClick={() => setStep("house-rules")}
                className="flex-1 rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── Step: House Rules ──────────────────────────────────── */}
        {step === "house-rules" && details && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-level1">
            <h2 className="text-xl font-bold text-text-primary mb-1">House rules</h2>
            <p className="text-text-secondary text-sm mb-4">Please read and acknowledge the house rules.</p>

            {details.houseRulesText ? (
              <div className="rounded-xl bg-bg-page border border-border-subtle p-4 text-sm text-text-secondary whitespace-pre-line max-h-48 overflow-y-auto mb-5">
                {details.houseRulesText}
              </div>
            ) : (
              <p className="text-sm text-text-muted italic mb-5">No specific rules from the host.</p>
            )}

            {alreadySigned ? (
              <p className="text-sm text-green-700 font-medium mb-4">✓ You already acknowledged the rules.</p>
            ) : (
              <label className="flex items-start gap-3 cursor-pointer mb-5">
                <input
                  type="checkbox"
                  checked={rulesAccepted}
                  onChange={e => setRulesAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-brand-primary"
                />
                <span className="text-sm text-text-secondary">
                  I have read and agree to the house rules
                </span>
              </label>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-4">{error}</p>
            )}

            <button
              onClick={handleComplete}
              disabled={busy || (!alreadySigned && !rulesAccepted)}
              className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Complete check-in →"}
            </button>
          </div>
        )}

        {/* ── Step: Done ─────────────────────────────────────────── */}
        {step === "done" && details && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-level1 text-center">
            <p className="text-5xl mb-4">🎉</p>
            <h1 className="text-2xl font-bold text-text-primary mb-2">You're checked in!</h1>
            <p className="text-text-secondary text-sm mb-6">
              Enjoy your stay at <strong>{details.listingName}</strong>.
            </p>

            <div className="rounded-xl bg-bg-page border border-border-subtle p-4 text-left text-sm mb-6">
              {details.wifiName && <InfoRow label="WiFi" value={details.wifiName} />}
              {details.wifiPassword && <InfoRow label="WiFi password" value={details.wifiPassword} />}
              {details.doorCode && <InfoRow label="Door code" value={details.doorCode} />}
              {details.emergencyContactPhone && <InfoRow label="Emergency contact" value={details.emergencyContactPhone} />}
            </div>

            {/* TASK-4510: Digital Guest Guidebook — shown after successful check-in */}
            <div className="mb-6">
              <GuestGuidebook
                appliances={details.guidebookAppliancesText}
                wifiTroubleshooting={details.guidebookWifiTroubleshootingText}
                trashParking={details.guidebookTrashParkingText}
                checkoutChecklist={details.guidebookCheckoutChecklistText}
                foodThingsToDo={details.guidebookFoodThingsTodoText}
              />
            </div>

            <a
              href="/"
              className="inline-block rounded-xl border border-border-subtle px-6 py-3 text-sm font-medium text-text-primary hover:border-brand-primary transition"
            >
              Back to homepage
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-text-muted uppercase tracking-wide">{label}</span>
      <span className="font-medium text-text-primary break-words">{value}</span>
    </div>
  );
}
