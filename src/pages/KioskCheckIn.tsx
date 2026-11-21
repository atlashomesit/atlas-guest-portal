import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { buildApiUrl, getApiHeaders } from "../api/client";
import { Camera, CheckCircle2, KeyRound, Wifi, ShieldCheck, ArrowRight, RotateCcw, AlertTriangle } from "lucide-react";

interface KioskBookingDetails {
  bookingRef: string;
  listingName: string;
  guestName?: string;
  checkinDate: string;
  checkoutDate: string;
  checkinTime: string;
  checkoutTime: string;
  doorCode?: string;
  wifiName?: string;
  wifiPassword?: string;
  houseRulesText?: string;
  emergencyContactPhone?: string;
}

type KioskStep = "welcome" | "lookup" | "id-scan" | "house-rules" | "pass";

export default function KioskCheckIn() {
  const { bookingRef: routeRef } = useParams<{ bookingRef?: string }>();

  const [step, setStep] = useState<KioskStep>(routeRef ? "lookup" : "welcome");
  const [refInput, setRefInput] = useState(routeRef || "");
  const [lastNameInput, setLastNameInput] = useState("");
  const [details, setDetails] = useState<KioskBookingDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ID capture state
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Signature state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const drawingRef = useRef(false);

  // Inactivity timeout: Reset to welcome screen after 90 seconds
  const lastActivityRef = useRef<number>(Date.now());
  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };
    window.addEventListener("pointerdown", handleActivity);
    window.addEventListener("keydown", handleActivity);

    const timer = setInterval(() => {
      if (step !== "welcome" && Date.now() - lastActivityRef.current > 90000) {
        resetKiosk();
      }
    }, 5000);

    return () => {
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      clearInterval(timer);
    };
  }, [step]);

  const resetKiosk = () => {
    stopCamera();
    setStep("welcome");
    setRefInput("");
    setLastNameInput("");
    setDetails(null);
    setCapturedBlob(null);
    setCapturedPreview(null);
    setHasSignature(false);
    setError(null);
  };

  // Lookup booking
  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanRef = refInput.trim().toUpperCase();
    const cleanLast = lastNameInput.trim();
    if (!cleanRef) {
      setError("Please enter your Booking Reference (e.g. ATLAS-1234).");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const url = buildApiUrl(
        `/api/public/checkin/${encodeURIComponent(cleanRef)}${cleanLast ? `?lastName=${encodeURIComponent(cleanLast)}` : ""}`
      );
      const res = await fetch(url, { headers: getApiHeaders() });
      if (!res.ok) {
        if (res.status === 404) {
          setError("Booking not found. Please verify your reference or last name.");
        } else {
          setError("Unable to find reservation. Please contact front desk staff.");
        }
        return;
      }
      const data = (await res.json()) as KioskBookingDetails;
      setDetails(data);
      setStep("id-scan");
      startCamera();
    } catch {
      setError("Network error communicating with front desk system.");
    } finally {
      setLoading(false);
    }
  };

  // Camera handling
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      // Camera unavailable or denied; user can still see the ID scan screen
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setCapturedBlob(blob);
      setCapturedPreview(URL.createObjectURL(blob));
      stopCamera();
    }, "image/jpeg", 0.9);
  };

  const retakePhoto = () => {
    setCapturedBlob(null);
    setCapturedPreview(null);
    startCamera();
  };

  // Signature handling
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawingRef.current = true;
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    drawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Finalize checkin
  const handleFinalize = async () => {
    if (!details) return;
    setLoading(true);
    try {
      // 1. Upload captured ID if present
      if (capturedBlob) {
        const form = new FormData();
        form.append("file", capturedBlob, "kiosk-guest-id.jpg");
        await fetch(
          buildApiUrl(`/api/public/checkin/${encodeURIComponent(details.bookingRef)}/id-document`),
          { method: "POST", headers: getApiHeaders(), body: form }
        );
      }

      // 2. Accept house rules
      await fetch(
        buildApiUrl(`/api/public/checkin/${encodeURIComponent(details.bookingRef)}/accept-house-rules`),
        {
          method: "POST",
          headers: { ...getApiHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ accept: true }),
        }
      );

      // 3. Mark complete
      await fetch(
        buildApiUrl(`/api/public/checkin/${encodeURIComponent(details.bookingRef)}/complete`),
        { method: "POST", headers: getApiHeaders() }
      );

      setStep("pass");
    } catch {
      setError("Check-in could not be completed. Please notify the desk.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans select-none" data-testid="kiosk-container">
      {/* Kiosk Header */}
      <header className="p-6 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-blue-400" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Express Self Check-In Kiosk</h1>
            <p className="text-xs text-slate-400">Touchscreen Terminal</p>
          </div>
        </div>
        {step !== "welcome" && (
          <button
            type="button"
            onClick={resetKiosk}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium transition"
            data-testid="kiosk-restart-btn"
          >
            <RotateCcw className="w-4 h-4" /> Start Over
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 max-w-4xl mx-auto w-full">
        {error && (
          <div className="w-full mb-6 p-4 rounded-2xl bg-red-950/80 border border-red-500/50 flex items-center gap-3 text-red-200">
            <AlertTriangle className="w-6 h-6 shrink-0 text-red-400" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* STEP 1: WELCOME SCREEN */}
        {step === "welcome" && (
          <div className="text-center py-12 flex flex-col items-center gap-6" data-testid="kiosk-welcome-screen">
            <div className="w-24 h-24 rounded-full bg-blue-500/10 border-2 border-blue-500/30 flex items-center justify-center mb-2 animate-pulse">
              <KeyRound className="w-12 h-12 text-blue-400" />
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
              Welcome to Your Stay
            </h2>
            <p className="text-lg text-slate-400 max-w-lg">
              Check in, verify your identity, and retrieve your room key code in under 60 seconds.
            </p>
            <button
              type="button"
              onClick={() => setStep("lookup")}
              className="mt-6 px-10 py-5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-xl font-bold tracking-wide shadow-lg shadow-blue-500/25 flex items-center gap-3 transition-transform active:scale-95"
              data-testid="kiosk-begin-btn"
            >
              Touch to Begin Check-In <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        )}

        {/* STEP 2: LOOKUP RESERVATION */}
        {step === "lookup" && (
          <div className="w-full max-w-md bg-slate-800/60 p-8 rounded-3xl border border-slate-700/60 backdrop-blur" data-testid="kiosk-lookup-screen">
            <h2 className="text-2xl font-bold mb-2">Find Your Reservation</h2>
            <p className="text-sm text-slate-400 mb-6">Enter your booking reference or confirmation code.</p>

            <form onSubmit={handleLookup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Booking Reference
                </label>
                <input
                  type="text"
                  value={refInput}
                  onChange={(e) => setRefInput(e.target.value.toUpperCase())}
                  placeholder="e.g. ATLAS-9481"
                  className="w-full px-5 py-4 rounded-xl bg-slate-900 border border-slate-700 text-lg font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  data-testid="kiosk-ref-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Guest Last Name (Optional)
                </label>
                <input
                  type="text"
                  value={lastNameInput}
                  onChange={(e) => setLastNameInput(e.target.value)}
                  placeholder="e.g. Smith"
                  className="w-full px-5 py-4 rounded-xl bg-slate-900 border border-slate-700 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="kiosk-lastname-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-lg transition flex items-center justify-center gap-2"
                data-testid="kiosk-lookup-submit"
              >
                {loading ? "Searching…" : "Continue"}
              </button>
            </form>
          </div>
        )}

        {/* STEP 3: SCAN ID */}
        {step === "id-scan" && (
          <div className="w-full max-w-xl bg-slate-800/60 p-8 rounded-3xl border border-slate-700/60 flex flex-col items-center" data-testid="kiosk-id-scan-screen">
            <h2 className="text-2xl font-bold mb-1">Verify Government ID</h2>
            <p className="text-sm text-slate-400 mb-6 text-center">
              Please present your Aadhaar, Passport, or Driving License to the kiosk camera.
            </p>

            {capturedPreview ? (
              <div className="flex flex-col items-center gap-4 w-full">
                <img src={capturedPreview} alt="Captured ID" className="w-full max-h-72 object-cover rounded-2xl border-2 border-emerald-500/50" />
                <div className="flex gap-4 w-full">
                  <button
                    type="button"
                    onClick={retakePhoto}
                    className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-semibold text-sm transition"
                  >
                    Retake Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("house-rules")}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-sm transition"
                    data-testid="kiosk-id-confirm-btn"
                  >
                    Use This Photo
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-slate-700 flex items-center justify-center">
                <video ref={videoRef} playsInline autoPlay muted className="w-full h-full object-cover" />
                {/* ID Card Alignment Bounding Box */}
                <div className="absolute inset-8 border-2 border-dashed border-blue-400/80 rounded-xl pointer-events-none flex items-center justify-center">
                  <span className="text-xs font-medium bg-black/60 px-3 py-1.5 rounded-full text-blue-200">
                    Align ID card inside this box
                  </span>
                </div>
              </div>
            )}

            {!capturedPreview && (
              <button
                type="button"
                onClick={capturePhoto}
                className="mt-6 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold flex items-center gap-2 text-lg transition active:scale-95"
                data-testid="kiosk-capture-btn"
              >
                <Camera className="w-5 h-5" /> Capture ID Photo
              </button>
            )}
          </div>
        )}

        {/* STEP 4: HOUSE RULES & SIGNATURE */}
        {step === "house-rules" && (
          <div className="w-full max-w-xl bg-slate-800/60 p-8 rounded-3xl border border-slate-700/60" data-testid="kiosk-rules-screen">
            <h2 className="text-2xl font-bold mb-1">House Rules & Terms</h2>
            <p className="text-sm text-slate-400 mb-4">Please review and sign with your finger below.</p>

            <div className="p-4 rounded-xl bg-slate-900 text-xs text-slate-300 max-h-36 overflow-y-auto mb-4 border border-slate-800 space-y-1">
              <p>• Check-out time is strictly 11:00 AM.</p>
              <p>• Quiet hours are observed between 10:00 PM and 7:00 AM.</p>
              <p>• Smoking is strictly prohibited inside the property.</p>
              <p>• Guests are responsible for any damages incurred during their stay.</p>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Touch Signature Pad
                </label>
                <button type="button" onClick={clearSignature} className="text-xs text-slate-400 hover:text-white">
                  Clear
                </button>
              </div>
              <canvas
                ref={canvasRef}
                width={500}
                height={150}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                className="w-full h-36 bg-white rounded-xl touch-none cursor-crosshair border border-slate-700"
                data-testid="kiosk-signature-pad"
              />
            </div>

            <button
              type="button"
              disabled={loading || !hasSignature}
              onClick={handleFinalize}
              className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-bold text-lg transition"
              data-testid="kiosk-rules-confirm-btn"
            >
              {loading ? "Completing Check-In…" : "Accept & Complete Check-In"}
            </button>
          </div>
        )}

        {/* STEP 5: ACCESS PASS / ROOM CODE */}
        {step === "pass" && details && (
          <div className="w-full max-w-lg bg-slate-800/80 p-8 rounded-3xl border border-emerald-500/40 text-center flex flex-col items-center" data-testid="kiosk-pass-screen">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-3 text-emerald-400">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-extrabold mb-1">You Are Checked In!</h2>
            <p className="text-slate-400 text-sm mb-6">Welcome, {details.guestName || "Guest"}. Enjoy your stay.</p>

            <div className="w-full bg-slate-900/90 p-5 rounded-2xl border border-slate-700/80 mb-4 text-left space-y-3">
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block">Room / Listing</span>
                <span className="text-lg font-bold text-white">{details.listingName}</span>
              </div>

              {details.doorCode && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-xs uppercase tracking-wider text-amber-400 font-semibold block flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4" /> Door Lock Access PIN
                  </span>
                  <span className="text-2xl font-mono font-extrabold tracking-widest text-amber-300 block mt-0.5">
                    {details.doorCode}
                  </span>
                </div>
              )}

              {details.wifiName && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-xs uppercase tracking-wider text-blue-400 font-semibold block flex items-center gap-1.5">
                    <Wifi className="w-4 h-4" /> Guest Wi-Fi Network
                  </span>
                  <span className="text-sm font-semibold text-white block">
                    {details.wifiName} {details.wifiPassword ? `(PW: ${details.wifiPassword})` : ""}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={resetKiosk}
              className="w-full py-4 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-base transition"
              data-testid="kiosk-done-btn"
            >
              Done (Return to Welcome)
            </button>
          </div>
        )}
      </main>

      {/* Kiosk Footer */}
      <footer className="p-4 border-t border-slate-800/80 text-center text-xs text-slate-500">
        Powered by Atlas PMS · Inactivity auto-clears in 90s
      </footer>
    </div>
  );
}
