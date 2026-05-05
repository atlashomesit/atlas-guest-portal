import { describe, expect, it } from "vitest";
import {
  CONTACT,
  DEFAULT_CONTACT_CHANNEL,
  formatDisplayNumber,
  getContactEmail,
  getTelLink,
  getWhatsAppLink,
} from "./contact";

const FORBIDDEN_NUMBER = ["95022", "44053"].join("");

describe("contact config", () => {
  it("uses business details by default", () => {
    expect(DEFAULT_CONTACT_CHANNEL).toBe("business");
    expect(getTelLink()).toBe(`tel:+91${CONTACT.business.phone}`);
    expect(getWhatsAppLink()).toBe(`https://wa.me/${CONTACT.business.whatsapp}`);
  });

  it("exposes owner channel only when explicitly requested", () => {
    expect(getTelLink("owner")).toBe(`tel:+91${CONTACT.owner.phone}`);
    expect(getWhatsAppLink("owner")).toBe(`https://wa.me/${CONTACT.owner.whatsapp}`);
  });

  it("formats numbers consistently for display", () => {
    expect(formatDisplayNumber()).toBe(`+91-${CONTACT.business.phone}`);
    expect(formatDisplayNumber("owner")).toBe(`+91-${CONTACT.owner.phone}`);
  });

  it("guards against returning the removed number", () => {
    expect(JSON.stringify(CONTACT)).not.toContain(FORBIDDEN_NUMBER);
    expect(getTelLink()).not.toContain(FORBIDDEN_NUMBER);
    expect(getWhatsAppLink()).not.toContain(FORBIDDEN_NUMBER);
  });

  it("getContactEmail returns a valid default when no tenant override is set", () => {
    const email = getContactEmail();
    expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
});
