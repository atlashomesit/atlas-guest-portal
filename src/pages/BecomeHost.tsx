import React, { useState } from "react";
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
] as const;

const TOTAL_STEPS = 3;

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

const BecomeHost = () => {
  const [step, setStep] = useState(0);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");

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

  const [airbnb, setAirbnb] = useState<AirbnbPrefill>({
    url: "",
    pastedText: "",
    prefilled: null,
    loading: false,
  });

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

      setSubmitStatus("success");
      toast.success("Your property has been registered!");
      logUserAction("onboarding_started", { status: "success", feature: "become-host" });
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
                href={
                  import.meta.env.VITE_ADMIN_PORTAL_URL ||
                  "https://admin.atlashomestays.com"
                }
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
      <div style={styles.container}>
        <div style={styles.header}>
          <Typography variant="h1">Become a Host</Typography>
          <Typography variant="subtitle" className="mt-2">
            List your property on Atlas Homestays in under 5 minutes.
          </Typography>
        </div>

        <StepIndicator current={step} />

        <Card className="space-y-4">
          {/* ── Step 1: Contact Info ── */}
          {step === 0 && (
            <>
              <Typography variant="h3">Your contact details</Typography>
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
