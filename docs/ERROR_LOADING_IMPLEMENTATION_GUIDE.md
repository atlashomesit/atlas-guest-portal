# Error & Loading Patterns — Implementation Guide

Quick reference for implementing unified error and loading patterns in the Guest and Owner portals.

---

## Files Created

### Documentation
- **`docs/UNIFIED_ERROR_LOADING_PATTERNS.md`** — Complete spec, design tokens, animations, a11y
- **`docs/ERROR_LOADING_IMPLEMENTATION_GUIDE.md`** — This file (implementation quick ref)

### Type Definitions
- **`src/types/errors.ts`** — TypeScript types for errors, loading states, state actions

### Utilities
- **`src/utils/errorBuilder.ts`** — Error factory functions (buildValidationError, buildNetworkError, etc.)

### Styles
- **`src/styles/animations.css`** — Custom CSS animations (skeleton-pulse, stagger, shake, etc.)

### Existing Components (Already in Place)
- **`src/components/ErrorBanner.tsx`** — Inline dismissible alerts
- **`src/components/ErrorDisplay.tsx`** — Structured errors with actions
- **`src/components/StateMessage.tsx`** — Empty states, 404, permission denied
- **`src/components/ErrorLayout.tsx`** — Full-page error screens
- **`src/components/ErrorBoundary.tsx`** — Global error catcher
- **`src/components/LoadingState.tsx`** — Skeleton factory component
- **`src/components/apartments/SkeletonCard.tsx`** — Reusable card skeleton

---

## Error Pattern Usage

### 1. **Inline Validation Error**
Show errors within a form without breaking flow.

```tsx
import { ErrorBanner } from "@/components/ErrorBanner";

export function CheckoutForm() {
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Email is required");
      return;
    }
    // Submit...
  };

  return (
    <>
      {error && (
        <ErrorBanner 
          message={error}
          severity="error"
          onDismiss={() => setError(null)}
        />
      )}
      <form onSubmit={handleSubmit}>
        {/* form fields */}
      </form>
    </>
  );
}
```

### 2. **Form Field Validation Error**
Use ErrorDisplay for structured field-level errors.

```tsx
import ErrorDisplay from "@/components/ErrorDisplay";
import { buildValidationError } from "@/utils/errorBuilder";

export function PaymentForm() {
  const [fieldError, setFieldError] = useState(null);

  const handlePayment = async () => {
    if (!cardNumber) {
      setFieldError(buildValidationError(
        "Card number",
        "must be 16 digits"
      ));
      return;
    }
  };

  return (
    <>
      {fieldError && (
        <ErrorDisplay 
          error={fieldError}
          onActionClick={(action) => {
            if (action.actionType === "RETRY") {
              // Focus field, clear error
              setFieldError(null);
            }
          }}
        />
      )}
      {/* form fields */}
    </>
  );
}
```

### 3. **Network Error with Retry**
Handle failed API calls with retry logic.

```tsx
import { ErrorBanner } from "@/components/ErrorBanner";
import { buildNetworkError } from "@/utils/errorBuilder";

export function PropertySearch() {
  const [error, setError] = useState(null);

  const fetchListings = async () => {
    try {
      const res = await fetch("/api/listings");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // ...
    } catch (err) {
      setError(buildNetworkError());
    }
  };

  return (
    <>
      {error && (
        <ErrorBanner
          message={error.message}
          severity="error"
          onRetry={() => {
            setError(null);
            fetchListings();
          }}
          onDismiss={() => setError(null)}
        />
      )}
      {/* content */}
    </>
  );
}
```

### 4. **Full-Page Error (Error Boundary)**
Catch React render errors automatically.

```tsx
import ErrorBoundary from "@/components/ErrorBoundary";
import PaymentFlow from "@/components/PaymentFlow";

export function App() {
  return (
    <ErrorBoundary name="PaymentFlow">
      <PaymentFlow />
    </ErrorBoundary>
  );
}
```

### 5. **Not Found / Empty State**
Show empty state when resource doesn't exist.

