# API Contracts

<<<<<<< HEAD
At this time the Atlas Homes Frontend does not expose or consume custom backend APIs. All external calls are handled by the EmailJS SDKs used in:

- [`src/components/homepage_components/homepage_Propertydetails/BookingFrom.tsx`](../../src/components/homepage_components/homepage_Propertydetails/BookingFrom.tsx)
- [`src/pages/contactus/ContactUs.tsx`](../../src/pages/contactus/ContactUs.tsx)

Refer to the [EmailJS REST documentation](https://www.emailjs.com/docs/rest-api/send/) for payload structure and authentication requirements. If new backend integrations are introduced, document request/response schemas here.
=======
At this time the Atlas Homes Frontend does not expose or consume custom backend APIs. Contact/booking flows are handled via the email service used by Cloudflare Pages Functions:

- [`src/lib/email/emailService.ts`](../../src/lib/email/emailService.ts)
- [`src/pages/contactus/ContactUs.tsx`](../../src/pages/contactus/ContactUs.tsx)

If new backend integrations are introduced, document request/response schemas here.
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
