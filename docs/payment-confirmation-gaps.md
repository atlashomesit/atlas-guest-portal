# Payment and confirmation follow-ups

- The booking flow currently routes to the `/reserve` confirmation placeholder after collecting contact info and consent, without invoking a live payment provider. Implementing a real payment capture will require wiring Razorpay (or another PSP) with valid `VITE_RAZORPAY_KEY_ID` credentials and success/failure callbacks. 
- The checkout confirmation still depends on the manual "Confirm & contact concierge" action on the `/reserve` page rather than an automated payment receipt. Add a payment success handoff that writes booking metadata and surfaces the gateway transaction ID to guests.
- The Razorpay loader in `BookingCard` still attempts to insert the hosted script when no cached `window.Razorpay` is present. In lower environments the script URL can fail silently; consider adding a local stub or feature flag to avoid user-visible friction when the gateway is intentionally disabled.
