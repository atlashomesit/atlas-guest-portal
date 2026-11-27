export interface CommunicationPreferenceForm {
  transactional: boolean;
  checkInCheckoutReminders: boolean;
  postStayReviewRequest: boolean;
  promotionalOffers: boolean;
}

export function normalizeCommunicationPreferences(raw: Record<string, unknown> | null | undefined): CommunicationPreferenceForm {
  const src = raw ?? {};
  return {
    transactional: src.transactional !== undefined ? Boolean(src.transactional) : true,
    checkInCheckoutReminders: Boolean(
      src.checkInCheckoutReminders ?? src.stayReminders ?? src.preArrivalReminders ?? true,
    ),
    postStayReviewRequest: Boolean(
      src.postStayReviewRequest ?? src.reviewRequests ?? src.postStayFeedback ?? true,
    ),
    promotionalOffers: Boolean(
      src.promotionalOffers ?? src.marketingOffers ?? src.marketing ?? false,
    ),
  };
}
