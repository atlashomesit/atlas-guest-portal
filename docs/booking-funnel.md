## Booking funnel: hero search and listings handoff

The homepage hero search now aligns with booking intent. It captures dates, guests, and routes visitors directly to listings with the same filters.

### Inputs and defaults
- **Check-in**: native date input, default to today.
- **Check-out**: native date input, default to tomorrow with `min` tied to the selected check-in.
- **Guests**: numeric input, default `2`, minimum `1`.
- **Persistence**: the last selections are saved in `localStorage` under `atlasHeroSearch` so the hero remembers recent input.

### Validation rules
- Check-in cannot be in the past.
- Check-out must be after check-in.
- Guests must be at least `1`.
- Invalid stored values fall back to the defaults above.

### CTA behavior
- **Primary**: “Check availability” submits the form. On success, the app navigates to `/apartments` with query params.
- **Secondary**: “Browse listings” links to `/apartments` without additional params.

### Query parameters
The hero form encodes selections into the listings route:

```
/apartments?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&guests=2
```

Listings read these params on load:
- `guests` seeds the guest filter (min 1).
- `checkIn` / `checkOut` are recorded for analytics and surfaced as a trip summary chip above the filters.

### Mobile layout notes
- Inputs stack vertically on small screens; CTAs wrap beneath the fields.
- Date inputs use native pickers for minimal dependencies and faster input on touch devices.

### Analytics
- Hero submission tracks `listings_browse` with `checkIn`, `checkOut`, and `guests`.
- Listings track views including the seeded query params to reflect user intent.
