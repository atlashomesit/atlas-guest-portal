# Error & Loading Patterns — Quick Reference Card

One-page cheat sheet for using error and loading patterns.

---

## 4 Error Types

| Type | Cause | Example | Action |
|------|-------|---------|--------|
| **Validation** | User input invalid | Email missing, wrong format | Fix input, retry |
| **Network** | Can't reach server | Offline, timeout, CORS | Retry, check connection |
| **Permission** | No access to resource | 403 Forbidden, unauthorized | Sign in, contact owner |
| **Unknown** | Server/app crashed | 500 error, unhandled exception | Retry, contact support |

---

## 4 Loading Patterns

| Pattern | Where | Duration | Count |
|---------|-------|----------|-------|
| **skeleton-card** | Search results, grid | 2-5s | `count={6}` |
| **skeleton-list** | Bookings, transactions | 1-3s | `count={4}` |
| **skeleton-form** | Checkout, settings | 1-2s | Auto |
| **spinner** | Button action, quick fetch | <2s | Inline |

---

## Error Components Cheat Sheet

### 1. ErrorBanner (Inline)
```tsx
<ErrorBanner
  message="Network error. Check your connection."
  severity="error"  // "error" | "warning" | "info"
  onRetry={() => refetch()}
  onDismiss={() => setError(null)}
/>
```
**Use for:** Form errors, API failures, dismissible alerts

### 2. ErrorDisplay (Structured)
```tsx
<ErrorDisplay
  error={error}  // { code, message, details, recoveryActions }
  onActionClick={(action) => handleRecovery(action)}
/>
```
**Use for:** Payment errors, detailed error with actions

### 3. StateMessage (Empty State)
```tsx
<StateMessage
  icon="🏠"
  title="Property Not Found"
  message="This listing is no longer available."
  primaryAction={{ label: "Browse", to: "/search" }}
  secondaryActions={[{ label: "Help", href: "/support" }]}
/>
```
**Use for:** 404, empty results, access denied

### 4. ErrorLayout (Full Page)
```tsx
<ErrorLayout
  title="Something Went Wrong"
  description="Try reloading the page."
  primaryAction={{ label: "Reload", onClick: () => location.reload() }}
  secondaryAction={{ label: "Home", href: "/" }}
/>
```
**Use for:** Render errors (ErrorBoundary), config failures

---

## Loading Component Cheat Sheet

```tsx
import { LoadingState } from "@/components/LoadingState";

// Grid of cards
<LoadingState kind="skeleton-card" count={6} />

// Vertical list
<LoadingState kind="skeleton-list" count={4} />

// Form fields
<LoadingState kind="skeleton-form" />

// Data table
<LoadingState kind="skeleton-table" rows={8} />

// Small grid
<LoadingState kind="skeleton-grid" count={8} />

// Inline spinner
<LoadingState kind="spinner" />
```

---

## Error Builders Cheat Sheet

### Validation
```typescript
import { buildValidationError, buildMissingFieldError, buildRateLimitError } from "@/utils/errorBuilder";

buildValidationError("Email", "invalid format");
buildMissingFieldError("Phone number");
buildRateLimitError(30); // 30 sec cooldown
```

### Network
```typescript
import { buildNetworkError, buildTimeoutError, buildOfflineError } from "@/utils/errorBuilder";

buildNetworkError();
buildTimeoutError();
buildOfflineError();
```

### Permission
```typescript
import { buildUnauthorizedError, buildForbiddenError } from "@/utils/errorBuilder";

buildUnauthorizedError();
buildForbiddenError("property");
```

### Server / Not Found
```typescript
import { buildNotFoundError, buildServerError, buildUnknownError } from "@/utils/errorBuilder";

buildNotFoundError("property");
buildServerError(500);
buildUnknownError();
```

### Domain-Specific
```typescript
buildPaymentError("Card declined");
buildBookingError("Dates unavailable");
buildPropertyError("load");
```

### From API
```typescript
buildErrorFromHttpStatus(404);
buildErrorFromApiResponse(apiResponse);
```

---

## Animations

### Skeleton (Pulsing)
```html
<div class="animate-skeleton-pulse">Item</div>
<!-- OR auto-stagger on nth-child -->
<div class="skeleton-list">
  <div class="animate-skeleton-pulse">Item 1</div>
  <div class="animate-skeleton-pulse">Item 2</div>
</div>
```

### Stagger (Cascade Effect)
```html
<div class="skeleton-stagger-1 animate-skeleton-pulse">Item 1</div>
<div class="skeleton-stagger-2 animate-skeleton-pulse">Item 2</div>
<div class="skeleton-stagger-3 animate-skeleton-pulse">Item 3</div>
```

