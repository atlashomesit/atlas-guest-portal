import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Typography } from "../components/ui/Typography";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { toast } from "react-toastify";
import { buildApiUrl, getApiHeaders } from "../api/client";
import { logUserAction, reportError } from "../lib/monitoring";

const PROPERTY_TYPES = [
  "Apartment",
  "Villa",
  "Homestay",
  "Farm Stay",
  "Cottage",
  "Bungalow",
  "Guest House",
  "Studio",
  "Hotel",
  "Service Apartment",
] as const;

const TOTAL_STEPS = 3;

const HOST_TESTIMONIALS = [
  {
    quote:
      "Atlas handles all my bookings and guest communication. My occupancy went from 40% to 85% in three months.",
    name: "Priya Sharma",
    detail: "Villa owner, Lonavala",
  },
  {
    quote:
      "I used to spend hours every day managing listings across platforms. Now I just check the dashboard once a week.",
    name: "Rajesh Kumar",
    detail: "Homestay owner, Coorg",
  },
  {
    quote:
      "The pricing optimization alone paid for itself. My revenue increased 60% in the first quarter.",
    name: "Ananya Patel",
    detail: "Apartment host, Goa",
  },
];

const COMPARISON_FEATURES = [
  { feature: "Channel distribution", self: "1–2 platforms", atlas: "Airbnb, Booking.com, MMT & more" },
  { feature: "Pricing optimization", self: "Manual guesswork", atlas: "Dynamic AI pricing tools" },
  { feature: "Guest communication", self: "You handle 24/7", atlas: "Automated messaging templates" },
  { feature: "Payment collection", self: "Per-platform payouts", atlas: "Unified dashboard & payouts" },
  { feature: "Reviews management", self: "Manual follow-ups", atlas: "Automated review requests" },
  { feature: "Professional photography", self: "DIY", atlas: "Guided photo upload & tips" },
  { feature: "Listing optimization", self: "Trial & error", atlas: "Data-driven SEO tools" },
];

function formatINR(amount: number): string {
  return amount.toLocaleString("en-IN");
}

interface ContactInfo {
  displayName: string;
  email: string;
  phone: string;
  password: string;
}

interface PropertyInfo {
  propertyType: string;
  city: string;
  pincode: string;
  address: string;
  roomCount: number;
}

interface AirbnbPrefill {
  url: string;
  pastedText: string;
  prefilled: Partial<PropertyInfo> | null;
  loading: boolean;
}

type SubmitStatus = "idle" | "submitting" | "success" | "error";

const stepLabels = ["Contact", "Property", "Import & Confirm"];

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
    paddingTop: 100,
    paddingBottom: 60,
  } as React.CSSProperties,
  container: {
    maxWidth: 620,
    margin: "0 auto",
    padding: "0 16px",
  } as React.CSSProperties,
  header: {
    textAlign: "center" as const,
    marginBottom: 32,
  } as React.CSSProperties,
  stepper: {
    display: "flex",
    justifyContent: "center",
    gap: 8,
    marginBottom: 32,
  } as React.CSSProperties,
  stepDot: (_active: boolean, _completed: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 6,
  }),
  dot: (active: boolean, completed: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 14,
    color: active || completed ? "#fff" : "#94a3b8",
    background: active
      ? "var(--cta-primary, #2563eb)"
      : completed
        ? "#22c55e"
        : "#e2e8f0",
    transition: "all 0.3s ease",
  }),
  stepLine: (completed: boolean): React.CSSProperties => ({
    width: 40,
    height: 3,
    borderRadius: 2,
    background: completed ? "#22c55e" : "#e2e8f0",
    alignSelf: "center",
    transition: "background 0.3s ease",
  }),
  stepLabel: (active: boolean): React.CSSProperties => ({
    fontSize: 11,
    fontWeight: active ? 600 : 400,
    color: active ? "var(--text-primary, #1e293b)" : "#94a3b8",
    textAlign: "center",
    marginTop: 4,
  }),
  fieldGroup: {
    marginBottom: 16,
  } as React.CSSProperties,
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text-primary, #1e293b)",
    marginBottom: 4,
  } as React.CSSProperties,
  buttonRow: {
    display: "flex",
    gap: 12,
    marginTop: 24,
  } as React.CSSProperties,
  prefillBox: {
    background: "var(--bg-muted, #f1f5f9)",
    border: "1px dashed var(--cta-primary, #2563eb)",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  } as React.CSSProperties,
  prefillItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 0",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 14,
  } as React.CSSProperties,
  successBox: {
    textAlign: "center" as const,
    padding: "40px 20px",
  } as React.CSSProperties,
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "#dcfce7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    fontSize: 32,
  } as React.CSSProperties,
  adminLink: {
    display: "inline-block",
    marginTop: 16,
    padding: "12px 24px",
    background: "var(--cta-primary, #2563eb)",
    color: "#fff",
    borderRadius: 8,
    fontWeight: 600,
    textDecoration: "none",
    transition: "opacity 0.2s",
  } as React.CSSProperties,
  hint: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
  } as React.CSSProperties,
};

