# API Contracts

At this time the Atlas Homes Frontend does not expose or consume custom backend APIs. All external calls are handled by the EmailJS SDKs used in:

- [`src/components/homepage_components/homepage_Propertydetails/BookingFrom.tsx`](../../src/components/homepage_components/homepage_Propertydetails/BookingFrom.tsx)
- [`src/pages/contactus/ContactUs.tsx`](../../src/pages/contactus/ContactUs.tsx)

Refer to the [EmailJS REST documentation](https://www.emailjs.com/docs/rest-api/send/) for payload structure and authentication requirements. If new backend integrations are introduced, document request/response schemas here.