```tsx
import StateMessage from "@/components/StateMessage";

export function PropertyDetail({ id }) {
  const [property, setProperty] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchProperty(id)
      .catch(err => {
        if (err.status === 404) setNotFound(true);
      });
  }, [id]);

  if (notFound) {
    return (
      <StateMessage
        icon="🏠"
        title="Property Not Found"
        message="This listing may have been removed or is no longer available."
        primaryAction={{ label: "Browse Listings", to: "/search" }}
        secondaryActions={[
          { label: "Contact Support", href: "/support" }
        ]}
      />
    );
  }

  return <PropertyCard property={property} />;
}
```

### 6. **Permission Denied**
User lacks access to resource.

```tsx
import StateMessage from "@/components/StateMessage";
import { buildForbiddenError } from "@/utils/errorBuilder";

export function OwnerDashboard() {
  const user = useAuthContext();

  if (!user.isOwner) {
    const error = buildForbiddenError("dashboard");
    return (
      <StateMessage
        icon="🔒"
        title={error.message}
        message={error.details}
        primaryAction={{ label: "Browse as Guest", to: "/search" }}
      />
    );
  }

  return <Dashboard />;
}
```

---

## Loading Pattern Usage

### 1. **Skeleton Cards (Search Results)**
Grid of property listings while fetching.

```tsx
import { LoadingState } from "@/components/LoadingState";

export function SearchResults({ isLoading, listings }) {
  if (isLoading) {
    return <LoadingState kind="skeleton-card" count={6} />;
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map(listing => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
```

### 2. **Skeleton List (Bookings)**
Vertical list of items while loading.

```tsx
import { LoadingState } from "@/components/LoadingState";

export function BookingsList() {
  const { bookings, isLoading } = useBookings();

  if (isLoading) {
    return <LoadingState kind="skeleton-list" count={4} />;
  }

  return (
    <div className="space-y-3">
      {bookings.map(booking => (
        <BookingItem key={booking.id} booking={booking} />
      ))}
    </div>
  );
}
```

### 3. **Skeleton Form (Checkout)**
Form fields placeholder while loading data.

```tsx
import { LoadingState } from "@/components/LoadingState";

export function CheckoutForm() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCheckoutData().then(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <LoadingState kind="skeleton-form" />;
  }

  return (
    <form>
      {/* form fields */}
    </form>
  );
}
```

### 4. **Inline Spinner (Button Action)**
Show spinner inside button while submitting.

```tsx
import { LoadingState } from "@/components/LoadingState";

export function SubmitButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      await submitForm();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button onClick={handleSubmit} disabled={isLoading}>
      {isLoading ? (
        <>
          <LoadingState kind="spinner" />
          Submitting...
        </>
      ) : (
        "Submit"
      )}
    </button>
  );
}
```

### 5. **Table Skeleton (Data Tables)**
Placeholder for data tables.

```tsx
import { LoadingState } from "@/components/LoadingState";

export function OwnerBookingsTable() {
  const { bookings, isLoading } = useOwnerBookings();

  if (isLoading) {
    return <LoadingState kind="skeleton-table" rows={8} />;
  }

  return (
    <table>
      {/* table content */}
    </table>
  );
}
```

### 6. **Grid Skeleton (Feature Grid)**
Small grid items (amenities, features).

```tsx
import { LoadingState } from "@/components/LoadingState";

export function AmenitiesGrid({ amenities, isLoading }) {
  if (isLoading) {
    return <LoadingState kind="skeleton-grid" count={8} />;
  }

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {amenities.map(amenity => (
        <AmenityBadge key={amenity.id} amenity={amenity} />
      ))}
    </div>
  );
}
```

---

## Error Builder API

### Validation Errors
```typescript
import { buildValidationError, buildMissingFieldError, buildRateLimitError } from "@/utils/errorBuilder";

// Field validation failure
const error = buildValidationError("Email", "must be a valid email address");

// Required field missing
const error = buildMissingFieldError("Phone number");

// Rate limit (cooldown)
const error = buildRateLimitError(30); // 30 second cooldown
```

