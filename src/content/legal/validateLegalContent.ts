import { faqItems } from "./faqs";
import { policySections } from "./policies";
import { termsSections } from "./terms";

type ValidationResult = {
  valid: boolean;
  errors: string[];
};

const riskyPhrases = ["refundable", "guaranteed", "will always"];

const includesRiskyPhrase = (text: string) =>
  riskyPhrases.some((phrase) => text.toLowerCase().includes(phrase));

type ValidationInput = {
  terms?: typeof termsSections;
  policies?: typeof policySections;
  faqs?: typeof faqItems;
};

export const validateLegalContent = (input?: ValidationInput): ValidationResult => {
  const errors: string[] = [];
  const termSections = input?.terms ?? termsSections;
  const policySectionData = input?.policies ?? policySections;
  const faqSectionData = input?.faqs ?? faqItems;

  const termIds = new Set(termSections.map((t) => t.id));
  const policyIds = new Set(policySectionData.map((p) => p.id));

  policySectionData.forEach((policy) => {
    if (!policy.title) {
      errors.push(`Policy ${policy.id} is missing a title.`);
    }
    if (!policy.summary) {
      errors.push(`Policy ${policy.id} is missing a summary.`);
    }
    if (!policy.termsRefs || policy.termsRefs.length === 0) {
      errors.push(`Policy ${policy.id} must reference at least one Terms section (termsRefs).`);
    }

    policy.termsRefs.forEach((ref) => {
      if (!termIds.has(ref)) {
        errors.push(`Policy ${policy.id} references unknown Terms id: ${ref}.`);
      }
    });

    const needsTermsRef = includesRiskyPhrase(policy.summary) || policy.details.some(includesRiskyPhrase);
    if (needsTermsRef && (!policy.termsRefs || policy.termsRefs.length === 0)) {
      errors.push(`Policy ${policy.id} includes a risky promise and must reference a Terms section.`);
    }
  });

  faqSectionData.forEach((item) => {
    if (!item.question) {
      errors.push(`FAQ ${item.id} is missing a question.`);
    }
    if (!item.answer) {
      errors.push(`FAQ ${item.id} is missing an answer.`);
    }
    if (!item.linksTo || item.linksTo.length === 0) {
      errors.push(`FAQ ${item.id} must include at least one related Policy/Terms link.`);
    }

    item.linksTo?.forEach((link) => {
      if (link.type === "policy" && !policyIds.has(link.id)) {
        errors.push(`FAQ ${item.id} references unknown policy id: ${link.id}.`);
      }
      if (link.type === "terms" && !termIds.has(link.id)) {
        errors.push(`FAQ ${item.id} references unknown terms id: ${link.id}.`);
      }
    });
  });

  return { valid: errors.length === 0, errors };
};

export const runLegalValidation = () => {
  const result = validateLegalContent();
  if (!result.valid) {
    const message = [`Legal content validation failed with ${result.errors.length} issue(s):`, ...result.errors].join("\n - ");
    throw new Error(message);
  }
  return result;
};

if (import.meta.url === new URL(import.meta.url).href && typeof process !== "undefined") {
  try {
    runLegalValidation();
  } catch (error) {
    console.error(String(error));
    process.exit(1);
  }
}
