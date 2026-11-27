import { describe, expect, it } from "vitest";
import { normalizeCommunicationPreferences } from "./communicationPreferencesMapping";

describe("normalizeCommunicationPreferences (NOTIF-087)", () => {
  it("maps canonical and alias preference categories accurately", () => {
    expect(
      normalizeCommunicationPreferences({
        transactional: true,
        stayReminders: false,
        reviewRequests: false,
        marketingOffers: true,
      }),
    ).toEqual({
      transactional: true,
      checkInCheckoutReminders: false,
      postStayReviewRequest: false,
      promotionalOffers: true,
    });
  });

  it("preserves explicit false values on canonical keys", () => {
    expect(
      normalizeCommunicationPreferences({
        transactional: true,
        checkInCheckoutReminders: false,
        postStayReviewRequest: false,
        promotionalOffers: false,
      }),
    ).toEqual({
      transactional: true,
      checkInCheckoutReminders: false,
      postStayReviewRequest: false,
      promotionalOffers: false,
    });
  });
});
