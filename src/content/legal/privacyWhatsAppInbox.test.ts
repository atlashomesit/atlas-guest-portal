/**
 * TASK-10299399 (council ruling C18, provisional): the guest-portal privacy notice says, in plain words, that messages
 * a guest sends to a host's WhatsApp number are stored in that host's Atlas inbox and kept for now, and promises no
 * deletion period. It is the same wording the landing and admin-portal notices use (TASK-10299379). Wording only:
 * nothing is deleted. The sentences are asserted on the notice content (what PrivacyPage renders), so a later edit
 * that drops them or adds a period fails here.
 */
import { describe, expect, it } from "vitest";
import { privacySections } from "./privacy";

const section = (id: string) => {
  const found = privacySections.find((s) => s.id === id);
  if (!found) throw new Error(`privacy section ${id} is missing`);
  return found;
};

const INBOX = "stored in that host's Atlas inbox";
/** Any "30 days", "12 months", "2 years" style promise. */
const PERIOD = /\b\d+\s*(?:days?|weeks?|months?|years?)\b/i;

describe("guest-portal privacy notice: guest WhatsApp messages to a host (TASK-10299399)", () => {
  it("lists them under the personal data collected, as stored in that host's Atlas inbox and kept for now", () => {
    const line = section("personal-data-we-collect").details.find((d) => d.startsWith("Messages you send to a host on WhatsApp"));
    expect(line, "the collection list must name the messages guests send to a host on WhatsApp").toBeDefined();
    expect(line).toContain(INBOX);
    expect(line).toContain("kept for now");
    expect(line).toContain("no deletion period is set");
    expect(line).not.toMatch(PERIOD);
  });

  it("says it again in the retention section, in the same words as the landing notice, with no period", () => {
    const line = section("retention").details.find((d) => d.includes(INBOX));
    expect(line).toBe(
      "Messages a guest sends to a host's WhatsApp number are stored in that host's Atlas inbox and are kept for now; no deletion period is set.",
    );
    expect(line).not.toMatch(PERIOD);
  });

  it("does not shrink the existing erasure route: the right to erasure is still described", () => {
    const retention = section("retention").details.join(" ");
    expect(retention).toContain("When you exercise your right to erasure (Section 12)");
    expect(section("your-rights").details.join(" ")).toContain("Right to erasure (Section 12)");
  });
});
