import CommonBanner from "../../components/commonComponents/banner/CommonBanner";
import { resolveOptimizedAsset } from "../../utils/resolveOptimizedAsset";
import React, { useState } from "react";
import emailjs from "@emailjs/browser";
import { Link } from "react-router-dom";
import { formatDisplayNumber, getTelLink, getWhatsAppLink } from "../../config/contact";
import { ctaNav } from "../../config/navigation";
import { emailJsConfig, getMissingEmailJsEnvKeys, isEmailJsConfigured } from "../../utils/emailjsConfig";
import { Card } from "../../components/ui/Card";
import { Typography } from "../../components/ui/Typography";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";

const ContactUs = () => {

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        contactnumber: "",
        destination: "",
        description: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!isEmailJsConfigured()) {
            const missingKeys = getMissingEmailJsEnvKeys().join(", ");
            console.error("EmailJS environment variables are not fully configured.", missingKeys);
            alert("Contact form is temporarily unavailable. Please reach out via phone or email.");
            return;
        }

        try {
            const response = await emailjs.send(
                emailJsConfig.serviceId!,
                emailJsConfig.templateId!,
                {
                    user_name: formData.name,
                    user_email: formData.email,
                    user_contactnumber: formData.contactnumber,
                    destination: formData.destination,
                    message: formData.description,
                    to_email: emailJsConfig.ownerEmail,
                },
                emailJsConfig.publicKey!
            );
            console.log("SUCCESS!", response.status, response.text);
            alert("Message sent successfully!");
            setFormData({ name: "", email: "", contactnumber: "", destination: "", description: "" });
        } catch (error) {
            console.log("FAILED...", error);
            alert("Failed to send message. Please try again.");
        }
    };

    return (
        <section>
            {/* Banner */}
            <div>
                <CommonBanner image={resolveOptimizedAsset('banner.jpg')} PageName={'Contact Us'} />
            </div>

            {/* Contact Info Section */}
            <div className="bg-slate-50 border-y border-slate-200">
                <div className="flex flex-col md:flex-row gap-8 px-4 lg:px-20 py-10 max-w-6xl mx-auto">
                    {/* Left Section */}
                    <div className="w-full text-gray-600 text-lg leading-relaxed space-y-4">
                        <div className="space-y-2">
                            <Typography variant="h2">We are ready to help</Typography>
                            <Typography variant="subtitle">
                                Questions about reservations, special requests, or the best unit for your stay? Our guest team will respond quickly on our primary contact lines.
                            </Typography>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <a
                                href={getWhatsAppLink()}
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-green-600 text-white px-4 py-2 font-semibold shadow-md hover:shadow-lg transition"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                WhatsApp {formatDisplayNumber()}
                            </a>
                            <a
                                href={getTelLink()}
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary text-white px-4 py-2 font-semibold shadow-md hover:shadow-lg transition"
                            >
                                Call {formatDisplayNumber()}
                            </a>
                        </div>
                        <Typography variant="muted">
                            Prefer email? Reach us at <a className="text-primary font-semibold" href="mailto:atlashomeskphb@gmail.com">atlashomeskphb@gmail.com</a>.
                        </Typography>
                    </div>

                    {/* Contact Details */}
                    <Card className="w-full md:w-5/12 space-y-4">
                        <div className="space-y-1">
                            <Typography variant="muted" className="tracking-[0.25em] uppercase">Direct lines</Typography>
                            <Typography variant="h3">Business desk</Typography>
                        </div>
                        <div className="space-y-3 text-slate-800">
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
                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                        <Input
                            type="text"
                            name="name"
                            placeholder="Your Name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            type="email"
                            name="email"
                            placeholder="Your Email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            type="tel"
                            name="contactnumber"
                            placeholder="Your Contact Number"
                            value={formData.contactnumber}
                            onChange={handleChange}
                            required
                        />
                        <Input as="select" name="destination" value={formData.destination} onChange={handleChange}>
                            <option value="">Select Destination</option>
                            <option value="Lonavala">Lonavala</option>
                            <option value="Dapoli">Dapoli</option>
                        </Input>
                        <Input
                            as="textarea"
                            name="description"
                            placeholder="Tell us about your stay"
                            value={formData.description}
                            onChange={handleChange}
                            required
                            rows={5}
                        />
                        <Button type="submit" fullWidth>
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
                        <Link to="/policies" className="px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-primary font-semibold text-slate-900 transition">Policies</Link>
                        <Link to="/faq" className="px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-primary font-semibold text-slate-900 transition">FAQs</Link>
                        <Link to="/terms" className="px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-primary font-semibold text-slate-900 transition">Terms</Link>
                        <Link to={ctaNav.to} className="px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-primary font-semibold text-slate-900 transition">Book now</Link>
                    </div>
                    <div className="bg-white border border-dashed border-primary/30 rounded-xl p-4 text-sm text-slate-700">
                        Prefer a quick response? WhatsApp us on {formatDisplayNumber()} for booking confirmations.
                    </div>
                </Card>
            </div>

            {/* Homepage Property section */}
            <div>
                {/* <Homepage_Properties /> */}
            </div>


        </section>
    );
};

export default ContactUs;
