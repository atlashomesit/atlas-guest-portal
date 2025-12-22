export const SUPPORT_DRAWER_COPY = {
  header: {
    title: "Need a hand?",
    subtitle: "Chat with Atlas or jump to WhatsApp/callback without losing your place.",
    // Warmer variants for future experiments:
    // - "We’re right here if you need us—ping us and we’ll reply in minutes."
    // - "Questions? Our team is online and ready to help."
  },
  trustMicrocopy: "Fast support on WhatsApp",
  trigger: {
    ariaLabel: "Chat with us",
    label: "Chat with us",
    helper: "WhatsApp, call, FAQs",
  },
  controls: {
    closeAriaLabel: "Close support widget",
    closeReassurance: "You can reopen any time if you still need us.",
  },
  actions: {
    whatsapp: {
      label: "WhatsApp",
      description: "Fastest response",
    },
    call: {
      label: "Call",
      description: "Speak with the team",
    },
    faq: {
      label: "FAQs",
      description: "Instant answers",
    },
    callback: {
      label: "Request callback",
      description: "We’ll ring you back",
    },
    secondaryHeader: {
      hierarchy: "Next best options",
      flat: "Other ways to reach us",
    },
    tertiaryHeader: "Self-serve",
  },
  callbackForm: {
    title: "Callback request",
    subtitle: "Share your number and we’ll reach out shortly.",
    phonePrefixLabel: "+91",
    phoneInputAriaLabel: "Callback phone",
    expectationText: undefined as string | undefined,
    phonePlaceholder: "10-digit phone number",
    invalidPhoneError: "Enter a valid 10-digit number.",
    submissionError: "Could not send request. Try WhatsApp or call us.",
    submitLabels: {
      idle: "Submit",
      sending: "Sending...",
      sent: "Request sent",
    },
    closeLabel: "Close",
    successMessage: "We’ll call you soon.",
    // Warmer follow-up ideas to trial:
    // - "We usually call back within 10 minutes (9am–9pm IST)."
    // - "Expect a quick ring from our team—stay close to your phone!"
  },
  chatbot: {
    hidden: {
      title: "Chat support",
      description: "Prefer chat? Message us on WhatsApp for instant support.",
    },
    placeholder: {
      title: "Chat interface",
      description: "Placeholder while backend wiring is in progress.",
      openingLine:
        "Hi there! Ask about check-in rules, cancellations, parking, or anything else about your stay.",
      inputPlaceholder: "Messaging coming soon",
    },
  },
} as const;
