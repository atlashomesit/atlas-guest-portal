import { describe, expect, it } from "vitest";
import { validateLegalContent } from "./validateLegalContent";
import { policySections } from "./policies";
import { faqItems } from "./faqs";

describe("validateLegalContent", () => {
  it("passes when ids and references are valid", () => {
    const result = validateLegalContent();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when a policy is missing a termsRef", () => {
    const mutatedPolicies = policySections.map((policy, idx) =>
      idx === 0 ? { ...policy, termsRefs: [] } : policy
    );
    const outcome = validateLegalContent({ policies: mutatedPolicies });
    expect(outcome.valid).toBe(false);
    expect(outcome.errors.some((err) => err.includes("must reference at least one Terms"))).toBe(true);
  });

  it("fails when an FAQ lacks related links", () => {
    const mutatedFaqs = faqItems.map((faq, idx) => (idx === 0 ? { ...faq, linksTo: [] } : faq));
    const result = validateLegalContent({ faqs: mutatedFaqs });

    expect(result.valid).toBe(false);
    expect(result.errors.some((err) => err.includes("must include at least one related"))).toBe(true);
  });

  it("fails when a referenced id does not exist", () => {
    const mutatedFaqs = faqItems.map((faq, idx) =>
      idx === 1 ? { ...faq, linksTo: [{ type: "terms", id: "non-existent" as never }] } : faq
    );
    const result = validateLegalContent({ faqs: mutatedFaqs });

    expect(result.valid).toBe(false);
    expect(result.errors.some((err) => err.includes("unknown terms id"))).toBe(true);
  });

  it("GUEST-080: reschedule policy and FAQ state date changes depend on the host and listing policy, with no day counts or percentage fees", () => {
    const reschedPolicy = policySections.find((p) => p.id === "reschedules")!;
    expect(reschedPolicy).toBeDefined();
    const reschedFaq = faqItems.find((f) => f.id === "reschedule-options")!;
    expect(reschedFaq).toBeDefined();

    const combined = [reschedPolicy.summary, ...reschedPolicy.details, reschedFaq.answer].join("\n");
    expect(combined).toMatch(/depend on the host and the listing's policy shown at booking/i);
    expect(combined).not.toMatch(/\b(15|7|90)\s*days?\b/i);
    expect(combined).not.toMatch(/7[–-]15/);
    expect(combined).not.toMatch(/\d+\s*%/);
  });
});
