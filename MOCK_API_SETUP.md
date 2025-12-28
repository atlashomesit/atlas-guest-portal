# Mock API Setup

## Overview

The Atlas Homestays Guest Portal includes a mock API system for development when the backend API is not yet available or configured. This allows frontend development to continue independently while the backend team works on the actual API implementation.

## How It Works

### Automatic Detection

The system automatically detects when the backend API is not configured by checking the `IS_API_BASE_CONFIGURED` flag. When this flag is `false`, all API calls are automatically routed to the mock API instead of the real backend.

### Mock Data Indicator

All mock API responses include a console log with the 🎭 emoji to clearly indicate that mock data is being used:

```
🎭 [API] Using mock data for: /bookings
🎭 [MOCK API] Returning 5 mock bookings
```

UI components also display a status message:
```
🎭 Using mock data for development. Configure API base URL for live bookings.
```

## Mock Data Available

### 1. Bookings (`/bookings`)

Returns an array of mock bookings with the following structure:

```typescript
{
  id: string;
  listing: string;           // e.g., "Atlas201", "Atlas501_PH"
  listingId: string;         // e.g., "201", "501"
  propertyId: string;        // e.g., "201", "501"
  checkIn: string;           // ISO date format
  checkOut: string;          // ISO date format
  checkinDate: string;       // Alternative field name
  checkoutDate: string;      // Alternative field name
  guests: number;
  status: 'confirmed' | 'pending' | 'cancelled';
  createdAt: string;
}
```

**Mock bookings include:**
- Property 201: 2 bookings (5-8 days from today, 15-18 days from today)
- Property 301: 1 booking (7-10 days from today)
- Property 501: 2 bookings (3-6 days from today, 20-25 days from today)

### 2. Properties (`/properties`)

Returns an array of mock properties:

```typescript
{
  id: number;
  name: string;
  slug: string;
  type: '1bhk' | '2bhk' | '3bhk' | 'penthouse';
  maxGuests: number;
  basePrice: number;
  available: boolean;
}
```

**Mock properties:**
- Room 201 (1BHK, ₹3,500/night, max 3 guests)
- Room 301 (2BHK, ₹4,500/night, max 4 guests)
- Room 401 (2BHK, ₹4,800/night, max 4 guests)
- Penthouse 501 (Penthouse, ₹7,000/night, max 6 guests)

### 3. Listings (`/listings`)

Returns an array of mock listings:

```typescript
{
  id: string;
  propertyId: number;
  name: string;
  type: string;
  price: number;
  available: boolean;
}
```

## Files Modified

### Core Mock API
- **`src/lib/mockApi.ts`**: Contains all mock data generation functions and the mock API client

### API Integration
- **`src/lib/api.ts`**: Updated to automatically use mock API when backend is not configured

### Components Using Mock Data
- **`src/components/availability/UnitBookingWidget.tsx`**: Individual listing booking widget
- **`src/components/homepage_components/hotelBooking_form/BookingCard.tsx`**: Homepage booking form
- **`src/pages/Apartments.tsx`**: Apartments listing page

## Backend API Contract

When the backend team is ready to implement the API, they should use the same data structure as the mock API. The mock data serves as the **API contract** that both frontend and backend teams can reference.

### Endpoints Required

1. **GET `/bookings`**
   - Returns: `{ bookings: MockBooking[] }`
   - Used to fetch all bookings and filter by property

2. **GET `/properties`**
   - Returns: `MockProperty[]`
   - Used to fetch property metadata

3. **GET `/listings`**
   - Returns: `MockListing[]`
   - Used to fetch available listings

### Data Structure Notes

- **Date Fields**: Both `checkIn`/`checkOut` and `checkinDate`/`checkoutDate` should be supported for backward compatibility
- **Listing IDs**: Format should match "Atlas{number}" or "Atlas{number}_{suffix}" (e.g., "Atlas201", "Atlas501_PH")
- **Property IDs**: Can be either string or number, but should match the numeric part of the listing ID

## Testing

### To Test with Mock Data

1. Ensure `VITE_API_BASE_URL` is not set in your `.env` file
2. Start the dev server: `npm run dev`
3. Open the browser console and look for 🎭 emoji logs
4. Navigate to:
   - Homepage booking form
   - Individual listing pages
   - Apartments search page
5. Verify that:
   - Mock data is loaded
   - Dates are blocked according to mock bookings
   - Status messages indicate mock data is being used

### To Test with Real API

1. Set `VITE_API_BASE_URL` in your `.env` file
2. Restart the dev server
3. Verify that real API calls are being made (no 🎭 emoji in console)

## Adding More Mock Data

To add more mock bookings, properties, or listings:

1. Open `src/lib/mockApi.ts`
2. Find the relevant `generate*` function:
   - `generateMockBookings()` for bookings
   - `generateMockProperties()` for properties
   - `generateMockListings()` for listings
3. Add new entries following the existing pattern
4. Ensure dates are relative to `today` using `addDays(today, N)`

## Blocking Dates on Listing Detail Pages (Mock)

- Booking contract: `src/types/booking.ts` (`BookingDTO` with `checkInDate`, `checkOutDate` ISO strings; checkout is exclusive)
- Mock generator: `src/mocks/bookings.ts`
  - `generateMockBookings(listingIds, start, monthsAhead=2, blockedRatio=0.2)` produces deterministic ranges per listing (seeded by listingId) covering ~20% of next 2 months, 2–6 night ranges, non-overlapping.
  - `getMockBookingsForListing(listingId)` returns cached deterministic mock bookings.
- Date utilities: `src/utils/dateRange.ts`
  - `expandBookingsToBlockedSet` to turn bookings into a blocked Set
  - `doesRangeIntersectBlocked` to validate ranges
- Service wrapper: `src/services/bookingService.ts` (`getBookingsForListing`) currently calls the mock generator; swap to real API later.
- UI wiring (individual listing widget): `src/components/availability/UnitBookingWidget.tsx`
  - Blocks days from mock bookings, prevents selecting ranges that cross blocked dates, and shows an inline message when overlap occurs.
- Homepage/global search is unchanged (no blocking) to avoid unintended UX changes.

### Swapping to Backend
When the real backend is ready, update `getBookingsForListing` in `src/services/bookingService.ts` to call your API endpoint and return `BookingDTO[]` in the same shape. Keep checkout exclusive.

## Network Delay Simulation

The mock API includes a simulated network delay:
- GET requests: 300ms
- POST requests: 500ms

This helps test loading states and ensures the UI handles async operations correctly.

## Future Enhancements

Potential improvements to the mock API system:

1. **Mock Error Responses**: Add ability to simulate API errors for testing error handling
2. **Configurable Delay**: Allow developers to adjust the simulated network delay
3. **Local Storage Persistence**: Save mock data changes for testing booking flows
4. **Mock POST/PUT/DELETE**: Add support for write operations
5. **Swagger/OpenAPI Spec**: Generate API documentation from mock data structure