function StepIndicator({ current }: { current: number }) {
  return (
    <div style={styles.stepper}>
      {stepLabels.map((label, i) => (
        <React.Fragment key={label}>
          {i > 0 && <div style={styles.stepLine(i <= current)} />}
          <div style={styles.stepDot(i === current, i < current)}>
            <div style={styles.dot(i === current, i < current)}>
              {i < current ? "✓" : i + 1}
            </div>
            <span style={styles.stepLabel(i === current)}>{label}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

const DRAFT_KEY = "becomehost_draft";

const BecomeHost = () => {
  const [step, setStep] = useState(0);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [showResumeBanner, setShowResumeBanner] = useState(false);

  const [contact, setContact] = useState<ContactInfo>({
    displayName: "",
    email: "",
    phone: "",
    password: "",
  });

  const [property, setProperty] = useState<PropertyInfo>({
    propertyType: "",
    city: "",
    pincode: "",
    address: "",
    roomCount: 1,
  });

  // On mount, restore draft if exists (password is excluded for security)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.contact) setContact((prev) => ({ ...prev, ...draft.contact, password: prev.password }));
      if (draft.property) setProperty((prev) => ({ ...prev, ...draft.property }));
      if (typeof draft.step === "number") setStep(draft.step);
      setShowResumeBanner(true);
    } catch {
      // Ignore malformed drafts
    }
  }, []);

  // Save draft on every state change (password excluded)
  useEffect(() => {
    if (submitStatus === "success") return;
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ step, contact: { ...contact, password: "" }, property }),
      );
    } catch {
      // Ignore storage errors (e.g. private browsing quota)
    }
  }, [step, contact, property, submitStatus]);

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setShowResumeBanner(false);
  };

  const resetForm = () => {
    clearDraft();
    setStep(0);
    setContact({ displayName: "", email: "", phone: "", password: "" });
    setProperty({ propertyType: "", city: "", pincode: "", address: "", roomCount: 1 });
  };

  const [airbnb, setAirbnb] = useState<AirbnbPrefill>({
    url: "",
    pastedText: "",
    prefilled: null,
    loading: false,
  });

  const [estimatorRooms, setEstimatorRooms] = useState(2);

  const updateContact = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContact((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const updateProperty = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setProperty((prev) => ({
      ...prev,
      [name]: name === "roomCount" ? Math.max(1, Number(value) || 1) : value,
    }));
  };

  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (!contact.displayName.trim()) return "Display name is required.";
      if (!contact.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))
        return "A valid email is required.";
      if (!contact.phone.trim() || contact.phone.replace(/\D/g, "").length < 10)
        return "A valid phone number is required.";
      if (contact.password.length < 8)
        return "Password must be at least 8 characters.";
    }
    if (s === 1) {
      if (!property.propertyType) return "Please select a property type.";
      if (!property.city.trim()) return "City is required.";
      if (!property.pincode.trim() || !/^\d{5,6}$/.test(property.pincode.trim()))
        return "A valid 5-6 digit pincode is required.";
      if (!property.address.trim()) return "Address is required.";
      if (property.roomCount < 1) return "At least 1 room is required.";
    }
    return null;
  };

  const goNext = () => {
    const error = validateStep(step);
    if (error) {
      toast.error(error);
      return;
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleAirbnbPrefill = async () => {
    const input = airbnb.url.trim() || airbnb.pastedText.trim();
    if (!input) {
      toast.info("Paste an Airbnb listing URL or text to import.");
      return;
    }

    setAirbnb((prev) => ({ ...prev, loading: true, prefilled: null }));
    try {
      const res = await fetch(buildApiUrl("/onboarding/airbnb/prefill"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getApiHeaders() },
        body: JSON.stringify({
          url: airbnb.url.trim() || undefined,
          text: airbnb.pastedText.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Prefill request failed.");
      }

      const data = await res.json();
      const prefilled: Partial<PropertyInfo> = {};
      if (data.propertyType) prefilled.propertyType = data.propertyType;
      if (data.city) prefilled.city = data.city;
      if (data.pincode) prefilled.pincode = data.pincode;
      if (data.address) prefilled.address = data.address;
      if (data.roomCount) prefilled.roomCount = data.roomCount;

      setAirbnb((prev) => ({ ...prev, prefilled, loading: false }));
      setProperty((prev) => ({ ...prev, ...prefilled }));
      toast.success("Listing details imported!");
      logUserAction("onboarding_airbnb_prefill", { status: "success", feature: "become-host" });
    } catch (err) {
      reportError(err, { feature: "become-host-airbnb-prefill" });
      toast.error("Could not import listing. You can still fill in details manually.");
      setAirbnb((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleSubmit = async () => {
    const error = validateStep(step);
    if (error) {
      toast.error(error);
      return;
    }

    setSubmitStatus("submitting");
    try {
      const payload = {
        displayName: contact.displayName.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim(),
        password: contact.password,
        propertyType: property.propertyType,
        city: property.city.trim(),
        pincode: property.pincode.trim(),
        address: property.address.trim(),
        roomCount: property.roomCount,
        airbnbUrl: airbnb.url.trim() || undefined,
      };

      const res = await fetch(buildApiUrl("/onboarding/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getApiHeaders() },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Onboarding request failed.");
      }

      // TASK-764: store propertyId so SetupWizard can PUT the existing draft
      // property instead of POSTing a second one (which would trigger PLAN_LIMIT_REACHED).
      const data = await res.json().catch(() => null);
      if (data?.propertyId) {
        localStorage.setItem('onboarding_property_id', String(data.propertyId));
      }
      if (data?.listingId) {
        localStorage.setItem('onboarding_listing_id', String(data.listingId));
      }
      if (data?.token) {
        // Keep admin portal auth keys in sync for setup auto-login.
        localStorage.setItem('atlas_admin_token', String(data.token));
        localStorage.setItem('auth_token', String(data.token));
      }
      if (data?.tenantSlug) {
        localStorage.setItem('auth_tenant_slug', String(data.tenantSlug));
      }
      if (data?.tenantId) {
        localStorage.setItem('auth_tenant_id', String(data.tenantId));
      }
      localStorage.setItem('onboarding_user_email', contact.email.trim());

      setSubmitStatus("success");
      localStorage.removeItem(DRAFT_KEY);
      toast.success("Your property has been registered!");
      logUserAction("onboarding_started", { status: "success", feature: "become-host", propertyId: data?.propertyId });
    } catch (err) {
      reportError(err, { feature: "become-host-submit" });
      toast.error("Something went wrong. Please try again.");
      setSubmitStatus("error");
    }
  };

  if (submitStatus === "success") {
    return (
      <section style={styles.page} data-testid="become-host-page">
        <div style={styles.container}>
          <Card>
            <div style={styles.successBox}>
              <div style={styles.successIcon} aria-hidden>
                ✓
              </div>
              <Typography variant="h2">Welcome aboard!</Typography>
              <Typography variant="subtitle" className="mt-2">
                Your property has been registered. Head over to the admin portal
                to set up pricing, upload photos, and go live.
              </Typography>
              <a
                href={`${import.meta.env.VITE_ADMIN_PORTAL_URL || "https://app.atlaspms.in"}/onboarding/setup?auto_login=1`}
                style={styles.adminLink}
              >
                Open Admin Portal
              </a>
              <div className="mt-4">
                <Link
                  to="/"
                  className="text-sm"
                  style={{ color: "var(--cta-primary, #2563eb)" }}
                >
                  Back to homepage
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.page} data-testid="become-host-page">
      {/* ── Hero Section ── */}
      <div className="max-w-3xl mx-auto px-4 text-center mb-10">
        <h1
          className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight"
          style={{ color: "var(--text-primary, #1e293b)" }}
        >
          Turn Your Property Into a{" "}
          <span style={{ color: "var(--cta-primary, #2563eb)" }}>Thriving Homestay</span>
        </h1>
        <p
          className="mt-4 text-lg"
          style={{ color: "#64748b", maxWidth: 560, margin: "16px auto 0" }}
        >
          Atlas PMS gives you the tools to manage guest bookings, pricing, and
          channels — so you earn more while staying in control.
        </p>
        <a
          href="#host-signup-form"
          className="inline-block mt-6 px-8 py-3 rounded-xl text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
          style={{ background: "var(--cta-primary, #2563eb)" }}
        >
          List Your Property — It's Free
        </a>
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: "🌐", label: "Multi-platform listing" },
            { icon: "📈", label: "Dynamic pricing" },
            { icon: "💬", label: "24/7 guest support" },
            { icon: "₹0", label: "Zero setup fee" },
          ].map((b) => (
            <div
              key={b.label}
              className="flex flex-col items-center gap-1 p-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.7)" }}
            >
              <span className="text-2xl">{b.icon}</span>
              <span
                className="text-sm font-medium"
                style={{ color: "var(--text-primary, #1e293b)" }}
              >
                {b.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Earnings Estimator ── */}
      <div className="max-w-2xl mx-auto px-4 mb-12">
        <div
          className="rounded-2xl p-6 sm:p-8 text-center"
          style={{
            background: "rgba(255,255,255,0.85)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <h2
            className="text-2xl font-bold mb-1"
            style={{ color: "var(--text-primary, #1e293b)" }}
          >
            How much could you earn?
          </h2>
          <p className="text-base mb-6" style={{ color: "#64748b" }}>
            Properties in your area earn{" "}
            <strong style={{ color: "var(--cta-primary, #2563eb)" }}>
              ₹45,000 – ₹1,20,000/month
            </strong>
          </p>
          <label
            className="block text-sm font-medium mb-2"
            style={{ color: "#475569" }}
          >
            Number of rooms: <strong>{estimatorRooms}</strong>
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={estimatorRooms}
            onChange={(e) => setEstimatorRooms(Number(e.target.value))}
            aria-label="Number of rooms"
            aria-valuetext={`${estimatorRooms} ${estimatorRooms === 1 ? "room" : "rooms"}`}
            className="w-full accent-blue-600"
          />
          <div
            className="flex justify-between text-sm mt-1 mb-4"
            style={{ color: "#94a3b8" }}
          >
            <span>1 room</span>
            <span>10 rooms</span>
          </div>
          <div
            className="rounded-xl p-4"
            style={{
              background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
            }}
            aria-live="polite"
            aria-atomic="true"
          >
            <p className="text-sm" style={{ color: "#475569" }}>
              Estimated monthly earnings
            </p>
            <p
              className="text-3xl font-extrabold mt-1"
              style={{ color: "var(--cta-primary, #2563eb)" }}
            >
              ₹{formatINR(estimatorRooms * 15000)} – ₹{formatINR(estimatorRooms * 40000)}
            </p>
            <p className="text-sm mt-2" style={{ color: "#94a3b8" }}>
              Based on average occupancy for properties using Atlas PMS
            </p>
          </div>
        </div>
      </div>

      {/* ── Comparison Table: Self-managed vs Atlas Managed ── */}
      <div className="max-w-2xl mx-auto px-4 mb-12">
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.85)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <div className="p-6 pb-2 text-center">
            <h2
              className="text-2xl font-bold"
              style={{ color: "var(--text-primary, #1e293b)" }}
            >
              DIY vs Atlas PMS Software
            </h2>
            <p className="text-sm mt-1" style={{ color: "#64748b" }}>
              See what you get with Atlas PMS software
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                  <th
                    className="text-left p-3 pl-6 font-semibold"
                    style={{ color: "#475569" }}
                  >
                    Feature
                  </th>
                  <th
                    className="p-3 text-center font-semibold"
                    style={{ color: "#94a3b8" }}
                  >
                    Self-managed
                  </th>
                  <th
                    className="p-3 pr-6 text-center font-semibold"
                    style={{ color: "var(--cta-primary, #2563eb)" }}
                  >
                    Atlas PMS
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((row, i) => (
                  <tr
                    key={row.feature}
                    style={{
                      borderBottom:
                        i < COMPARISON_FEATURES.length - 1
                          ? "1px solid #f1f5f9"
                          : "none",
                    }}
                  >
                    <td
                      className="p-3 pl-6 font-medium"
                      style={{ color: "var(--text-primary, #1e293b)" }}
                    >
                      {row.feature}
                    </td>
                    <td
                      className="p-3 text-center"
                      style={{ color: "#94a3b8" }}
                    >
                      {row.self}
                    </td>
                    <td
                      className="p-3 pr-6 text-center font-semibold"
                      style={{ color: "#16a34a" }}
                    >
                      ✓ {row.atlas}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Host Testimonials ── */}
      <div className="max-w-3xl mx-auto px-4 mb-16">
        <h2
          className="text-2xl font-bold text-center mb-6"
          style={{ color: "var(--text-primary, #1e293b)" }}
        >
          Hear from our hosts
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {HOST_TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="rounded-2xl p-5 flex flex-col"
              style={{
                background: "rgba(255,255,255,0.9)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <p
                className="text-sm leading-relaxed flex-1"
                style={{ color: "#475569" }}
              >
                &ldquo;{t.quote}&rdquo;
              </p>
              <div
                className="mt-4 pt-3"
                style={{ borderTop: "1px solid #f1f5f9" }}
              >
                <p
                  className="font-semibold text-sm"
                  style={{ color: "var(--text-primary, #1e293b)" }}
                >
                  {t.name}
                </p>
                <p className="text-xs" style={{ color: "#94a3b8" }}>
                  {t.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Registration Form ── */}
      <div style={styles.container} id="host-signup-form">
        {/* Draft resume banner */}
        {showResumeBanner && (
          <div
            className="mb-4 rounded-xl border px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
            style={{ background: "#f0fdf4", borderColor: "#4ade80" }}
          >
            <span style={{ fontSize: 14, color: "#166534", fontWeight: 600 }}>
              Welcome back — continue where you left off.
            </span>
            <button
              type="button"
              onClick={resetForm}
              style={{ fontSize: 13, color: "#6b7280", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
            >
              Clear and start over
            </button>
          </div>
        )}

        <div style={styles.header}>
          <Typography variant="h2">Get started in under 5 minutes</Typography>
          <Typography variant="subtitle" className="mt-2">
            Fill in your details and we'll have your property listed within 24 hours.
          </Typography>
        </div>

        <StepIndicator current={step} />

        <Card className="space-y-4">
          {/* ── Step 1: Contact Info ── */}
          {step === 0 && (
            <>
              <Typography variant="h3">Your contact details</Typography>
              <p style={{ ...styles.hint, marginBottom: 12 }}>
                Use the email and phone you want for guest messages and payout notifications.
              </p>
              <div style={styles.fieldGroup}>
                <label htmlFor="displayName" style={styles.label}>
                  Display name
                </label>
                <Input
                  id="displayName"
                  name="displayName"
                  type="text"
                  placeholder="e.g. Priya's Getaway"
                  value={contact.displayName}
                  onChange={updateContact}
                  required
                  autoFocus
                  data-testid="host-onboard-name"
                />
              </div>
              <div style={styles.fieldGroup}>
                <label htmlFor="email" style={styles.label}>
                  Email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={contact.email}
                  onChange={updateContact}
                  required
                  data-testid="host-onboard-email"
                />
              </div>
              <div style={styles.fieldGroup}>
                <label htmlFor="phone" style={styles.label}>
                  Phone
                </label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={contact.phone}
                  onChange={updateContact}
                  required
                  data-testid="host-onboard-phone"
                />
              </div>
              <div style={styles.fieldGroup}>
                <label htmlFor="password" style={styles.label}>
                  Password
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Min 8 characters"
                  value={contact.password}
                  onChange={updateContact}
                  required
                  minLength={8}
                  data-testid="host-onboard-password"
                />
                <p style={styles.hint}>
                  You'll use this to log in to the admin portal.
                </p>
              </div>
            </>
          )}

          {/* ── Step 2: Property Basics ── */}
          {step === 1 && (
            <>
              <Typography variant="h3">Property details</Typography>
              <p style={{ ...styles.hint, marginBottom: 12 }}>
                You can refine photos and pricing later in the admin portal before going live.
              </p>
              <div style={styles.fieldGroup}>
                <label htmlFor="propertyType" style={styles.label}>
                  Property type
                </label>
                <Input
                  as="select"
                  id="propertyType"
                  name="propertyType"
                  value={property.propertyType}
                  onChange={updateProperty}
                  required
                >
                  <option value="">Select type</option>
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Input>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div style={styles.fieldGroup}>
                  <label htmlFor="city" style={styles.label}>
                    City
                  </label>
                  <Input
                    id="city"
                    name="city"
                    type="text"
                    placeholder="e.g. Lonavala"
                    value={property.city}
                    onChange={updateProperty}
                    required
                  />
                </div>
                <div style={styles.fieldGroup}>
                  <label htmlFor="pincode" style={styles.label}>
                    Pincode
                  </label>
                  <Input
                    id="pincode"
                    name="pincode"
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 410401"
                    value={property.pincode}
                    onChange={updateProperty}
                    required
                    maxLength={6}
                  />
                </div>
              </div>
              <div style={styles.fieldGroup}>
                <label htmlFor="address" style={styles.label}>
                  Full address
                </label>
                <Input
                  as="textarea"
                  id="address"
                  name="address"
                  placeholder="House no, street, landmark..."
                  value={property.address}
                  onChange={updateProperty}
                  required
                  rows={3}
                />
              </div>
              <div style={styles.fieldGroup}>
                <label htmlFor="roomCount" style={styles.label}>
                  Number of rooms
                </label>
                <Input
                  id="roomCount"
                  name="roomCount"
                  type="number"
                  min={1}
                  max={50}
                  value={String(property.roomCount)}
                  onChange={updateProperty}
                  required
                />
              </div>
            </>
          )}

          {/* ── Step 3: Airbnb Import + Confirm ── */}
          {step === 2 && (
            <>
              <Typography variant="h3">
                Import from Airbnb{" "}
                <span style={{ fontSize: 13, fontWeight: 400, color: "#94a3b8" }}>
                  (optional)
                </span>
              </Typography>
              <Typography variant="muted">
                Already have an Airbnb listing? Paste the URL or listing text
                and we'll pre-fill your property details.
              </Typography>

              <div style={styles.fieldGroup}>
                <label htmlFor="airbnbUrl" style={styles.label}>
                  Airbnb listing URL
                </label>
                <Input
                  id="airbnbUrl"
                  name="airbnbUrl"
                  type="url"
                  placeholder="https://www.airbnb.com/rooms/..."
                  value={airbnb.url}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setAirbnb((prev) => ({ ...prev, url: e.target.value }))
                  }
                />
              </div>
              <div style={styles.fieldGroup}>
                <label htmlFor="airbnbText" style={styles.label}>
                  Or paste listing text
                </label>
                <Input
                  as="textarea"
                  id="airbnbText"
                  name="airbnbText"
                  placeholder="Copy-paste your Airbnb listing description here..."
                  value={airbnb.pastedText}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setAirbnb((prev) => ({ ...prev, pastedText: e.target.value }))
                  }
                  rows={4}
                />
              </div>

              <Button
                variant="secondary"
                onClick={handleAirbnbPrefill}
                disabled={
                  airbnb.loading ||
                  (!airbnb.url.trim() && !airbnb.pastedText.trim())
                }
              >
                {airbnb.loading ? "Importing..." : "Import listing"}
              </Button>

              {airbnb.prefilled && (
                <div style={styles.prefillBox}>
                  <Typography
                    variant="muted"
                    className="mb-2"
                    style={{ fontWeight: 600 }}
                  >
                    Imported fields (applied to Step 2):
                  </Typography>
                  {Object.entries(airbnb.prefilled).map(([key, val]) => (
                    <div key={key} style={styles.prefillItem}>
                      <span style={{ color: "#64748b", textTransform: "capitalize" }}>
                        {key.replace(/([A-Z])/g, " $1")}
                      </span>
                      <span style={{ fontWeight: 600 }}>{String(val)}</span>
                    </div>
                  ))}
                </div>
              )}

              <hr
                style={{
                  border: "none",
                  borderTop: "1px solid #e2e8f0",
                  margin: "20px 0",
                }}
              />

              <Typography variant="h3">Confirm your details</Typography>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px 24px",
                  fontSize: 14,
                }}
              >
                <div>
                  <span style={{ color: "#64748b" }}>Name</span>
                  <p style={{ fontWeight: 600 }}>{contact.displayName}</p>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Email</span>
                  <p style={{ fontWeight: 600 }}>{contact.email}</p>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Phone</span>
                  <p style={{ fontWeight: 600 }}>{contact.phone}</p>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Type</span>
                  <p style={{ fontWeight: 600 }}>{property.propertyType}</p>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>City</span>
                  <p style={{ fontWeight: 600 }}>{property.city}</p>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Pincode</span>
                  <p style={{ fontWeight: 600 }}>{property.pincode}</p>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ color: "#64748b" }}>Address</span>
                  <p style={{ fontWeight: 600 }}>{property.address}</p>
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>Rooms</span>
                  <p style={{ fontWeight: 600 }}>{property.roomCount}</p>
                </div>
              </div>
            </>
          )}

          {/* ── Navigation Buttons ── */}
          <div style={styles.buttonRow}>
            {step > 0 && (
              <Button
                variant="ghost"
                onClick={goBack}
                disabled={submitStatus === "submitting"}
              >
                Back
              </Button>
            )}
            <div style={{ flex: 1 }} />
            {step < TOTAL_STEPS - 1 ? (
              <Button onClick={goNext} data-testid="host-onboard-continue">Continue</Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitStatus === "submitting"}
                data-testid="host-onboard-submit"
              >
                {submitStatus === "submitting"
                  ? "Submitting..."
                  : "Register property"}
              </Button>
            )}
          </div>
        </Card>

        <Typography
          variant="muted"
          className="text-center mt-4"
          style={{ fontSize: 12 }}
        >
          Already a host?{" "}
          <a
            href={
              import.meta.env.VITE_ADMIN_PORTAL_URL ||
              "https://admin.atlashomestays.com"
            }
            style={{ color: "var(--cta-primary, #2563eb)", fontWeight: 600 }}
          >
            Sign in to the admin portal
          </a>
        </Typography>
      </div>
    </section>
  );
};

class BecomeHostErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false, error: undefined as Error | undefined };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[BecomeHost] render crash:", error, info);
    (window as any).__atlasErrorLog = true;
    reportError(error, { boundary: "become-host-page", componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <section style={styles.page} data-testid="become-host-page">
          <div style={styles.container}>
            <Card>
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <Typography variant="h2">Something went wrong</Typography>
                <Typography variant="subtitle" className="mt-2">
                  We hit an unexpected error loading host onboarding.
                </Typography>
                <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center" }}>
                  <Button onClick={() => window.location.reload()}>Try again</Button>
                  <Button variant="ghost" onClick={() => (window.location.href = "/")}>
                    Back to home
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}

const BecomeHostWithErrorBoundary = () => (
  <BecomeHostErrorBoundary>
    <BecomeHost />
  </BecomeHostErrorBoundary>
);

export default BecomeHostWithErrorBoundary;
