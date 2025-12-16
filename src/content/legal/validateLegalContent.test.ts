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
});
