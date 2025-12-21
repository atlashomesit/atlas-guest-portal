export interface PriceDisplayConfig {
  discount: {
    primaryBadgeLabel: string;
    secondaryBadgeLabel: string;
    reasonLabel: string;
    savingsPrefix: string;
  };
  defaultSpecialLabel: string;
  specialPricingLabels: Record<string, string>;
}

export const priceDisplayConfig: PriceDisplayConfig = {
  discount: {
    primaryBadgeLabel: "Best price on our website",
    secondaryBadgeLabel: "Limited-time deal",
    reasonLabel: "Direct booking savings",
    savingsPrefix: "Save",
  },
  defaultSpecialLabel: "Special day pricing",
  specialPricingLabels: {
    "12-31": "New Year Special Pricing 🎉",
  },
};

export default priceDisplayConfig;