### Network Errors
```typescript
import { buildNetworkError, buildTimeoutError, buildOfflineError } from "@/utils/errorBuilder";

const error = buildNetworkError();    // Generic connectivity
const error = buildTimeoutError();    // Request took too long
const error = buildOfflineError();    // User is offline
```

### Permission Errors
```typescript
import { buildUnauthorizedError, buildForbiddenError, buildPermissionDeniedError } from "@/utils/errorBuilder";

const error = buildUnauthorizedError();           // Need to sign in
const error = buildForbiddenError("property");    // 403 forbidden
const error = buildPermissionDeniedError("book"); // Custom action
```

### Not Found / Server Errors
```typescript
import { buildNotFoundError, buildServerError, buildUnknownError } from "@/utils/errorBuilder";

const error = buildNotFoundError("property");  // 404
const error = buildServerError(500);           // 5xx
const error = buildUnknownError();             // Generic fallback
```

### Domain-Specific Errors
```typescript
import { buildPaymentError, buildBookingError, buildPropertyError } from "@/utils/errorBuilder";

const error = buildPaymentError("Card was declined by issuer");
const error = buildBookingError("Dates are no longer available");
const error = buildPropertyError("load");
```

### From API Responses
```typescript
import { buildErrorFromHttpStatus, buildErrorFromApiResponse } from "@/utils/errorBuilder";

// From HTTP status alone
const error = buildErrorFromHttpStatus(404);

// From parsed API response (ProblemDetails, etc.)
const response = await res.json();
const error = buildErrorFromApiResponse(response);
```

---

## CSS Animation Classes

### Skeleton Animations
```html
<!-- Individual stagger (manual) -->
<div class="animate-skeleton-pulse skeleton-stagger-1">Item 1</div>
<div class="animate-skeleton-pulse skeleton-stagger-2">Item 2</div>
<div class="animate-skeleton-pulse skeleton-stagger-3">Item 3</div>

<!-- Automatic stagger (via nth-child) -->
<div class="skeleton-list">
  <div class="skeleton-item animate-skeleton-pulse">Item 1</div>
  <div class="skeleton-item animate-skeleton-pulse">Item 2</div>
  <div class="skeleton-item animate-skeleton-pulse">Item 3</div>
</div>
```

### Spinner / Rotation
```html
<!-- Tailwind built-in -->
<div class="w-8 h-8 border-4 border-border-subtle border-t-cta-primary animate-spin"></div>

<!-- Custom color pulse spinner -->
<div class="w-8 h-8 border-4 border-current animate-spinner-color"></div>
```

### Entrance Animations
```html
<!-- Fade in -->
<div class="animate-fade-in">Error banner</div>

<!-- Slide up -->
<div class="animate-slide-up">Error banner</div>

<!-- Bounce -->
<div class="animate-bounce-in">Modal</div>

<!-- Shake (error emphasis) -->
<div class="animate-shake">Input field</div>
```

### Utilities
```css
/* Apply to parent for automatic stagger on children */
.skeleton-parent {
  /* nth-child stagger applied automatically */
}

/* Indefinite pulse */
.pulse-indefinite {
  animation: pulse 2s ease-in-out infinite;
}
```

---

## Common Patterns

### API Call with Error Handling
```tsx
const fetchData = async () => {
  setIsLoading(true);
  setError(null);
  try {
    const res = await fetch('/api/endpoint');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    setData(data);
  } catch (err) {
    setError(buildNetworkError());
  } finally {
    setIsLoading(false);
  }
};
```

### Form Submission with Validation
```tsx
const handleSubmit = (formData) => {
  // Validate
  if (!formData.email) {
    setFieldErrors(prev => ({
      ...prev,
      email: buildMissingFieldError("Email")
    }));
    return;
  }

  // Submit
  setIsLoading(true);
  submitForm(formData)
    .then(result => {
      // Success
      navigate('/success');
    })
    .catch(err => {
      setError(buildServerError(500));
    })
    .finally(() => setIsLoading(false));
};
```

