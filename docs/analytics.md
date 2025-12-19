## Analytics overview

This project includes a lightweight analytics helper that standardizes event payloads and keeps them network-safe by default. Events are enriched with the current environment (`dev` or `prod`), route context, timestamps, and relevant identifiers (listing/unit/property codes) so future backends can ingest consistent telemetry. Always pass a `surface` string so downstream consumers can filter by UI origin, and never include PII (phone numbers, email addresses, raw chat text, etc.).

### Helper usage

The helper lives at `src/utils/analytics.ts` and exposes:

- `trackEvent(event, payload?, identifiers?)` – builds a payload with common fields and sends it to a transport (console logging by default). Returns the enriched payload.
- `setAnalyticsTransport(transport)` – replace the default console transport (e.g., to POST to your backend).
- `resetAnalyticsTransport()` – restore the default console transport.

Example:

```ts
import { trackEvent } from "../utils/analytics";

trackEvent(
  "listing_selected",
  { surface: "apartments" },
  { listingId: "501", route: "/property_details/501" }
);
```

### Environment tagging

The helper maps `import.meta.env.MODE` to:

- `prod` when `MODE === "production"`
- `dev` for all other modes

Every event includes an `env` field so downstream services can segment traffic automatically.

### Payload hygiene

All events automatically attach:

- `env`: `dev` or `prod`
- `route`: current pathname or the provided override
- `timestamp`: ISO string
- Identifiers: `listingId`, `unitCode`, and/or `propertyId` when provided

Add a `surface` string for every UI trigger to simplify downstream filtering. Payloads must stay PII-free: capture metadata (counts, states, action identifiers), not phone numbers, email addresses, or free-form chat text.

### Current events and payloads

| Event | When it fires | Key payload fields |
| --- | --- | --- |
| `home_view` | Home page mount | `surface`, `listings` (available homes) |
| `listings_browse` | Home locations grid render, Apartments page filter changes, hero CTA | `surface`, `total`, `featured`, `sortBy`, `guests`, `minPrice`, `maxPrice`, `propertyType`, `petFriendlyOnly` |
| `listing_selected` | Selecting a listing card | `surface`, `listingName`, identifiers (`listingId`, `unitCode`, `route`) |
| `listing_view` | Property details page loads | `surface`, `propertyName`, `price`, identifiers |
| `dates_selected` | Date picker selection in booking form | `surface`, `startDate`, `endDate`, `nights`, `guests`, identifiers |
| `reserve_click` | Reserve/Book CTA click | `surface`, `termsAccepted`, `hasSelection`, `guests`, `nights`, identifiers |
| `checkout_start` | Razorpay checkout initialization | `surface`, `bookingId`, `total`, `nights`, `guests`, identifiers |
| `payment_success` | Payment success handler | `surface`, `bookingId`, `paymentId`, `total`, identifiers |
| `payment_failure` | Payment failure handler | `surface`, `bookingId`, `reason`, identifiers |
| `support_whatsapp` | WhatsApp links (floating button, sticky bar, help launcher) | `surface`, identifiers |
| `support_call` | Phone links (sticky bar, help launcher) | `surface`, identifiers |
| `support_faq` | FAQ navigation from Help Launcher | `surface`, identifiers |

### Callback and chat events

| Event | When it fires | Expected payload fields |
| --- | --- | --- |
| `callback_bar_viewed` | Callback bar, banner, or CTA loads | `surface`, identifiers (`listingId`, `unitCode`, `route`) |
| `callback_submitted` | Callback lead submitted successfully | `surface`, identifiers, `submissionId` (generated client id), `attempt` (ordinal). Do **not** include phone/email. |
| `callback_submit_failed` | Callback submission request errors | `surface`, identifiers, `error` (non-PII message or code), `attempt` |
| `chat_opened` | Chat UI opened or expanded | `surface`, identifiers, `entryPoint` (launcher button, inline prompt, hotkey) |
| `chat_message_sent` | User sends a chat message | `surface`, identifiers, `messageType` (`text`/`quick_action`), `charCount` (omit message body) |
| `chat_quick_action_clicked` | Quick action/pill tapped in chat | `surface`, identifiers, `actionId`, `actionLabel` (ui copy) |
| `chat_escalated_whatsapp` | Chat handoff to WhatsApp is initiated | `surface`, identifiers |
| `chat_callback_cta_clicked` | Chat inline callback CTA clicked | `surface`, identifiers |

### Integration points (existing)

- Home view (`src/pages/home/Home.tsx`)
- Hero CTA (`src/components/homepage_components/slider/Slider.tsx`)
- Home listings grid (`src/components/homepage_components/homepage_locations/HomePage_Locations.tsx`)
- Apartments browse & filter changes (`src/pages/Apartments.tsx`)
- Property details view (`src/components/homepage_components/homepage_Propertydetails/Homepage_PropertyDetails.tsx`)
- Booking form interactions (`src/components/homepage_components/hotelBooking_form/HotelBooking_Form.tsx`)
- Support surfaces (`src/components/support/FloatingWhatsAppButton.tsx`, `SupportStickyBar.tsx`, `HelpLauncher.tsx`)

### Adding a backend transport

To ship events to a backend, provide a custom transport:

```ts
import { setAnalyticsTransport } from "../utils/analytics";

setAnalyticsTransport(async (payload) => {
  await fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
});
```

Keep the transport resilient; the default console transport will be used if a custom transport throws.

### Testing

`src/utils/analytics.test.ts` includes transport tests to keep payload enrichment and fallback behavior stable. Run:

```
npx vitest run src/utils/analytics.test.ts
```
