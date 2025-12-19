export type IntentId =
  | "checkin_times"
  | "early_checkin"
  | "cancellation"
  | "extra_guest"
  | "id_requirements"
  | "parking"
  | "address"
  | "wifi";

type IntentResponseBuilder = (context: IntentContext) => string;

export interface IntentDefinition {
  id: IntentId;
  keywords: string[];
  response: IntentResponseBuilder;
}

export interface IntentContext {
  unitCode?: string | null;
  route?: string;
}

export interface IntentMatch {
  id: IntentId;
  response: string;
}

export interface QuickAction {
  id: string;
  label: string;
  prompt: string;
  escalate?: boolean;
}

const normalize = (text: string) => text.toLowerCase();

const responses: Record<IntentId, IntentResponseBuilder> = {
  checkin_times: ({ unitCode }) => {
    const unitText = unitCode ? `for ${unitCode}` : "for our stays";
    return `Standard check-in is 1:00 PM and check-out is 11:00 AM ${unitText}. If your listing shows different times, follow that schedule. Need a different slot? I can request it with the on-ground team.`;
  },
  early_checkin: () =>
    "Early check-in or late check-out depends on the cleaning schedule and nearby bookings. Share your timing preference and I'll check feasibility and any small fee before confirming.",
  cancellation: () =>
    "Cancellations follow the slabs in our Policies page. The closer it is to arrival, the higher the charge. If you need to reschedule, we can usually help—I'll share the /policies link inside the chat toolbar.",
  extra_guest: () =>
    "Extra overnight guests usually attract a small per-night charge and may require pre-approval from the host. Tell me the guest count and nights so I can confirm availability and pricing.",
  id_requirements: () =>
    "Every adult guest needs a valid government ID (passport, Aadhaar, or driver's license). Digital copies work for pre-verification, and the security team may check IDs at arrival too.",
  parking: () =>
    "Most buildings have limited parking slots. Share your dates and vehicle type so we can block a spot or guide you to the nearest option.",
  address: () =>
    "We share the full address and Google Maps pin after booking is confirmed. If you already booked, tell me the unit name and I'll surface the map link for you.",
  wifi: () =>
    "All units include fast Wi-Fi, premium linen, and core amenities. Kitchens are typically stocked with basics; specifics can vary, so ask if you need something particular like utensils or backup power details.",
};

export const intents: IntentDefinition[] = [
  {
    id: "checkin_times",
    keywords: ["check in", "check-in", "checkin", "check out", "checkout", "timing", "arrival", "departure"],
    response: responses.checkin_times,
  },
  {
    id: "early_checkin",
    keywords: ["early", "late check", "late checkout", "early check", "flexible", "early arrival"],
    response: responses.early_checkin,
  },
  {
    id: "cancellation",
    keywords: ["cancel", "cancellation", "refund", "refunds", "policy", "reschedule"],
    response: responses.cancellation,
  },
  {
    id: "extra_guest",
    keywords: ["extra guest", "additional", "visitor", "guests", "headcount"],
    response: responses.extra_guest,
  },
  {
    id: "id_requirements",
    keywords: ["id", "aadhar", "aadhaar", "passport", "license", "verification"],
    response: responses.id_requirements,
  },
  {
    id: "parking",
    keywords: ["parking", "car", "vehicle", "park"],
    response: responses.parking,
  },
  {
    id: "address",
    keywords: ["address", "location", "map", "directions", "google map", "pin"],
    response: responses.address,
  },
  {
    id: "wifi",
    keywords: ["wifi", "wi-fi", "internet", "amenities", "kitchen", "utensils", "linen", "power"],
    response: responses.wifi,
  },
];

export const escalationKeywords = ["agent", "human", "call", "callback", "phone", "someone", "team", "help", "support", "whatsapp"];

export const quickActions: QuickAction[] = [
  {
    id: "checkin",
    label: "Check-in / Check-out",
    prompt: "What are the check-in and check-out timings?",
  },
  {
    id: "early_checkin",
    label: "Early check-in?",
    prompt: "Can I get an early check-in or late check-out?",
  },
  {
    id: "cancellation",
    label: "Cancellation policy",
    prompt: "What is your cancellation policy?",
  },
  {
    id: "extra_guest",
    label: "Extra guests & charges",
    prompt: "Are extra guests allowed and are there any charges?",
  },
  {
    id: "id_required",
    label: "ID required?",
    prompt: "Do you need government ID for all guests?",
  },
  {
    id: "parking",
    label: "Parking",
    prompt: "Is parking available at the property?",
  },
  {
    id: "location",
    label: "Location / Maps",
    prompt: "Can you share the location or Google Maps pin?",
  },
  {
    id: "talk_human",
    label: "Talk to a human (WhatsApp)",
    prompt: "I want to talk to a human on WhatsApp.",
    escalate: true,
  },
  {
    id: "callback",
    label: "Request a callback",
    prompt: "Please schedule a callback about my booking.",
    escalate: true,
  },
];

export const matchIntent = (message: string, context: IntentContext = {}): IntentMatch | null => {
  const normalized = normalize(message);

  const found = intents.find((intent) =>
    intent.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())),
  );

  if (!found) return null;

  return {
    id: found.id,
    response: found.response(context),
  };
};
