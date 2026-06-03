import CommonBanner from "../../components/commonComponents/banner/CommonBanner";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { formatDisplayNumber, getContactEmail, getTelLink, getWhatsAppLink } from "../../config/contact";
import { ctaNav } from "../../config/navigation";
import { Card } from "../../components/ui/Card";
import { Typography } from "../../components/ui/Typography";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { buildApiUrl, getApiHeaders } from "../../api/client";
import ErrorBoundary from "../../components/ErrorBoundary";
import { toast } from "react-toastify";
import { logUserAction, reportError } from "../../lib/monitoring";
import { messageFromApiResponse } from "../../utils/serverErrorFromResponse";
import { getTenantBrandName } from "../../tenant/displayBrand";

type StatusMessage = {
    type: "info" | "success" | "error";
    text: string;
};

const ContactUs = () => {
    const contactEmail = getContactEmail();
    const tenantLabel = getTenantBrandName();

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        contactnumber: "",
        destination: "",
        description: "",
    });

    const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            toast.error("Please enter a valid email address.");
            return;
        }
        if (formData.contactnumber && formData.contactnumber.replace(/\D/g, '').length < 10) {
            toast.error("Please enter a valid phone number (at least 10 digits).");
            return;
        }

        setStatusMessage({ type: "info", text: "Sending your message..." });

        try {
            const response = await fetch(buildApiUrl("/api/contact"), {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getApiHeaders() },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const message = await messageFromApiResponse(response);
                const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
                toast.error(message);
                setStatusMessage({
                    type: "error",
                    text: `${message}${data?.queued ? " We've queued your request and will retry." : ""} Please try again or contact us through phone or WhatsApp.`,
                });
                logUserAction("contact_form_submitted", { status: "failed", feature: "contact-form" });
                return;
            }

            const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

            logUserAction("contact_form_submitted", { status: "success", feature: "contact-form" });
            if (data?.queued) {
                toast.info("We received your message and will follow up even while email is in maintenance.");
                setStatusMessage({
                    type: "info",
                    text: "Your request is queued while email delivery is offline. We'll reach out shortly.",
                });
            } else {
                toast.success("Message sent! We'll be in touch soon.");
                setStatusMessage({ type: "success", text: "Message sent successfully!" });
            }

            setFormData({ name: "", email: "", contactnumber: "", destination: "", description: "" });
        } catch (error) {
            reportError(error, { feature: "contact-form" });
            const message =
                error instanceof Error && error.message
                    ? error.message
                    : "We couldn't send your message right now. Please try again or call us.";
            toast.error(message);
            setStatusMessage({
                type: "error",
                text: `${message} Please try again or contact us through phone or WhatsApp.`,
            });
        }
    };

    return (
        <section>
            {/* Banner */}
            <CommonBanner image="" PageName={'Contact Us'} />

            {/* Contact Info Section */}
            <div className="bg-bg-muted border-b border-border-subtle">
                <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 lg:gap-8">
                        {/* Left Section - Main Message */}
                        <div className="flex flex-col justify-between space-y-8">
                            <div className="space-y-4">
                                <Typography variant="h2">We are ready to help</Typography>
                                <Typography variant="subtitle">
                                    Questions about reservations, special requests, or the best unit for your stay? Our guest team will respond quickly on our primary contact lines.
                                </Typography>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <a
                                    href={getWhatsAppLink()}
                                    aria-label={`Contact ${tenantLabel} on WhatsApp at ${formatDisplayNumber()}`}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-cta-secondary text-[var(--text-contrast)] px-6 py-3 font-semibold shadow-md hover:shadow-lg transition-all duration-250 hover:scale-105"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    WhatsApp {formatDisplayNumber()}
                                </a>
                                <a
                                    href={getTelLink()}
                                    aria-label={`Call ${tenantLabel} at ${formatDisplayNumber()}`}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-cta-primary text-[var(--text-contrast)] px-6 py-3 font-semibold shadow-md hover:shadow-lg transition-all duration-250 hover:scale-105"
                                >
                                    Call {formatDisplayNumber()}
                                </a>
                            </div>
                            <Typography variant="muted">
                                Prefer email? Reach us at{" "}
                                <a className="text-cta-primary font-semibold hover:underline" href={`mailto:${contactEmail}`}>
                                    {contactEmail}
                                </a>
                            </Typography>
                        </div>

                        {/* Right Section - Contact Details Card */}
                        <Card className="flex flex-col space-y-8 h-fit">
                            <div className="space-y-3">
                                <Typography variant="muted" className="tracking-wider uppercase text-xs font-semibold">Direct lines</Typography>
                                <Typography variant="h3">Business desk</Typography>
                            </div>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Typography variant="muted" className="text-xs font-semibold uppercase">Call</Typography>
                                    <a className="font-semibold text-lg text-cta-primary hover:text-cta-primary/80 transition" href={getTelLink()}>{formatDisplayNumber()}</a>
                                </div>
                                <div className="space-y-2">
                                    <Typography variant="muted" className="text-xs font-semibold uppercase">WhatsApp</Typography>
                                    <a className="font-semibold text-lg text-cta-primary hover:text-cta-primary/80 transition" href={getWhatsAppLink()} target="_blank" rel="noopener noreferrer">{formatDisplayNumber()}</a>
                                </div>
                                <div className="space-y-2">
                                    <Typography variant="muted" className="text-xs font-semibold uppercase">Email</Typography>
                                    <a className="font-semibold text-lg text-cta-primary hover:text-cta-primary/80 transition break-all" href={`mailto:${contactEmail}`}>
                                        {contactEmail}
                                    </a>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-border-subtle">
                                <Typography variant="muted" className="text-sm">Owner contact is reserved for escalations; reach out on the business line first for the fastest help.</Typography>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Contact Form Section */}
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6 lg:gap-8">
                    {/* Form Card */}
                    <Card className="space-y-6">
                        <div className="space-y-3 text-center">
                            <Typography variant="h2">Send us a note</Typography>
                            <Typography variant="subtitle">Share your trip details and we will reply with tailored options.</Typography>
                        </div>
                        {statusMessage && (
                            <div
                                role="status"
                                className={`rounded-lg border px-5 py-4 text-sm font-medium ${
                                    statusMessage.type === "success"
                                        ? "border-green-200 bg-green-50 text-green-800"
                                        : statusMessage.type === "error"
                                            ? "border-red-200 bg-red-50 text-red-800"
                                            : "border-amber-200 bg-amber-50 text-amber-800"
                                }`}
                            >
                                {statusMessage.text}
                            </div>
                        )}
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <label htmlFor="name" className="block text-sm font-semibold text-text-primary">Name</label>
                                <Input
                                    id="name"
                                    type="text"
                                    name="name"
                                    placeholder="Your Name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="email" className="block text-sm font-semibold text-text-primary">Email</label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    placeholder="your@email.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="contactnumber" className="block text-sm font-semibold text-text-primary">Phone</label>
                                <Input
                                    id="contactnumber"
                                    type="tel"
                                    name="contactnumber"
                                    placeholder="Your Contact Number"
                                    value={formData.contactnumber}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="destination" className="block text-sm font-semibold text-text-primary">Destination</label>
                                <Input
                                    as="select"
                                    id="destination"
                                    name="destination"
                                    value={formData.destination}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">Select Destination</option>
                                    <option value="Hyderabad">Hyderabad</option>
                                    <option value="Lonavala">Lonavala</option>
                                    <option value="Dapoli">Dapoli</option>
                                </Input>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="description" className="block text-sm font-semibold text-text-primary">Message</label>
                                <Input
                                    as="textarea"
                                    id="description"
                                    name="description"
                                    placeholder="Tell us about your stay"
                                    value={formData.description}
                                    onChange={handleChange}
                                    required
                                    rows={6}
                                />
                            </div>
                            <Button type="submit" fullWidth disabled={statusMessage?.type === "info"} className="mt-6">
                                Send message
                            </Button>
                        </form>
                    </Card>

                    {/* Sidebar - Quick Links */}
                    <Card className="space-y-8 h-fit">
                        <div className="space-y-3">
                            <Typography variant="muted" className="tracking-wider uppercase text-xs font-semibold">Quick links</Typography>
                            <Typography variant="h3">Find answers faster</Typography>
                            <Typography variant="subtitle">Jump to the most requested pages before you reach out.</Typography>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Link to="/policies" aria-label="Read our guest policies" className="px-4 py-3 rounded-lg border border-border-subtle bg-bg-surface hover:border-cta-primary hover:bg-cta-primary/5 font-semibold text-text-primary transition-colors duration-250 text-center text-sm">Policies</Link>
                            <Link to="/faq" aria-label="Frequently asked questions" className="px-4 py-3 rounded-lg border border-border-subtle bg-bg-surface hover:border-cta-primary hover:bg-cta-primary/5 font-semibold text-text-primary transition-colors duration-250 text-center text-sm">FAQs</Link>
                            <Link to="/terms" aria-label="Read our terms and conditions" className="px-4 py-3 rounded-lg border border-border-subtle bg-bg-surface hover:border-cta-primary hover:bg-cta-primary/5 font-semibold text-text-primary transition-colors duration-250 text-center text-sm">Terms</Link>
                            <Link to={ctaNav.to} aria-label={`Book a stay with ${tenantLabel}`} className="px-4 py-3 rounded-lg border border-border-subtle bg-bg-surface hover:border-cta-primary hover:bg-cta-primary/5 font-semibold text-text-primary transition-colors duration-250 text-center text-sm">Book now</Link>
                        </div>
                        <div className="bg-bg-surface border border-dashed border-cta-primary/30 rounded-lg p-5 text-sm text-text-muted space-y-2">
                            <p className="font-semibold text-text-primary">Quick response?</p>
                            <p>WhatsApp us on {formatDisplayNumber()} for booking confirmations.</p>
                        </div>
                    </Card>
                </div>
            </div>
        </section>
    );
};

const ContactUsWithErrorBoundary = () => (
    <ErrorBoundary name="contact-us-page">
        <ContactUs />
    </ErrorBoundary>
);

export default ContactUsWithErrorBoundary;
