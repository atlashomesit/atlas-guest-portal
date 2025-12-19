# Support chatbot and launcher

This doc captures the lightweight intent engine, triggers, and escalation rules for the floating support launcher.

## Surface overview
- **SupportLauncher** (`src/components/support/SupportLauncher.tsx`): single floating trigger that opens a panel with WhatsApp, FAQ, call, and callback shortcuts plus a chatbot area.
- **CallbackRequestBar** (`src/components/support/CallbackRequestBar.tsx`): safe-area-aware bar for collecting a phone number and optional note; invoked from the launcher or callback-related intents.
- **Intent engine** (`src/components/support/chatbot/intents.ts`): keyword-based matcher returning canned responses and quick-action chips.

## Intents
The intent file defines keyword maps and responses. Current intents include:
- **Check-in/out times** (`checkin_times`): standard 1:00 PM check-in and 11:00 AM check-out, with unit-aware phrasing.
- **Early check-in / late check-out** (`early_checkin`): dependent on cleaning/adjacent bookings.
- **Cancellation / refunds** (`cancellation`): points guests to `/policies` slabs and reschedule help.
- **Extra guest charges** (`extra_guest`): explains small per-night fees and pre-approval.
- **ID requirements** (`id_requirements`): government ID required for every adult guest.
- **Parking** (`parking`): limited slots; asks for dates and vehicle type.
- **Address / map link** (`address`): shared post-booking; can surface map when booking is confirmed.
- **Wi-Fi / amenities** (`wifi`): fast Wi-Fi, premium linen, kitchen/backup caveats.

Update keywords/responses in `src/components/support/chatbot/intents.ts`; keep tone concise and action-oriented.

## Quick actions
Rendered as chips beneath the chat transcript:
- Pricing & availability → “Can you help me check pricing and availability for this stay?”
- Check-in rules → “What are the check-in and check-out rules?”
- Talk to a human (WhatsApp) → escalates and nudges WhatsApp.
- Request a callback → escalates and opens the callback bar.

Add new quick actions by extending `quickActions` in `intents.ts`. Use short labels and full-sentence prompts.

## Escalation rules
- Messages containing `agent`, `human`, `call`, `callback`, `phone`, `someone`, or `team` trigger escalation.
- Quick actions marked `escalate: true` also trigger escalation.
- Escalation surfaces the WhatsApp and callback shortcuts; callback-related messages auto-open the callback bar.

## Accessibility & UX
- Panel traps focus while open, supports `Esc` to close, and sends initial focus to the first control.
- Positioning respects safe-area insets and offsets near reserve/checkout CTAs.
- Recent chat history (up to 15 messages) persists in `localStorage` when available.

## Analytics
Events are emitted via `trackEvent` with route/unit context and without PII:
- `chat_opened` when the panel opens.
- `chat_message_sent` for user messages (payload includes source and intent classification).
- `chat_quick_action_clicked` when a chip is tapped.
- `chat_escalated_whatsapp` when escalation keywords/actions are detected.
- `chat_callback_cta_clicked` when the callback shortcut is invoked.

Add new events in `src/utils/analytics.ts` and document them in `docs/analytics.md`.

## Content updates
1) Edit responses/keywords in `src/components/support/chatbot/intents.ts`.
2) Adjust quick actions there; match prompts to the UX copy.
3) If adding new escalation paths, update `escalationKeywords` and the handling logic in `SupportLauncher.tsx`.
4) Keep analytics payloads in sync with `docs/analytics.md` so dashboards remain accurate.
