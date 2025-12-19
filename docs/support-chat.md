## Support chat experience

The guest portal now ships with a compact “Chat with us” pill (bottom-right) that expands into an Atlas Support chat widget. The widget mirrors the Healthians-style launcher: a minimized pill by default, expanding to a full chat window with header controls (minimize and close), conversation feed, quick action chips, and a footer input. State (expanded/minimized/closed) and the last few messages persist via `localStorage` so the widget feels consistent across navigation.

### Behavior

- **Minimized (default):** Small pill labeled “Chat with us,” always visible except during Razorpay/payment flows. Safe-area padding prevents overlap with primary CTAs.
- **Expanded:** Header with “Atlas Support,” minimize and close controls, scrollable feed, quick actions, WhatsApp CTA, and optional callback form. `Esc` minimizes; `Enter` sends.
- **Visibility rules:** Hidden on payment/checkout routes to avoid distracting Razorpay. The sticky callback bar hides while chat is expanded to keep support UI singular.
- **Accessibility:** Focus trap inside the widget, keyboard send/minimize, and semantic `aria` labels.

### Quick actions & intents

The widget boots with quick-action chips:

- Check-in / Check-out
- Early check-in?
- Cancellation policy
- Extra guests & charges
- ID required?
- Parking
- Location / Maps
- Talk to a human (WhatsApp)
- Request a callback

Intents and responses live at `src/components/support/chatbot/intents.ts`. Update keywords/responses there to tweak FAQ answers. The chat shell and behavior live in `src/components/support/SupportLauncher.tsx` and `src/components/support/chatbot/ChatWidget.tsx`.

### Escalation rules

- Messages containing escalation keywords (`agent`, `help`, `call`, `phone`, `whatsapp`, etc.) or the WhatsApp/callback quick actions trigger escalation state and surface the WhatsApp CTA.
- The WhatsApp CTA is always present inside the chat. Clicking it leaves the chat window available in the background.
- Callback: selecting the callback action opens an inline form (10-digit validation) and submits through the `submitCallbackRequest` stub (`src/components/support/callbackService.ts`). Phone numbers are not sent to analytics—only to the stubbed submitter.

### Where to edit

- **Launcher pill / chat shell:** `src/components/support/chatbot/ChatLauncherPill.tsx`, `src/components/support/chatbot/ChatWidget.tsx`
- **Chat orchestration + rules:** `src/components/support/SupportLauncher.tsx`
- **FAQ intents & quick actions:** `src/components/support/chatbot/intents.ts`
- **Callback capture:** `src/components/support/callbackService.ts`

### Suppression (when not to show)

- Suppressed on payment/checkout routes (`payment`, `razorpay`, `pay`, or `checkout` in the pathname).
- Sticky callback bar is hidden while chat is expanded to avoid overlapping support UI.

### Analytics

See `docs/analytics.md` for the full event catalog. New chat events include `chat_pill_viewed`, `chat_opened`, `chat_minimized`, `chat_message_sent`, `chat_quick_action_clicked`, `chat_escalated_whatsapp`, `chat_callback_started`, and `chat_callback_submitted`.
