import { useState } from "react";
import { useParams } from "react-router-dom";
import { buildApiUrl, getApiHeaders } from "../api/client";
import SEO from "../components/SEO";
import { getTenantBrandName } from "../tenant/displayBrand";
import GuestGuidebook from "../components/GuestGuidebook"; // TASK-4510
import DamageWaiverSignature, { type SignatureMode } from "../components/DamageWaiverSignature"; // TASK-1975

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
  /**
   * ISO-8601 UTC timestamp (from atlas-api `SelfCheckinDetailsDto.HouseRulesSignedAt`, a
   * `DateTime?` serialized by `UtcIsoNullableDateTimeJsonConverter`) once the guest has accepted
   * house rules; null until then. Lets a resumed self check-in skip re-showing the checkbox.
   */
  houseRulesSignedAt?: string | null;
  guestCount?: number | null;
  guestName?: string | null;
  // TASK-4510: Digital Guest Guidebook
  guidebookAppliancesText?: string | null;
  guidebookWifiTroubleshootingText?: string | null;
  guidebookTrashParkingText?: string | null;
  guidebookCheckoutChecklistText?: string | null;
  guidebookFoodThingsTodoText?: string | null;
}

export interface GuestInfo {
  name: string;
  govtIdType: string;
  govtIdNumber: string;
  phoneNumber: string;
  isVerified: boolean;
  verificationMethod?: "DigiLocker" | "OTP" | "Photo";
  maskedNumber?: string;
  idFile?: File | null;
  idFilePreview?: string | null;
  uploadedFileUrl?: string | null;
  otpSent?: boolean;
  otpCode?: string;
  enteredOtp?: string;
  otpError?: string;
  activeVerifyTab?: "digilocker" | "otp" | "photo";
}

type Step = "auth" | "summary" | "id-upload" | "house-rules" | "damage-waiver" | "done";

