## Support chat experience

The guest portal now ships with a compact “Chat with us” pill (bottom-right) that expands into an Atlas Support widget. The widget is minimized by default and expands to a panel with support shortcuts (WhatsApp, call, FAQs), a callback form, and a chat placeholder while backend messaging is wired up. State remains simple and avoids covering primary CTAs or cookie banners.

### Behavior

- **Minimized (default):** Small pill labeled “Chat with us,” always visible except during Razorpay/payment flows. Safe-area padding prevents overlap with primary CTAs. The widget nudges upward near the footer to avoid covering links.
- **Expanded:** Header with close control, grid of shortcuts (WhatsApp, call, FAQs, callback), inline callback form (10-digit validation), and a chat placeholder for future live messaging. A collapse link closes the panel.
- **Visibility rules:** Hidden on payment/checkout routes to avoid distracting Razorpay flows.
- **Accessibility:** Buttons include `aria` labels; controls are keyboard focusable.

### Where to edit

- **Floating pill + panel:** `src/components/support/SupportWidget.tsx`

### Suppression (when not to show)

- Suppressed on payment/checkout routes (`payment`, `razorpay`, `pay`, or `checkout` in the pathname).

### Analytics

See `docs/analytics.md` for the full event catalog. Chat-related events currently cover `chat_opened`, `chat_minimized`, `support_whatsapp`, `support_call`, `support_faq`, and `chat_callback_submitted`.
