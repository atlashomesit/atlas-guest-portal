export type CallbackStatus = "idle" | "sending" | "sent" | "error";

export type SupportAnalyticsMetadata = {
  route: string;
  listingId?: string | null;
};