### Spinner (Rotation)
```html
<div class="animate-spin">
  <svg><!-- spinner icon --></svg>
</div>
```

### Entrance
```html
<div class="animate-fade-in">Error</div>
<div class="animate-slide-up">Banner</div>
<div class="animate-bounce-in">Modal</div>
<div class="animate-shake">Input</div>
```

---

## Common Patterns

### API Fetch with Error
```typescript
const [data, setData] = useState(null);
const [error, setError] = useState(null);
const [isLoading, setIsLoading] = useState(false);

const fetch = async () => {
  setIsLoading(true);
  setError(null);
  try {
    const res = await fetchData();
    setData(res);
  } catch (err) {
    setError(buildNetworkError());
  } finally {
    setIsLoading(false);
  }
};

return (
  <>
    {isLoading && <LoadingState kind="skeleton-card" />}
    {error && <ErrorBanner message={error.message} onRetry={fetch} />}
    {data && <Component data={data} />}
  </>
);
```

### Form Validation
```typescript
const [fieldErrors, setFieldErrors] = useState({});

const validate = () => {
  const errors = {};
  if (!email) errors.email = buildMissingFieldError("Email");
  if (!validEmail(email)) errors.email = buildValidationError("Email", "invalid");
  setFieldErrors(errors);
  return Object.keys(errors).length === 0;
};

const handleSubmit = async (e) => {
  e.preventDefault();
  if (!validate()) return;
  // Submit...
};

return (
  <>
    {fieldErrors.email && <ErrorDisplay error={fieldErrors.email} />}
    <input />
  </>
);
```

### Not Found
```typescript
const [notFound, setNotFound] = useState(false);

useEffect(() => {
  fetchItem(id).catch(err => {
    if (err.status === 404) setNotFound(true);
  });
}, [id]);

if (notFound) {
  return <StateMessage icon="🔍" title="Not Found" />;
}

return <Item />;
```

---

## Files

| File | Purpose |
|------|---------|
| `docs/UNIFIED_ERROR_LOADING_PATTERNS.md` | Complete spec |
| `docs/ERROR_LOADING_IMPLEMENTATION_GUIDE.md` | Implementation examples |
| `src/types/errors.ts` | TypeScript types |
| `src/utils/errorBuilder.ts` | Error factory functions |
| `src/styles/animations.css` | Custom CSS animations |
| `src/components/ErrorBanner.tsx` | Inline alert component |
| `src/components/ErrorDisplay.tsx` | Structured error component |
| `src/components/StateMessage.tsx` | Empty/404/permission state |
| `src/components/ErrorLayout.tsx` | Full-page error screen |
| `src/components/ErrorBoundary.tsx` | Global error catcher |
| `src/components/LoadingState.tsx` | Skeleton factory |

---

## a11y Checklist

- [ ] Error messages are plain English (no codes)
- [ ] Icons have `aria-hidden="true"`
- [ ] Loading states have `role="status"` with `aria-live="polite"`
- [ ] Spinners have `aria-busy="true"`
- [ ] All buttons are keyboard accessible (Tab, Space/Enter)
- [ ] Error containers have `role="alert"` when appropriate
- [ ] Colors meet WCAG AA contrast (4.5:1)
- [ ] Reduced motion respected: `@media (prefers-reduced-motion: reduce)`

---

## Testing

```typescript
// Unit test
test("shows validation error for missing field", () => {
  const error = buildMissingFieldError("Email");
  expect(error.category).toBe("validation");
  expect(error.message).toContain("Email");
});

// Integration test
test("shows skeleton while loading", () => {
  render(<SearchPage isLoading={true} />);
  expect(screen.getByRole("status")).toBeInTheDocument();
});

test("shows error banner on network failure", async () => {
  render(<SearchPage />);
  fireEvent.click(screen.getByText("Search"));
  await waitFor(() => {
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
```

---

## Tips & Tricks

1. **Always provide recovery action** — Every error should have at least one "Try Again" button
2. **Skeleton dimensions must match content** — No layout shift on load completion
3. **Use error builders, not hardcoded messages** — Consistency across app
4. **Test on slow network** — Chrome DevTools: Throttle to Fast 3G
5. **Check animations on low-end devices** — No jank = good UX
6. **Respect prefers-reduced-motion** — CSS animations are already handled
7. **Stack errors for better UX** — Show multiple field errors together
8. **Use skeletons for > 1s loads** — Spinners for < 2s operations
9. **Color + text for errors** — Don't rely on color alone
10. **Test with screen readers** — VoiceOver, NVDA, JAWS