export default function SelfCheckIn() {
  const brandName = getTenantBrandName();
  const { bookingRef: urlRef } = useParams<{ bookingRef: string }>();

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
  // TASK-1975
  const [waiverPdfUrl, setWaiverPdfUrl] = useState<string | null>(null);
  const [waiverAlreadySigned, setWaiverAlreadySigned] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [waiverAgreed, setWaiverAgreed] = useState(false);
  // TASK-4009: Government ID file upload
  const [idFile, setIdFile] = useState<File | null>(null);
  // TASK-102530: setIdFilePreview is still called live from updateGuest() (mirrors the primary
  // guest's preview into this top-level slot), but nothing reads the value back — the UI renders
  // the per-guest g.idFilePreview instead. Kept (not deleted) so that live setter call stays
  // valid; prefixed so the now-dead read doesn't trip no-unused-vars.
  const [_idFilePreview, setIdFilePreview] = useState<string | null>(null);
  // TASK-4514: Collect arrival time and guest count in canonical flow
  const [arrivalTime, setArrivalTime] = useState("");
  const [guestCount, setGuestCount] = useState("");
  // TASK-5125 / TASK-101110: do not default to India — a blank field must not overwrite a
  // host-set foreign nationality on complete (API also preserves host-set when nationality omitted).
  const [nationality, setNationality] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  // TASK-5131: Aadhaar VC preferred; photo upload is explicit fallback only
  const [aadhaarVcVerified, setAadhaarVcVerified] = useState(false);
  // TASK-102530: setAadhaarMasked is still called live from updateGuest() and
  // handleContinueFromIdUpload() (mirrors the primary guest's masked Aadhaar number into this
  // top-level slot), but nothing reads the value back — the UI renders the per-guest
  // g.maskedNumber instead. Kept (not deleted) so those live setter calls stay valid; prefixed
  // so the now-dead read doesn't trip no-unused-vars.
  const [_aadhaarMasked, setAadhaarMasked] = useState("");
  // TASK-5346: auditable skip when ID was collected through another channel
  const [idCollectedElsewhere, setIdCollectedElsewhere] = useState(false);
  const [guests, setGuests] = useState<GuestInfo[]>([
    {
      name: "",
      govtIdType: "",
      govtIdNumber: "",
      phoneNumber: "",
      isVerified: false,
      activeVerifyTab: "digilocker",
    },
  ]);

  const stepIndex: Record<Step, number> = {
    auth: 0, summary: 1, "id-upload": 2, "house-rules": 3, "damage-waiver": 4, done: 5,
  };

  const updateGuest = (index: number, patch: Partial<GuestInfo>) => {
    setGuests((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], ...patch };
      }
      return next;
    });
    if (index === 0) {
      if (patch.govtIdType !== undefined) setGovtIdType(patch.govtIdType);
      if (patch.govtIdNumber !== undefined) setGovtIdNumber(patch.govtIdNumber);
      if (patch.isVerified !== undefined) {
        setAadhaarVcVerified(patch.isVerified);
        if (patch.maskedNumber !== undefined) setAadhaarMasked(patch.maskedNumber);
      }
      if (patch.idFile !== undefined) {
        setIdFile(patch.idFile || null);
        setIdFilePreview(patch.idFilePreview || null);
      }
    }
  };

  const handleSendOtp = (idx: number) => {
    const guest = guests[idx];
    if (!guest) return;
    const cleanPhone = guest.phoneNumber.trim().replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      updateGuest(idx, { otpError: "Please enter a valid 10-digit mobile number." });
      return;
    }
    const mockCode = String(Math.floor(100000 + Math.random() * 900000));
    updateGuest(idx, {
      otpSent: true,
      otpCode: mockCode,
      otpError: "",
    });
  };

  const handlePasteOtp = (idx: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const paste = e.clipboardData.getData("text");
    const digits = paste.replace(/\D/g, "").slice(0, 6);
    if (digits) {
      e.preventDefault();
      updateGuest(idx, { enteredOtp: digits, otpError: "" });
    }
  };

  const handleVerifyOtp = (idx: number) => {
    const guest = guests[idx];
    if (!guest) return;
    const entered = (guest.enteredOtp || "").trim();
    if (entered.length < 4) {
      updateGuest(idx, { otpError: "Please enter or paste the 6-digit OTP." });
      return;
    }
    const last4 = guest.govtIdNumber.trim().slice(-4) || (guest.phoneNumber.trim().slice(-4) || "0000");
    const masked = `XXXX-XXXX-${last4}`;
    const nextGuests = [...guests];
    nextGuests[idx] = {
      ...guest,
      isVerified: true,
      verificationMethod: "OTP",
      maskedNumber: masked,
      otpError: "",
    };
    setGuests(nextGuests);

    if (idx === 0) {
      setGovtIdType(nextGuests[0].govtIdType || "Aadhaar");
      setGovtIdNumber(nextGuests[0].govtIdNumber || masked);
      setAadhaarVcVerified(true);
      setAadhaarMasked(masked);
    }
    setError("");

    // Advance to next step once all guests are verified
    const allGuestsReady = nextGuests.every(
      (g) => g.isVerified || g.idFile || idCollectedElsewhere
    );
    if (allGuestsReady) {
      setTimeout(() => {
        setStep("house-rules");
      }, 500);
    }
  };

  const handleVerifyDigiLocker = (idx: number) => {
    const guest = guests[idx];
    if (!guest) return;
    const num = guest.govtIdNumber.trim();
    if (num.length < 4) {
      setError(`Please enter the ID number for Guest ${idx + 1} before verifying.`);
      return;
    }
    setError("");
    const last4 = num.slice(-4);
    const masked = `XXXX-XXXX-${last4}`;
    const nextGuests = [...guests];
    nextGuests[idx] = {
      ...guest,
      isVerified: true,
      verificationMethod: "DigiLocker",
      maskedNumber: masked,
    };
    setGuests(nextGuests);
    if (idx === 0) {
      setGovtIdType(nextGuests[0].govtIdType || "Aadhaar");
      setGovtIdNumber(masked);
      setAadhaarVcVerified(true);
      setAadhaarMasked(masked);
    }

    const allGuestsReady = nextGuests.every(
      (g) => g.isVerified || g.idFile || idCollectedElsewhere
    );
    if (allGuestsReady) {
      setTimeout(() => {
        setStep("house-rules");
      }, 500);
    }
  };

  const handleGuestFileSelect = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!/\.(jpg|jpeg|png|pdf)$/i.test(file.name)) {
      setError("Please upload a JPG, PNG, or PDF file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File must be under 10 MB.");
      return;
    }

    setError("");
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        updateGuest(idx, {
          idFile: file,
          idFilePreview: evt.target?.result as string,
        });
      };
      reader.readAsDataURL(file);
    } else {
      updateGuest(idx, {
        idFile: file,
        idFilePreview: null,
      });
    }
  };

  const handleContinueFromSummary = () => {
    const count = parseInt(guestCount, 10);
    if (!guestCount.trim() || isNaN(count) || count < 1) {
      setError("Please enter the number of guests (at least 1) to continue.");
      return;
    }
    setError("");
    setGuests((prev) => {
      const updated: GuestInfo[] = [];
      for (let i = 0; i < count; i++) {
        if (prev[i]) {
          updated.push(prev[i]);
        } else {
          updated.push({
            name: i === 0 && details?.guestName ? details.guestName : "",
            govtIdType: "",
            govtIdNumber: "",
            phoneNumber: "",
            isVerified: false,
            activeVerifyTab: "digilocker",
          });
        }
      }
      return updated;
    });
    setStep("id-upload");
  };

  const handleContinueFromIdUpload = () => {
    if (idCollectedElsewhere) {
      setError("");
      setStep("house-rules");
      return;
    }

    for (let i = 0; i < guests.length; i++) {
      const g = guests[i];
      const label = i === 0 ? "Guest 1 (Primary Guest)" : `Guest ${i + 1}`;
      if (!g.name.trim()) {
        setError(`Please enter the full name for ${label}.`);
        return;
      }
      if (!g.govtIdType) {
        setError(`Please select the ID type for ${label}.`);
        return;
      }
      if (!g.govtIdNumber.trim()) {
        setError(`Please enter the ID number for ${label}.`);
        return;
      }
    }

    // Sync primary guest values back to top-level states
    if (guests[0]) {
      setGovtIdType(guests[0].govtIdType);
      setGovtIdNumber(guests[0].govtIdNumber);
      if (guests[0].idFile) setIdFile(guests[0].idFile);
      if (guests[0].isVerified) {
        setAadhaarVcVerified(true);
        setAadhaarMasked(guests[0].maskedNumber || "");
      }
    }

    setError("");
    setStep("house-rules");
  };

  const proceedFromHouseRules = async () => {
    if (!details) return;
    setBusy(true);
    setError("");
    try {
      const url = buildApiUrl(
        `/api/public/checkin/${encodeURIComponent(bookingRef.trim())}/damage-waiver?lastName=${encodeURIComponent(lastName.trim())}`
      );
      const res = await fetch(url, { headers: getApiHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const status = (await res.json()) as {
        required: boolean;
        signed: boolean;
        waiverPdfUrl?: string | null;
      };
      if (status.signed) {
        setWaiverAlreadySigned(true);
        await handleComplete();
        return;
      }
      setWaiverPdfUrl(status.waiverPdfUrl ?? null);
      setStep("damage-waiver");
    } catch {
      setError("Could not load the damage waiver. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignWaiver = async (payload: {
    signatureType: SignatureMode;
    typedName?: string;
    signatureBlob?: Blob;
  }) => {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("signatureType", payload.signatureType);
      if (payload.typedName) form.append("typedName", payload.typedName);
      if (payload.signatureBlob) form.append("signatureBlob", payload.signatureBlob, "signature.png");

      const res = await fetch(
        buildApiUrl(
          `/api/public/checkin/${encodeURIComponent(bookingRef.trim())}/damage-waiver/sign?lastName=${encodeURIComponent(lastName.trim())}`
        ),
        { method: "POST", headers: getApiHeaders(), body: form }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error || "Could not save your signature. Please try again.");
        setBusy(false);
        return;
      }
      setShowSignModal(false);
      setWaiverAlreadySigned(true);
      await handleComplete();
    } catch {
      setError("Could not save your signature. Please try again.");
      setBusy(false);
    }
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
      const countStr = data.guestCount ? String(data.guestCount) : (guestCount || "1");
      setGuestCount(countStr);
      const initialCount = parseInt(countStr, 10) || 1;
      const initialGuests: GuestInfo[] = [];
      for (let i = 0; i < initialCount; i++) {
        initialGuests.push({
          name: i === 0 && data.guestName ? data.guestName : "",
          govtIdType: "",
          govtIdNumber: "",
          phoneNumber: "",
          isVerified: false,
          activeVerifyTab: "digilocker",
        });
      }
      setGuests(initialGuests);
      setStep("summary");
    } catch {
      setError("Could not verify your booking. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    if (!details) return;
    setBusy(true);
    setError("");
    try {
      // TASK-4346: Upload ID document if provided
      let idDocumentUrl: string | null = null;
      const primaryFile = guests[0]?.idFile || idFile;
      if (primaryFile) {
        const formData = new FormData();
        formData.append("file", primaryFile);
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

      // Upload files for additional guests (Guest 2..N) if any
      const additionalGuestsPayload = [];
      for (let i = 1; i < guests.length; i++) {
        const g = guests[i];
        let fileUrl = g.uploadedFileUrl || null;
        if (g.idFile && !fileUrl) {
          const formData = new FormData();
          formData.append("file", g.idFile);
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
          if (uploadRes.ok) {
            const uploadData = (await uploadRes.json()) as { url?: string };
            fileUrl = uploadData.url || null;
          }
        }
        additionalGuestsPayload.push({
          name: g.name.trim() || null,
          govtIdType: g.govtIdType || null,
          govtIdNumber: g.govtIdNumber.trim() || null,
          fileUrl,
          isVerified: g.isVerified,
          verificationMethod: g.verificationMethod || null,
        });
      }

      const primary = guests[0];
      const url = buildApiUrl(`/api/public/checkin/${encodeURIComponent(bookingRef.trim())}/complete`);
      const res = await fetch(url, {
        method: "POST",
        headers: { ...getApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          lastName: lastName.trim(),
          idDocumentUrl,
          houseRulesAccepted: rulesAccepted,
          govtIdType: primary?.govtIdType || govtIdType || null,
          govtIdNumber: (primary?.govtIdNumber || govtIdNumber).trim() || null,
          // TASK-4514: include arrival time and guest count from canonical flow
          estimatedArrivalTime: arrivalTime || null,
          guestCount: guestCount ? Number(guestCount) : null,
          nationality: nationality.trim() || null,
          passportNumber:
            nationality.trim() &&
            nationality.trim().toLowerCase() !== "india" &&
            passportNumber.trim()
              ? passportNumber.trim()
              : null,
          idCollectedElsewhere,
          isVerified: primary ? primary.isVerified : aadhaarVcVerified,
          verificationMethod: primary ? primary.verificationMethod : (aadhaarVcVerified ? "DigiLocker" : null),
          additionalGuests: additionalGuestsPayload.length > 0 ? additionalGuestsPayload : null,
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
            {(["summary", "id-upload", "house-rules", "damage-waiver"] as const).map((s, i) => (
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
                Number of guests *
              </label>
              <input
                id="checkin-guest-count"
                type="number"
                min="1"
                required
                aria-required="true"
                value={guestCount}
                onChange={(e) => {
                  setGuestCount(e.target.value);
                  if (error) setError("");
                }}
                placeholder="e.g. 2"
                className="w-full rounded-lg border border-border-subtle px-4 py-2.5 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-4">{error}</p>
            )}

            <button
              onClick={handleContinueFromSummary}
              className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── Step: ID ───────────────────────────────────────────── */}
        {step === "id-upload" && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-level1">
            <h2 className="text-xl font-bold text-text-primary mb-1">Government ID Verification</h2>
            <p className="text-text-secondary text-sm mb-5">
              Please provide and verify government-issued ID for all {guests.length} {guests.length === 1 ? "guest" : "guests"}.
              <span className="block mt-1 text-text-muted">(IDs can be verified via DigiLocker or Mobile OTP connected to the ID)</span>
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
                if (next && next !== "India" && !govtIdType) {
                  setGovtIdType("Passport");
                  updateGuest(0, { govtIdType: "Passport" });
                }
              }}
            >
              <option value="">Select nationality</option>
              <option value="India">India</option>
              <option value="United States">United States</option>
              <option value="United States (OCI)">United States (OCI)</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="United Kingdom (OCI)">United Kingdom (OCI)</option>
              <option value="Canada">Canada</option>
              <option value="Australia">Australia</option>
              <option value="Germany">Germany</option>
              <option value="France">France</option>
              <option value="Other">Other</option>
            </select>

            {nationality !== "" && nationality !== "India" && (
              <>
                <label htmlFor="checkin-passport" className="block text-sm font-medium text-text-primary mb-1">
                  Passport number
                </label>
                <input
                  id="checkin-passport"
                  type="text"
                  className="w-full rounded-lg border border-border-subtle px-4 py-2.5 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  placeholder="Enter passport number"
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value)}
                />
              </>
            )}

            {/* Guest ID Cards */}
            <div className="space-y-6 mb-6">
              {guests.map((g, idx) => {
                const isFirst = idx === 0;
                const guestLabel = isFirst ? "Guest 1 (Primary Guest)" : `Guest ${idx + 1}`;
                const idTypeInputId = isFirst ? "checkin-id-type" : `checkin-id-type-${idx}`;
                const idNumberInputId = isFirst ? "checkin-id-number" : `checkin-id-number-${idx}`;
                const idPhotoInputId = isFirst ? "checkin-id-photo" : `checkin-id-photo-${idx}`;
                const idPhotoHelpId = isFirst ? "checkin-id-photo-help" : `checkin-id-photo-help-${idx}`;

                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-border-subtle bg-bg-page p-5"
                    data-testid={`guest-card-${idx}`}
                  >
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-border-subtle">
                      <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                        <span>👤 {guestLabel}</span>
                      </h3>
                      {g.isVerified ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                          ✓ Verified ({g.verificationMethod})
                        </span>
                      ) : (g.idFile || g.uploadedFileUrl) ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          Photo attached
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          Pending Verification
                        </span>
                      )}
                    </div>

                    {/* Guest Name */}
                    <label htmlFor={`checkin-guest-name-${idx}`} className="block text-sm font-medium text-text-primary mb-1">
                      {isFirst ? "Full name (as on ID) *" : `Full name (Guest ${idx + 1}) *`}
                    </label>
                    <input
                      id={`checkin-guest-name-${idx}`}
                      type="text"
                      required
                      value={g.name}
                      onChange={(e) => updateGuest(idx, { name: e.target.value })}
                      placeholder="Enter guest's full name"
                      className="w-full rounded-lg border border-border-subtle px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white"
                    />

                    {/* ID Type */}
                    <label htmlFor={idTypeInputId} className="block text-sm font-medium text-text-primary mb-1">
                      {isFirst ? "ID type" : `ID type (${guestLabel})`}
                    </label>
                    <select
                      id={idTypeInputId}
                      className="w-full rounded-lg border border-border-subtle px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white"
                      value={g.govtIdType}
                      onChange={(e) => {
                        const next = e.target.value;
                        updateGuest(idx, {
                          govtIdType: next,
                          isVerified: false,
                          verificationMethod: undefined,
                          maskedNumber: undefined,
                          otpSent: false,
                          activeVerifyTab: next === "Aadhaar" ? "digilocker" : "otp",
                        });
                      }}
                    >
                      <option value="">Select ID type</option>
                      <option value="Aadhaar">Aadhaar</option>
                      <option value="Passport">Passport</option>
                      <option value="DrivingLicence">Driving Licence</option>
                      <option value="PAN">PAN</option>
                      <option value="Voter ID">Voter ID</option>
                    </select>

                    {/* ID Number */}
                    <label htmlFor={idNumberInputId} className="block text-sm font-medium text-text-primary mb-1">
                      {isFirst ? "ID number" : `ID number (${guestLabel})`}
                    </label>
                    <input
                      id={idNumberInputId}
                      type="text"
                      className="w-full rounded-lg border border-border-subtle px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white"
                      placeholder="Enter ID number"
                      value={g.govtIdNumber}
                      onChange={(e) => updateGuest(idx, { govtIdNumber: e.target.value })}
                    />

                    {/* Verification Panel */}
                    {g.isVerified ? (
                      <div className="rounded-xl border border-green-200 bg-green-50 p-4 mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-green-800 text-sm font-medium">
                          <span className="text-lg">✓</span>
                          <span>
                            {g.govtIdType || "ID"} verified via {g.verificationMethod}
                            {g.maskedNumber ? ` (${g.maskedNumber})` : ""}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateGuest(idx, {
                              isVerified: false,
                              verificationMethod: undefined,
                              maskedNumber: undefined,
                              otpSent: false,
                            })
                          }
                          className="text-xs text-green-700 underline hover:text-green-900"
                        >
                          Change / Re-verify
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4 mb-4">
                        {/* Digital Verification (DigiLocker & Phone OTP) */}
                        <div
                          className="rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm"
                          data-testid={isFirst ? "aadhaar-vc-panel" : undefined}
                        >
                          <p className="text-sm font-semibold text-text-primary mb-1">
                            Digital ID Verification
                          </p>
                          <p className="text-xs text-text-muted mb-3">
                            Verify instantly with DigiLocker or via the phone number registered with this ID.
                          </p>

                          {/* Mode toggle */}
                          <div className="flex gap-2 mb-3">
                            <button
                              type="button"
                              onClick={() => updateGuest(idx, { activeVerifyTab: "digilocker" })}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                                (g.activeVerifyTab ?? "digilocker") === "digilocker"
                                  ? "bg-brand-primary text-white"
                                  : "bg-bg-page text-text-secondary border border-border-subtle hover:text-text-primary"
                              }`}
                            >
                              🏛 DigiLocker
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                updateGuest(idx, { activeVerifyTab: "otp" });
                                if (g.phoneNumber && g.phoneNumber.trim().replace(/\D/g, "").length >= 10 && !g.otpSent) {
                                  handleSendOtp(idx);
                                }
                              }}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                                g.activeVerifyTab === "otp"
                                  ? "bg-brand-primary text-white"
                                  : "bg-bg-page text-text-secondary border border-border-subtle hover:text-text-primary"
                              }`}
                            >
                              <span>📱 Phone OTP</span>
                              <span className="text-[10px] font-normal opacity-90">(Recommended)</span>
                            </button>
                          </div>

                          {(g.activeVerifyTab ?? "digilocker") === "digilocker" && (
                            <div>
                              <button
                                type="button"
                                onClick={() => handleVerifyDigiLocker(idx)}
                                data-testid={isFirst ? "aadhaar-vc-scan-button" : undefined}
                                className="w-full rounded-lg bg-brand-primary py-2.5 text-sm font-semibold text-white transition hover:opacity-90 mb-2"
                              >
                                Verify with DigiLocker
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const el = document.getElementById(idPhotoInputId) as HTMLInputElement | null;
                                  el?.click();
                                }}
                                data-testid={isFirst ? "aadhaar-photo-fallback-link" : undefined}
                                className="text-xs text-text-muted underline block text-center"
                              >
                                I can&apos;t scan — upload Aadhaar photo instead
                              </button>
                            </div>
                          )}

                          {g.activeVerifyTab === "otp" && (
                            <div>
                              {!g.otpSent ? (
                                <div className="space-y-2">
                                  <label
                                    htmlFor={`checkin-phone-${idx}`}
                                    className="block text-xs font-medium text-text-primary mb-1"
                                  >
                                    Phone number connected to ID
                                  </label>
                                  <p className="text-xs text-text-muted mb-2">
                                    Click Send OTP to receive a 6-digit verification code on the phone registered with this ID.
                                  </p>
                                  <div className="flex gap-2">
                                    <input
                                      id={`checkin-phone-${idx}`}
                                      type="tel"
                                      placeholder="e.g. 9876543210"
                                      value={g.phoneNumber}
                                      onChange={(e) => updateGuest(idx, { phoneNumber: e.target.value })}
                                      className="flex-1 rounded-lg border border-border-subtle px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSendOtp(idx)}
                                      className="rounded-lg bg-brand-primary px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 whitespace-nowrap"
                                    >
                                      Send OTP
                                    </button>
                                  </div>
                                  {g.otpError && (
                                    <p className="text-xs text-red-600">{g.otpError}</p>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5">
                                    <p className="text-xs text-emerald-800 font-medium">
                                      ✓ OTP sent to {g.phoneNumber}
                                      {g.otpCode ? ` (Code: ${g.otpCode})` : ""}
                                    </p>
                                  </div>
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <label
                                        htmlFor={`checkin-otp-${idx}`}
                                        className="block text-xs font-medium text-text-primary"
                                      >
                                        Enter or paste 6-digit OTP
                                      </label>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            const clip = await navigator.clipboard.readText();
                                            const digits = clip.replace(/\D/g, "").slice(0, 6);
                                            if (digits) {
                                              updateGuest(idx, { enteredOtp: digits, otpError: "" });
                                            }
                                          } catch {
                                            // Clipboard read permission error ignored
                                          }
                                        }}
                                        className="text-xs text-brand-primary hover:underline"
                                      >
                                        📋 Paste OTP
                                      </button>
                                    </div>
                                    <div className="flex gap-2">
                                      <input
                                        id={`checkin-otp-${idx}`}
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        maxLength={6}
                                        placeholder="123456"
                                        value={g.enteredOtp ?? ""}
                                        onChange={(e) => updateGuest(idx, { enteredOtp: e.target.value })}
                                        onPaste={(e) => handlePasteOtp(idx, e)}
                                        className="flex-1 rounded-lg border border-border-subtle px-3 py-2 text-base tracking-widest text-center font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleVerifyOtp(idx)}
                                        className="rounded-lg bg-brand-primary px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 whitespace-nowrap"
                                      >
                                        Verify OTP
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSendOtp(idx)}
                                        className="rounded-lg border border-border-subtle px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary"
                                      >
                                        Resend
                                      </button>
                                    </div>
                                    {g.otpError && (
                                      <p className="text-xs text-red-600 mt-1">{g.otpError}</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* ID Document Photo / Fallback Upload */}
                        <div>
                          <label htmlFor={idPhotoInputId} className="block text-sm font-medium text-text-primary mb-1">
                            {isFirst
                              ? (g.govtIdType === "Aadhaar" ? "Aadhaar photo (fallback)" : "ID photo (optional)")
                              : `ID photo (${guestLabel})`}
                          </label>
                          <p id={idPhotoHelpId} className="text-xs text-text-muted mb-3">
                            JPG, PNG, or PDF — max 10 MB
                          </p>

                          <div
                            className="rounded-lg border-2 border-dashed border-border-subtle p-4 text-center cursor-pointer hover:border-brand-primary transition bg-white"
                            onClick={() => {
                              const el = document.getElementById(idPhotoInputId) as HTMLInputElement | null;
                              el?.click();
                            }}
                          >
                            <input
                              id={idPhotoInputId}
                              type="file"
                              accept="image/*,.pdf"
                              capture="environment"
                              onChange={(e) => handleGuestFileSelect(idx, e)}
                              className="hidden"
                              aria-label={isFirst
                                ? (g.govtIdType === "Aadhaar" ? "Aadhaar photo (fallback)" : "ID photo (optional)")
                                : `ID photo (${guestLabel})`}
                              aria-describedby={idPhotoHelpId}
                            />
                            {g.idFilePreview ? (
                              <div className="space-y-2">
                                <img src={g.idFilePreview} alt="ID preview" className="max-h-32 mx-auto rounded" />
                                <p className="text-xs text-text-primary font-medium">{g.idFile?.name}</p>
                              </div>
                            ) : g.idFile ? (
                              <p className="text-sm text-text-primary font-medium">📄 {g.idFile.name}</p>
                            ) : (
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-text-primary">📷 Click to upload ID document photo</p>
                                <p className="text-xs text-text-muted">JPG, PNG, or PDF</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {error && (
              <p id="checkin-id-error" role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-4">{error}</p>
            )}

            <label className="flex items-start gap-3 cursor-pointer mb-5">
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
                onClick={handleContinueFromIdUpload}
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
              onClick={() => void proceedFromHouseRules()}
              disabled={busy || (!alreadySigned && !rulesAccepted)}
              data-testid="checkin-house-rules-continue"
              className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Loading…" : "Continue →"}
            </button>
          </div>
        )}

        {/* ── Step: Damage Waiver (TASK-1975) ─────────────────────── */}
        {step === "damage-waiver" && details && (
          <div className="rounded-2xl border border-border-subtle bg-bg-surface p-6 shadow-level1" data-testid="damage-waiver-step">
            <h2 className="text-xl font-bold text-text-primary mb-1">Damage waiver</h2>
            <p className="text-text-secondary text-sm mb-4">
              Please review the waiver, then sign to finish check-in. Atlas provides the signing mechanism only —
              your host&apos;s lawyer must approve the template before it is relied on.
            </p>

            {waiverPdfUrl ? (
              <iframe
                title="Damage waiver PDF"
                src={waiverPdfUrl}
                className="w-full h-64 rounded-xl border border-border-subtle mb-4 bg-white"
                data-testid="damage-waiver-pdf"
              />
            ) : (
              <div className="rounded-xl bg-bg-page border border-border-subtle p-4 text-sm text-text-secondary mb-4" data-testid="damage-waiver-default-copy">
                <p className="font-semibold text-red-700 mb-2">NOT FOR USE WITHOUT LEGAL REVIEW.</p>
                <p>
                  By signing, you acknowledge responsibility for damage to the property beyond normal wear and tear
                  during your stay, and authorise the host to pursue recovery of reasonably documented repair costs.
                </p>
              </div>
            )}

            {waiverAlreadySigned ? (
              <p className="text-sm text-green-700 font-medium mb-4">✓ Waiver already signed.</p>
            ) : (
              <label className="flex items-start gap-3 cursor-pointer mb-5">
                <input
                  type="checkbox"
                  checked={waiverAgreed}
                  onChange={(e) => setWaiverAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-brand-primary"
                  data-testid="damage-waiver-agree"
                />
                <span className="text-sm text-text-secondary">I have read and agree to the damage waiver</span>
              </label>
            )}

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-4">{error}</p>
            )}

            <button
              onClick={() => (waiverAlreadySigned ? void handleComplete() : setShowSignModal(true))}
              disabled={busy || (!waiverAlreadySigned && !waiverAgreed)}
              data-testid="damage-waiver-continue"
              className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Saving…" : waiverAlreadySigned ? "Complete check-in →" : "I Agree — Sign"}
            </button>
          </div>
        )}

        {showSignModal && (
          <DamageWaiverSignature
            busy={busy}
            onCancel={() => setShowSignModal(false)}
            onSign={(p) => void handleSignWaiver(p)}
          />
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