### Progressive Loading
```tsx
// Show skeleton while fetching initial data
const [data, setData] = useState(null);
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  fetchData()
    .then(setData)
    .finally(() => setIsLoading(false));
}, []);

return (
  <>
    {isLoading && <LoadingState kind="skeleton-card" count={6} />}
    {!isLoading && data && <Grid items={data} />}
    {!isLoading && !data && <StateMessage icon="📭" title="No results" />}
  </>
);
```

---

## Testing

### Unit Test Example (Error Builder)
```typescript
import { buildValidationError, buildNetworkError } from "@/utils/errorBuilder";

describe("errorBuilder", () => {
  test("buildValidationError includes recovery action", () => {
    const error = buildValidationError("Email", "invalid format");
    expect(error.category).toBe("validation");
    expect(error.recoveryActions).toContainEqual(
      expect.objectContaining({ actionType: "RETRY" })
    );
  });

  test("buildNetworkError includes support contact", () => {
    const error = buildNetworkError();
    expect(error.recoveryActions.some(a => a.actionType === "CONTACT_SUPPORT")).toBe(true);
  });
});
```

### Integration Test Example
```typescript
import { render, screen } from "@testing-library/react";
import SearchPage from "@/pages/SearchPage";

describe("SearchPage error handling", () => {
  test("shows skeleton while loading", () => {
    render(<SearchPage isLoading={true} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  test("shows error banner on network failure", async () => {
    render(<SearchPage />);
    // Simulate network error
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/couldn't reach/i)).toBeInTheDocument();
  });
});
```

---

## Migration Checklist

### Step 1: Import & Setup
- [ ] Import error builders in API client layer
- [ ] Import LoadingState in data-fetching components
- [ ] Add animations.css to main stylesheet

### Step 2: API Layer
- [ ] Update `src/api/client.ts` to catch and map errors
- [ ] Update `src/utils/serverErrorFromResponse.ts` to use error builders
- [ ] Test error mapping with manual curl/Postman requests

### Step 3: Guest Portal
- [ ] Search page: skeleton-card, handle errors
- [ ] Property detail: handle 404, show StateMessage
- [ ] Booking flow: validation errors, network errors
- [ ] Payment: use razorpay error mapping, show ErrorDisplay
- [ ] Checkout: skeleton-form, error banners

### Step 4: Owner Portal
- [ ] Dashboard: skeleton-grid, skeleton-table
- [ ] Booking management: skeleton-list, error handling
- [ ] Property edit: validation errors, skeleton-form
- [ ] Analytics: skeleton-table, state messages

### Step 5: Testing
- [ ] Unit tests for error builders
- [ ] Integration tests for error flows
- [ ] Visual tests for skeleton animations
- [ ] A11y audit (screen readers, keyboard nav)
- [ ] Performance: no jank on low-end devices

---

## Troubleshooting

### Skeleton doesn't animate
- Ensure `src/styles/animations.css` is imported in main.tsx
- Check that Tailwind is including animations.css
- Verify `@keyframes skeleton-pulse` is in compiled CSS

### Stagger animation doesn't cascade
- Use `skeleton-stagger-1` through `skeleton-stagger-6` classes on items
- OR apply `.skeleton-grid` or `.skeleton-list` class to parent and use `:nth-child()` selector
- Ensure each child div renders (not skipped conditionally)

### Error messages are too technical
- Always use error builders (not raw HTTP status messages)
- Test with non-technical users
- Keep messages <2 sentences, avoid jargon

### Spinner spins too fast
- Check CSS `animation-duration` (should be 1s for spinner)
- Use Tailwind's `animate-spin` (built-in, correct speed)
- Don't override with custom keyframes

### Loading state flashes (layout shift)
- Ensure skeleton dimensions match real content (same height/width)
- Use `min-h-[X]` and `h-[X]` classes consistently
- Test on slow network (Chrome DevTools throttle)

---

## References

- **Main spec:** `docs/UNIFIED_ERROR_LOADING_PATTERNS.md`
- **Types:** `src/types/errors.ts`
- **Builders:** `src/utils/errorBuilder.ts`
- **Animations:** `src/styles/animations.css`
- **Components:** `src/components/Error*.tsx`, `src/components/LoadingState.tsx`
