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

