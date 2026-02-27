# Contact number configuration

All guest-facing contact numbers are centralized in `src/config/contact.ts`.

## Defaults
- Business (primary): `7032493290`
- Owner (escalation only): `9177773290`

UI components should default to the business channel. Only use the owner channel for explicit escalation/legal flows.

## Helpers
- `getTelLink(channel?)` returns a `tel:` link prefixed with `+91` for the selected channel (business by default).
- `getWhatsAppLink(channel?)` returns a `wa.me` link using digits only.
- `formatDisplayNumber(channel?)` renders the `+91-` formatted number for display.

## Updating numbers
1. Change the values inside `CONTACT` in `src/config/contact.ts`.
2. Run `npm test` to ensure the contact guard tests still pass.
3. Avoid hardcoding numbers elsewhere—reuse the helpers above.

## Regression guard
`src/config/contact.test.ts` verifies the default channel and prevents the legacy contact number from reappearing.
