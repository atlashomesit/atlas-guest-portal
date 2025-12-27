# Guest portal search mode

- The homepage hero uses `SearchAvailabilityWidget` in **search** mode to collect dates and guests without binding to a listing ID. Search mode throws if a `listingId` is provided so the flow stays listing-agnostic.
- Submitting the hero widget now opens an availability modal instead of navigating immediately. The dialog explains that multiple homes may be available and that split-stay booking will be supported soon. Close or Continue both dismiss the modal via ESC or backdrop clicks, and Continue proceeds with the availability check before routing to `/search` with the selected params.
- Past dates remain disabled in the date picker; other constraints mirror the booking defaults (minimum 1 guest, 1-night minimum enforced after check-in).
