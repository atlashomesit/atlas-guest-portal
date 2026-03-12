# API Contracts

At this time the Atlas Homes Frontend does not expose or consume custom backend APIs. Contact/booking flows are handled via the email service used by Cloudflare Pages Functions:

- [`src/lib/email/emailService.ts`](../../src/lib/email/emailService.ts)
- [`src/pages/contactus/ContactUs.tsx`](../../src/pages/contactus/ContactUs.tsx)

If new backend integrations are introduced, document request/response schemas here.
