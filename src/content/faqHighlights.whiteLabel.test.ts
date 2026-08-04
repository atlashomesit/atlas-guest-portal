import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getFaqHighlights } from "./faqHighlights";

vi.mock("../tenant/tenantContext", () => ({
  getTenantContext: vi.fn(),
}));

vi.mock("../tenant/tenantOverrides", () => ({
  getTenantOverrides: vi.fn(() => ({})),
  shouldHideAtlasBranding: vi.fn(),
}));

vi.mock("../config/contact", () => ({
  formatDisplayNumber: vi.fn(() => "+91 90000 00000"),
}));

import { getTenantContext } from "../tenant/tenantContext";
import { shouldHideAtlasBranding } from "../tenant/tenantOverrides";

describe("getFaqHighlights white-label (TASK-7194)", () => {
  beforeEach(() => {
    vi.mocked(getTenantContext).mockReturnValue({ slug: "staybycf", name: "Stay by CF" });
    vi.mocked(shouldHideAtlasBranding).mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("does not mention the penthouse on white-label tenants", () => {
    const faq = getFaqHighlights();
    const joined = faq.map((item) => `${item.question} ${item.answer}`).join(" ");
    expect(joined.toLowerCase()).not.toContain("penthouse");
  });
});

describe("getFaqHighlights atlas marketplace", () => {
  beforeEach(() => {
    vi.mocked(getTenantContext).mockReturnValue({ slug: "atlas", name: "Atlas Homes" });
    vi.mocked(shouldHideAtlasBranding).mockReturnValue(false);
  });

  it("keeps penthouse-specific check-in copy on atlas surfaces", () => {
    const faq = getFaqHighlights();
    const checkIn = faq.find((item) => item.id === "checkin-checkout");
    expect(checkIn?.answer).toMatch(/penthouse/i);
  });
});
