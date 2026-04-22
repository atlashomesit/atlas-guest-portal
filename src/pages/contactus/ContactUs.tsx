import CommonBanner from "../../components/commonComponents/banner/CommonBanner";
import { resolveOptimizedAsset } from "../../utils/resolveOptimizedAsset";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { formatDisplayNumber, getTelLink, getWhatsAppLink } from "../../config/contact";
import { ctaNav } from "../../config/navigation";
import { Card } from "../../components/ui/Card";
import { Typography } from "../../components/ui/Typography";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { buildApiUrl, getApiHeaders } from "../../api/client";
import ErrorBoundary from "../../components/ErrorBoundary";
import { toast } from "react-toastify";
import { logUserAction, reportError } from "../../lib/monitoring";

type StatusMessage = {
    type: "info" | "success" | "error";
    text: string;
};

const ContactUs = () => {

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

            const data = await response.json();

            if (!response.ok) {
                const message = data?.message || "We couldn't send your message right now.";
                toast.error(message);
                setStatusMessage({
                    type: "error",
                    text: `${message}${data?.queued ? " We've queued your request and will retry." : ""} Please try again or contact us through phone or WhatsApp.`,
                });
                logUserAction("contact_form_submitted", { status: "failed", feature: "contact-form" });
                return;
            }

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
            toast.error("We couldn't send your message right now. Please try again or call us.");
            setStatusMessage({
                type: "error",
                text: "Failed to send message. Please try again or contact us through phone or WhatsApp.",
            });
        }
    };

    return (
        <section>
            {/* Banner */}
            <div>
                <CommonBanner image={resolveOptimizedAsset('banner.jpg')} PageName={'Contact Us'} />
            </div>

            {/* Contact Info Section */}
            <div className="bg-bg-muted border-y border-border-subtle">
                <div className="flex flex-col md:flex-row gap-8 px-4 lg:px-20 py-10 max-w-6xl mx-auto">
                    {/* Left Section */}
                    <div className="w-full text-text-muted text-lg leading-relaxed space-y-4">
                        <div className="space-y-2">
                            <Typography variant="h2">We are ready to help</Typography>
                            <Typography variant="subtitle">
                                Questions about reservations, special requests, or the best unit for your stay? Our guest team will respond quickly on our primary contact lines.
                            </Typography>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <a
                                href={getWhatsAppLink()}
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-cta-secondary text-[var(--text-contrast)] px-4 py-2 font-semibold shadow-level1 hover:shadow-level2 transition"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                WhatsApp {formatDisplayNumber()}
                            </a>
                            <a
                                href={getTelLink()}
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-cta-primary text-[var(--text-contrast)] px-4 py-2 font-semibold shadow-level1 hover:shadow-level2 transition"
                            >
                                Call {formatDisplayNumber()}
                            </a>
                        </div>
                        <Typography variant="muted">
                            Prefer email? Reach us at <a className="text-accent-primary font-semibold" href="mailto:atlashomeskphb@gmail.com">atlashomeskphb@gmail.com</a>.
                        </Typography>
                    </div>

                    {/* Contact Details */}
                    <Card className="w-full md:w-5/12 space-y-4">
                        <div className="space-y-1">
                            <Typography variant="muted" className="tracking-[0.25em] uppercase">Direct lines</Typography>
                            <Typography variant="h3">Business desk</Typography>
                        </div>
                        <div className="space-y-3 text-text-primary">
                            <div>
                                <Typography variant="muted">Call</Typography>
                                <a className="font-semibold text-lg text-primary" href={getTelLink()}>{formatDisplayNumber()}</a>
                            </div>
                            <div>
                                <Typography variant="muted">WhatsApp</Typography>
                                <a className="font-semibold text-lg text-primary" href={getWhatsAppLink()} target="_blank" rel="noopener noreferrer">{formatDisplayNumber()}</a>
                            </div>
                            <div>
                                <Typography variant="muted">Email</Typography>
                                <a className="font-semibold text-lg text-primary" href="mailto:atlashomeskphb@gmail.com">atlashomeskphb@gmail.com</a>
                            </div>
                        </div>
                        <Typography variant="muted">Owner contact is reserved for escalations; reach out on the business line first for the fastest help.</Typography>
                    </Card>
                </div>
            </div>

            {/* Contact Us form  */}
            <div className="max-w-5xl my-12 mx-auto px-4 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8">
                <Card className="space-y-2">
                    <Typography variant="h2" className="text-center">Send us a note</Typography>
                    <Typography variant="muted" className="text-center">Share your trip details and we will reply with tailored options.</Typography>
                    {statusMessage && (
                        <div
                            role="status"
                            className={`rounded-lg border px-4 py-3 text-sm ${
                                statusMessage.type === "success"
                                    ? "border-green-600/30 bg-green-50 text-green-800"
                                    : statusMessage.type === "error"
                                        ? "border-red-600/30 bg-red-50 text-red-800"
                                        : "border-amber-600/30 bg-amber-50 text-amber-800"
                            }`}
                        >
                            {statusMessage.text}
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                        <div className="space-y-1">
                            <label htmlFor="name" className="text-sm font-semibold text-text-primary">Name</label>
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
                        <div className="space-y-1">
                            <label htmlFor="email" className="text-sm font-semibold text-text-primary">Email</label>
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
                        <div className="space-y-1">
                            <label htmlFor="contactnumber" className="text-sm font-semibold text-text-primary">Phone</label>
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
                        <div className="space-y-1">
                            <label htmlFor="destination" className="text-sm font-semibold text-text-primary">Destination</label>
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
                        <div className="space-y-1">
                            <label htmlFor="description" className="text-sm font-semibold text-text-primary">Message</label>
                            <Input
                                as="textarea"
                                id="description"
                                name="description"
                                placeholder="Tell us about your stay"
                                value={formData.description}
                                onChange={handleChange}
                                required
                                rows={5}
                            />
                        </div>
                        <Button type="submit" fullWidth disabled={statusMessage?.type === "info"}>
                            Send message
                        </Button>
                    </form>
                </Card>

                <Card className="space-y-6" muted>
                    <div className="space-y-2">
                        <Typography variant="muted" className="tracking-[0.25em] uppercase">Quick links</Typography>
                        <Typography variant="h3">Find answers faster</Typography>
                        <Typography variant="subtitle">Jump to the most requested pages before you reach out.</Typography>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Link to="/policies" className="px-4 py-3 rounded-xl border border-border-subtle bg-bg-surface hover:border-cta-primary font-semibold text-text-primary transition">Policies</Link>
                        <Link to="/faq" className="px-4 py-3 rounded-xl border border-border-subtle bg-bg-surface hover:border-cta-primary font-semibold text-text-primary transition">FAQs</Link>
                        <Link to="/terms" className="px-4 py-3 rounded-xl border border-border-subtle bg-bg-surface hover:border-cta-primary font-semibold text-text-primary transition">Terms</Link>
                        <Link to={ctaNav.to} className="px-4 py-3 rounded-xl border border-border-subtle bg-bg-surface hover:border-cta-primary font-semibold text-text-primary transition">Book now</Link>
                    </div>
                    <div className="bg-bg-surface border border-dashed border-cta-primary/30 rounded-xl p-4 text-sm text-text-muted">
                        Prefer a quick response? WhatsApp us on {formatDisplayNumber()} for booking confirmations.
                    </div>
                </Card>
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
