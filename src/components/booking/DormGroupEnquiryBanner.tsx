import React from "react";

export interface DormGroupEnquiryBannerProps {
  requestedBeds: number;
  maxOnlineBeds: number;
  propertyName: string;
  checkIn?: string;
  checkOut?: string;
  enquiryUrl?: string;
}

export function buildGroupEnquiryUrl(
  baseUrl: string,
  opts: { beds: number; propertyName: string; checkIn?: string; checkOut?: string },
): string {
  const params = new URLSearchParams();
  params.set("beds", String(opts.beds));
  params.set("property", opts.propertyName);
  if (opts.checkIn) params.set("checkIn", opts.checkIn);
  if (opts.checkOut) params.set("checkOut", opts.checkOut);
  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${params.toString()}`;
}

export default function DormGroupEnquiryBanner({
  requestedBeds,
  maxOnlineBeds,
  propertyName,
  checkIn,
  checkOut,
  enquiryUrl = "/contact",
}: DormGroupEnquiryBannerProps) {
  if (requestedBeds <= maxOnlineBeds) return null;
  const href = buildGroupEnquiryUrl(enquiryUrl, {
    beds: requestedBeds,
    propertyName,
    checkIn,
    checkOut,
  });

  return (
    <aside
      data-testid="hsl035-group-enquiry-banner"
      role="status"
      style={{
        background: "#eff6ff",
        border: "1px solid #bfdbfe",
        borderRadius: 10,
        padding: 16,
        margin: "12px 0",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15, color: "#1e3a8a", marginBottom: 4 }}>
        Booking {requestedBeds} dorm beds? Let our team arrange your group stay.
      </div>
      <p style={{ fontSize: 13, color: "#1e40af", margin: "0 0 12px" }}>
        Online dorm checkout supports up to {maxOnlineBeds} beds per booking so we can keep your group together in the same dorm.
      </p>
      <a
        href={href}
        style={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: 40,
          padding: "8px 16px",
          borderRadius: 8,
          background: "#2563eb",
          color: "#fff",
          fontWeight: 600,
          fontSize: 13,
          textDecoration: "none",
        }}
      >
        Send prefilled group enquiry →
      </a>
    </aside>
  );
}
